import AVFAudio
import Capacitor
import CoreNFC
import CryptoKit
import Foundation
import KeptNativeStore
import UIKit

final class KeptNFC: NSObject, NFCNDEFReaderSessionDelegate {
    enum Mode {
        case read
        case find
        case inspect(URL)
        case write(URL, expected: String)
    }

    private let mode: Mode
    private let messages: [String: String]
    private let onEvent: ((JSObject) -> Void)?
    /// Scan-session identity for `.find`; echoed in every event/result so stale work is droppable.
    let sessionId: String?
    private var result: ((JSObject) -> Void)?
    private var session: NFCNDEFReaderSession?
    private var processing = false
    private var debouncer = NFCRepeatDebouncer(window: 2.5)

    init(
        mode: Mode,
        messages: [String: String],
        sessionId: String? = nil,
        onEvent: ((JSObject) -> Void)? = nil,
        result: @escaping (JSObject) -> Void
    ) {
        self.mode = mode
        self.messages = messages
        self.sessionId = sessionId
        self.onEvent = onEvent
        self.result = result
    }

    private func event(_ data: JSObject) {
        var payload = data
        if let sessionId { payload["sessionId"] = sessionId }
        onEvent?(payload)
    }

    func start() {
        guard NFCNDEFReaderSession.readingAvailable else {
            finish("unavailable")
            return
        }
        debouncer.reset()
        processing = false
        let reader = NFCNDEFReaderSession(delegate: self, queue: .main, invalidateAfterFirstRead: false)
        session = reader
        reader.alertMessage = messages["scan"] ?? "Hold the top of your iPhone near one NFC tag."
        reader.begin()
    }

    func cancel() {
        finish("cancelled")
    }

    func interruptForBackground() {
        guard result != nil else { return }
        finish("interrupted")
    }

    func continuePolling(alertMessage: String?) {
        guard case .find = mode, let session = self.session, result != nil else { return }
        if let alertMessage, !alertMessage.isEmpty {
            session.alertMessage = alertMessage
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            guard let self, self.session === session, self.result != nil else { return }
            self.processing = false
            session.restartPolling()
        }
    }

    func finishFind(alertMessage: String?) {
        guard case .find = mode, result != nil else { return }
        if let alertMessage, !alertMessage.isEmpty {
            session?.alertMessage = alertMessage
        }
        finish("matched")
    }

    private func finish(_ state: String, _ data: JSObject = [:]) {
        guard let result else { return }
        self.result = nil
        var answer = data
        answer["status"] = state
        if let sessionId { answer["sessionId"] = sessionId }
        if state == "written", let message = messages["written"] {
            session?.alertMessage = message
        } else if state == "matched", let message = messages["matched"], !(session?.alertMessage.isEmpty == false) {
            session?.alertMessage = message
        }
        let activeSession = session
        session = nil
        activeSession?.invalidate()
        result(answer)
    }

    func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {}

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
                guard let self, self.session === session, self.result != nil else { return }
                session.restartPolling()
            }
            return
        }
        processing = true
        session.connect(to: tag) { [weak self] error in
            guard let self, self.result != nil else { return }
            if error != nil {
                self.handleTagReadFailure(in: session)
                return
            }
            tag.queryNDEFStatus { [weak self] status, capacity, error in
                guard let self, self.result != nil else { return }
                if error != nil {
                    self.handleTagReadFailure(in: session)
                    return
                }
                guard status != .notSupported else {
                    if case .find = self.mode {
                        self.event(["status": "unsupported"])
                    } else {
                        self.finish("unsupported")
                    }
                    return
                }
                tag.readNDEF { [weak self] message, error in
                    guard let self, self.result != nil else { return }
                    let code = (error as? NFCReaderError)?.code
                    guard error == nil || code == .ndefReaderSessionErrorZeroLengthMessage else {
                        self.handleTagReadFailure(in: session)
                        return
                    }
                    self.read(tag, in: session, message: message, writable: status == .readWrite, capacity: capacity)
                }
            }
        }
    }

    private func handleTagReadFailure(in session: NFCNDEFReaderSession) {
        if case .find = mode {
            session.alertMessage = messages["retry"] ?? "Hold steady against the tag and try again."
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
                guard let self, self.session === session, self.result != nil else { return }
                self.processing = false
                session.restartPolling()
            }
            return
        }
        finish("interrupted")
    }

    private func read(
        _ tag: NFCNDEFTag,
        in session: NFCNDEFReaderSession,
        message: NFCNDEFMessage?,
        writable: Bool,
        capacity: Int
    ) {
        let records = message?.records ?? []
        let snapshots = records.map {
            NDEFRecordSnapshot(
                typeNameFormat: $0.typeNameFormat.rawValue,
                type: $0.type,
                identifier: $0.identifier,
                payload: $0.payload
            )
        }
        let existing = records.count == 1 ? records[0].wellKnownTypeURIPayload()?.absoluteString : nil
        let fingerprint = NDEFRecordSnapshot.fingerprint(snapshots)
        var metadata: JSObject = [
            "fingerprint": fingerprint, "occupied": !records.isEmpty,
            "writable": writable, "capacity": capacity
        ]
        if let existing { metadata["url"] = existing }
        switch mode {
        case .read:
            finish(existing != nil ? "read" : records.isEmpty ? "blank" : "malformed", metadata)
        case .find:
            guard debouncer.shouldAccept(fingerprint: fingerprint) else {
                event(["status": "repeated", "fingerprint": fingerprint])
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
                    guard let self, self.session === session, self.result != nil else { return }
                    self.processing = false
                    session.restartPolling()
                }
                return
            }
            metadata["status"] = existing != nil ? "read" : records.isEmpty ? "blank" : "malformed"
            event(metadata)
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
                    guard error == nil, let actual else {
                        self.finish("write_unverified")
                        return
                    }
                    let actualSnapshots = actual.records.map {
                        NDEFRecordSnapshot(
                            typeNameFormat: $0.typeNameFormat.rawValue,
                            type: $0.type,
                            identifier: $0.identifier,
                            payload: $0.payload
                        )
                    }
                    let intendedSnapshots = intended.records.map {
                        NDEFRecordSnapshot(
                            typeNameFormat: $0.typeNameFormat.rawValue,
                            type: $0.type,
                            identifier: $0.identifier,
                            payload: $0.payload
                        )
                    }
                    guard NDEFRecordSnapshot.fingerprint(actualSnapshots) == NDEFRecordSnapshot.fingerprint(intendedSnapshots) else {
                        self.finish("write_unverified")
                        return
                    }
                    self.finish("written")
                }
            }
        }
    }
}

final class KeptMatchFeedback {
    private var sound: AVAudioPlayer?

    func playMatch(announcement: String? = nil) {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            sound = try AVAudioPlayer(data: chime())
            sound?.play()
        } catch {
            // Visual feedback still works when the system is using the audio session.
        }
        if let announcement, !announcement.isEmpty {
            UIAccessibility.post(notification: .announcement, argument: announcement)
        }
    }

    func playNonMatch(announcement: String? = nil) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if let announcement, !announcement.isEmpty {
            UIAccessibility.post(notification: .announcement, argument: announcement)
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
