import AVFAudio
import Capacitor
import CoreNFC
import CryptoKit
import Foundation
import UIKit

final class KeptNFC: NSObject, NFCNDEFReaderSessionDelegate {
    enum Mode {
        case read
        case inspect(URL)
        case write(URL, expected: String)
    }

    private let mode: Mode
    private let messages: [String: String]
    private var result: ((JSObject) -> Void)?
    private var session: NFCNDEFReaderSession?
    private var processing = false

    init(mode: Mode, messages: [String: String], result: @escaping (JSObject) -> Void) {
        self.mode = mode
        self.messages = messages
        self.result = result
    }

    func start() {
        guard NFCNDEFReaderSession.readingAvailable else {
            finish("unavailable")
            return
        }
        let reader = NFCNDEFReaderSession(delegate: self, queue: .main, invalidateAfterFirstRead: false)
        session = reader
        reader.alertMessage = messages["scan"] ?? "Hold the top of your iPhone near one NFC tag."
        reader.begin()
    }

    func cancel() {
        finish("cancelled")
    }

    private func finish(_ state: String, _ data: JSObject = [:]) {
        guard let result else { return }
        self.result = nil
        var answer = data
        answer["status"] = state
        if state == "written", let message = messages["written"] {
            session?.alertMessage = message
        }
        session?.invalidate()
        session = nil
        result(answer)
    }

    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        let code = (error as? NFCReaderError)?.code
        switch code {
        case .readerSessionInvalidationErrorUserCanceled: finish("cancelled")
        case .readerSessionInvalidationErrorSessionTimeout: finish("timeout")
        case .readerSessionInvalidationErrorSystemIsBusy: finish("busy")
        default: finish("interrupted")
        }
    }

    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {}

    func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard result != nil, !processing else { return }
        guard tags.count == 1, let tag = tags.first else {
            session.alertMessage = messages["multiple"] ?? "Move other tags away and scan one tag."
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
                guard self?.session === session else { return }
                session.restartPolling()
            }
            return
        }
        processing = true
        session.connect(to: tag) { [weak self] error in
            guard let self, self.result != nil else { return }
            if error != nil { self.finish("interrupted"); return }
            tag.queryNDEFStatus { [weak self] status, capacity, error in
                guard let self, self.result != nil else { return }
                if error != nil { self.finish("interrupted"); return }
                guard status != .notSupported else { self.finish("unsupported"); return }
                tag.readNDEF { [weak self] message, error in
                    guard let self, self.result != nil else { return }
                    let code = (error as? NFCReaderError)?.code
                    guard error == nil || code == .ndefReaderSessionErrorZeroLengthMessage else {
                        self.finish("interrupted")
                        return
                    }
                    self.read(tag, message: message, writable: status == .readWrite, capacity: capacity)
                }
            }
        }
    }

    private func read(_ tag: NFCNDEFTag, message: NFCNDEFMessage?, writable: Bool, capacity: Int) {
        let records = message?.records ?? []
        let existing = records.count == 1 ? records[0].wellKnownTypeURIPayload()?.absoluteString : nil
        let fingerprint = fingerprintOf(records)
        var metadata: JSObject = [
            "fingerprint": fingerprint, "occupied": !records.isEmpty,
            "writable": writable, "capacity": capacity
        ]
        if let existing { metadata["url"] = existing }
        switch mode {
        case .read:
            finish(existing != nil ? "read" : records.isEmpty ? "blank" : "malformed", metadata)
        case .inspect(let url):
            guard let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
                finish("malformed")
                return
            }
            let message = NFCNDEFMessage(records: [payload])
            metadata["required"] = message.length
            finish("inspected", metadata)
        case .write(let url, let expected):
            guard fingerprint == expected else { finish("changed", metadata); return }
            if existing == url.absoluteString { finish("written"); return }
            guard writable else { finish("read_only"); return }
            guard let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
                finish("malformed")
                return
            }
            let intended = NFCNDEFMessage(records: [payload])
            guard intended.length <= capacity else { finish("too_small"); return }
            tag.writeNDEF(intended) { [weak self] error in
                guard let self, self.result != nil else { return }
                guard error == nil else { self.finish("write_unverified"); return }
                tag.readNDEF { [weak self] actual, error in
                    guard let self, self.result != nil else { return }
                    guard error == nil, let actual,
                          self.fingerprintOf(actual.records) == self.fingerprintOf(intended.records)
                    else { self.finish("write_unverified"); return }
                    self.finish("written")
                }
            }
        }
    }

    private func fingerprintOf(_ records: [NFCNDEFPayload]) -> String {
        var hash = SHA256()
        for record in records {
            let recordBytes = [
                String(record.typeNameFormat.rawValue), record.type.base64EncodedString(),
                record.identifier.base64EncodedString(), record.payload.base64EncodedString()
            ].joined(separator: "|") + "\n"
            hash.update(data: Data(recordBytes.utf8))
        }
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }
}

final class KeptMatchFeedback {
    private var sound: AVAudioPlayer?

    func play() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            sound = try AVAudioPlayer(data: chime())
            sound?.play()
        } catch {
            // Visual feedback still works when the system is using the audio session.
        }
    }

    private func chime() -> Data {
        let sampleRate = 12_000
        let noteSamples = 1_200
        var wave = Data("RIFF".utf8)
        func int(_ number: UInt32) {
            var value = number.littleEndian
            withUnsafeBytes(of: &value) { wave.append(contentsOf: $0) }
        }
        func short(_ number: Int16) {
            var value = number.littleEndian
            withUnsafeBytes(of: &value) { wave.append(contentsOf: $0) }
        }
        let bytes = UInt32(noteSamples * 4)
        int(36 + bytes)
        wave.append(Data("WAVEfmt ".utf8))
        int(16); short(1); short(1)
        int(UInt32(sampleRate)); int(UInt32(sampleRate * 2))
        short(2); short(16)
        wave.append(Data("data".utf8))
        int(bytes)
        for frequency in [880.0, 1320.0] {
            for index in 0..<noteSamples {
                let amplitude = min(Double(index) / 60, Double(noteSamples - index) / 300, 1)
                let angle = 2 * Double.pi * frequency * Double(index) / Double(sampleRate)
                short(Int16(4000 * amplitude * sin(angle)))
            }
        }
        return wave
    }
}
