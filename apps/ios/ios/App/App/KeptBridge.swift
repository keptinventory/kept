import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation
import KeptNativeStore
import QuickLook
import Security
import UIKit

final class KeptViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(KeptBridge())
    }
}

struct KeptConnection: Codable, Equatable {
    let origin: URL
    let account: String
    let epoch: String
    let cookie: String

    var id: String {
        [origin.absoluteString, account, epoch].joined(separator: "|")
    }

    var view: JSObject {
        ["id": id, "origin": origin.absoluteString, "account": account, "epoch": epoch]
    }
}

enum KeptNativeError: LocalizedError {
    case invalidServer, missingSession, invalidRequest, signInFailed, busy, keychain, storage, previewUnavailable

    var errorDescription: String? {
        switch self {
        case .invalidServer: return "Enter this Kept server’s HTTPS address."
        case .missingSession: return "Sign in to this Kept account again."
        case .invalidRequest: return "The app could not prepare this Kept request."
        case .signInFailed: return "Kept could not finish connecting this iPhone. Sign in again."
        case .busy: return "Finish the current sign-in and try again."
        case .keychain: return "The iPhone could not save or read the session in Keychain."
        case .storage: return "Kept could not save on this iPhone. Check available storage and try again."
        case .previewUnavailable: return "Kept could not open this preview. Close any open sheet and try again."
        }
    }
}

enum KeptLinks {
    static let notification = Notification.Name("KeptLinkAvailable")
    static var pending: URL?

    static func accept(_ url: URL) {
        guard url.scheme == "https" else { return }
        pending = url
        NotificationCenter.default.post(name: notification, object: nil)
    }

    static func take() -> URL? {
        defer { pending = nil }
        return pending
    }
}

enum KeptKeychain {
    private static var key: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "info.keptinventory.nfc",
            kSecAttrAccount as String: "kept-session"
        ]
    }

    static func read() throws -> KeptConnection? {
        var query = key
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw KeptNativeError.keychain
        }
        return try JSONDecoder().decode(KeptConnection.self, from: data)
    }

    static func write(_ connection: KeptConnection) throws {
        let data = try JSONEncoder().encode(connection)
        let changes: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(key as CFDictionary, changes as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw KeptNativeError.keychain }
        var item = key
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw KeptNativeError.keychain }
    }

    static func delete() throws {
        let status = SecItemDelete(key as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeptNativeError.keychain
        }
    }
}

private final class RejectRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

enum KeptHTTP {
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config, delegate: RejectRedirects(), delegateQueue: nil)
    }()

    static func origin(_ input: String) throws -> URL {
        guard var parts = URLComponents(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              let host = parts.host?.lowercased(), !host.isEmpty, !host.hasSuffix("."),
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/" else { throw KeptNativeError.invalidServer }
        let scheme = parts.scheme?.lowercased()
        var allowsHTTP = false
        #if DEBUG
        allowsHTTP = scheme == "http" && ["localhost", "127.0.0.1"].contains(host)
        #endif
        guard scheme == "https" || allowsHTTP else { throw KeptNativeError.invalidServer }
        parts.scheme = scheme
        parts.host = host
        parts.path = ""
        if parts.port == (scheme == "https" ? 443 : 80) { parts.port = nil }
        guard let url = parts.url else { throw KeptNativeError.invalidServer }
        return url
    }

    static func request(
        _ origin: URL, path: String, method: String, connection: KeptConnection? = nil
    ) throws -> URLRequest {
        guard path.hasPrefix("/api/v1/"), !path.contains("\\"), !path.contains("#"),
              let url = URL(string: path, relativeTo: origin)?.absoluteURL,
              url.scheme == origin.scheme, url.host == origin.host, url.port == origin.port,
              url.path.hasPrefix("/api/v1/"), !url.pathComponents.contains(".."),
              ["GET", "POST", "PUT", "PATCH", "DELETE"].contains(method)
        else { throw KeptNativeError.invalidRequest }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(origin.absoluteString, forHTTPHeaderField: "Origin")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Kept for iPhone", forHTTPHeaderField: "User-Agent")
        if let connection {
            request.setValue(connection.cookie, forHTTPHeaderField: "Cookie")
            if path != "/api/v1/auth/sign-out" {
                request.setValue(connection.account, forHTTPHeaderField: "X-Kept-Native-Account")
                request.setValue(connection.epoch, forHTTPHeaderField: "X-Kept-Native-Epoch")
            }
        }
        return request
    }

    static func send(_ request: URLRequest, original: URL? = nil) async throws -> (Data, HTTPURLResponse) {
        let (data, response): (Data, URLResponse)
        if let original {
            (data, response) = try await session.upload(for: request, fromFile: original)
        } else {
            (data, response) = try await session.data(for: request)
        }
        guard let http = response as? HTTPURLResponse else { throw KeptNativeError.invalidRequest }
        return (data, http)
    }

    static func downloadMedia(_ location: String, from origin: URL) async throws -> URL {
        guard let url = URL(string: location, relativeTo: origin)?.absoluteURL,
              url.user == nil, url.password == nil,
              url.scheme == "https" || (url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port)
        else { throw KeptNativeError.invalidRequest }
        let (file, response) = try await session.download(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            try? FileManager.default.removeItem(at: file)
            throw KeptNativeError.invalidRequest
        }
        return file
    }
}

@MainActor
final class NativeSignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var browser: ASWebAuthenticationSession?
    private weak var window: UIWindow?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        window ?? ASPresentationAnchor()
    }

    private func randomToken() throws -> String {
        var bytes = Data(count: 32)
        let status = bytes.withUnsafeMutableBytes { buffer in
            guard let start = buffer.baseAddress else { return errSecParam }
            return SecRandomCopyBytes(kSecRandomDefault, buffer.count, start)
        }
        guard status == errSecSuccess else { throw KeptNativeError.signInFailed }
        return base64URL(bytes)
    }

    private func base64URL(_ bytes: Data) -> String {
        bytes.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func extractSessionCookie(from response: HTTPURLResponse, origin: URL) -> String? {
        if let headers = response.allHeaderFields as? [String: String] {
            let cookies = HTTPCookie.cookies(withResponseHeaderFields: headers, for: origin)
            if let chosen = cookies.first(where: { $0.name.contains("session") }) ?? cookies.first {
                return "\(chosen.name)=\(chosen.value)"
            }
        }
        guard let setCookie = response.value(forHTTPHeaderField: "Set-Cookie"),
              let first = setCookie.split(separator: ";", maxSplits: 1).first,
              first.split(separator: "=", maxSplits: 1).count == 2
        else { return nil }
        return String(first)
    }

    func connect(origin: URL, window: UIWindow) async throws -> KeptConnection {
        guard browser == nil else { throw KeptNativeError.busy }
        self.window = window
        let verifier = try randomToken()
        let state = try randomToken()
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var start = URLComponents(url: origin.appendingPathComponent("native/connect"), resolvingAgainstBaseURL: false)
        start?.queryItems = [URLQueryItem(name: "challenge", value: challenge), URLQueryItem(name: "state", value: state)]
        guard let url = start?.url else { throw KeptNativeError.invalidServer }

        defer { browser = nil }
        let callback: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "kept-nfc") { callback, error in
                if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: error ?? KeptNativeError.signInFailed) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            browser = session
            if !session.start() { continuation.resume(throwing: KeptNativeError.signInFailed) }
        }
        guard let answer = URLComponents(url: callback, resolvingAgainstBaseURL: false),
              answer.scheme == "kept-nfc", answer.host == "auth", answer.path == "/callback",
              answer.user == nil, answer.password == nil, answer.port == nil, answer.fragment == nil,
              let fields = answer.queryItems, fields.count == 2,
              fields.first(where: { $0.name == "state" })?.value == state,
              let code = fields.first(where: { $0.name == "code" })?.value
        else { throw KeptNativeError.signInFailed }

        var request = try KeptHTTP.request(origin, path: "/api/v1/native/exchange", method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "verifier": verifier])
        let (data, response) = try await KeptHTTP.send(request)
        struct Context: Decodable { let account: String; let epoch: String }
        guard response.statusCode == 200,
              let cookie = extractSessionCookie(from: response, origin: origin)
        else { throw KeptNativeError.signInFailed }
        let context = try JSONDecoder().decode(Context.self, from: data)
        return KeptConnection(origin: origin, account: context.account, epoch: context.epoch, cookie: cookie)
    }
}

actor NativeOutbox {
    private var opened: Outbox?

    func use<T>(_ operation: (Outbox) throws -> T) throws -> T {
        if let opened { return try operation(opened) }
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        let store = try Outbox(root: support.appendingPathComponent("Kept", isDirectory: true))
        opened = store
        return try operation(store)
    }
}

@MainActor
final class KeptPreview: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    private var url: URL?

    func present(_ file: URL, from controller: UIViewController) throws {
        guard controller.viewIfLoaded?.window != nil, controller.presentedViewController == nil else {
            throw KeptNativeError.previewUnavailable
        }
        cleanup()
        url = file
        let preview = QLPreviewController()
        preview.dataSource = self
        preview.delegate = self
        controller.present(preview, animated: true)
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        url == nil ? 0 : 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        (url ?? URL(fileURLWithPath: "/")) as NSURL
    }

    func previewControllerDidDismiss(_ controller: QLPreviewController) {
        cleanup()
    }

    private func cleanup() {
        if let url { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        url = nil
    }
}

@objc(KeptBridge)
final class KeptBridge: CAPPlugin, CAPBridgedPlugin {
    let identifier = "KeptBridge"
    let jsName = "KeptNative"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "outbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadOriginal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanTag", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startFind", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "continueFind", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishFind", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelTag", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "matchFeedback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "nonMatchFeedback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeLink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openPendingMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openHeldMedia", returnType: CAPPluginReturnPromise)
    ]
    @MainActor private lazy var signIn = NativeSignIn()
    private let store = NativeOutbox()
    @MainActor private var nfc: KeptNFC?
    @MainActor private let match = KeptMatchFeedback()
    @MainActor private lazy var preview = KeptPreview()

    private static let mimeExtensions = [
        "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic",
        "image/heif": "heif", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
        "video/mp4": "mp4", "video/quicktime": "mov"
    ]

    override func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(linkAvailable), name: KeptLinks.notification, object: nil)
        center.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    @objc private func linkAvailable() {
        notifyListeners("keptLink", data: [:])
    }

    @objc private func appWillResignActive() {
        Task { @MainActor in
            self.nfc?.interruptForBackground()
            self.notifyListeners("appState", data: ["active": false])
        }
    }

    @objc private func appDidBecomeActive() {
        notifyListeners("appState", data: ["active": true])
    }

    @objc func takeLink(_ call: CAPPluginCall) {
        run(call) {
            _ = try self.requireConnection(call)
            if let url = KeptLinks.take() { call.resolve(["url": url.absoluteString]) }
            else { call.resolve([:]) }
        }
    }

    @objc func connection(_ call: CAPPluginCall) {
        run(call) {
            if let connection = try KeptKeychain.read() { call.resolve(connection.view) }
            else { call.resolve([:]) }
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        run(call) {
            guard try KeptKeychain.read() == nil else { throw KeptNativeError.busy }
            guard let address = call.getString("address"),
                  let window = self.bridge?.viewController?.view.window
            else { throw KeptNativeError.invalidServer }
            let origin = try KeptHTTP.origin(address)
            let connection = try await self.signIn.connect(origin: origin, window: window)
            try KeptKeychain.write(connection)
            call.resolve(connection.view)
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        run(call) {
            let connection = try KeptKeychain.read()
            try KeptKeychain.delete()
            var revoked = true
            if let connection {
                try? await self.store.use { try $0.clearCache(context: connection.id) }
                let request = try KeptHTTP.request(
                    connection.origin, path: "/api/v1/auth/sign-out", method: "POST", connection: connection
                )
                let response = try? await KeptHTTP.send(request).1
                revoked = response.map { (200..<300).contains($0.statusCode) || $0.statusCode == 401 } ?? false
            }
            call.resolve(["revoked": revoked])
        }
    }

    @objc func request(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            guard let path = call.getString("path"), let method = call.getString("method")
            else { throw KeptNativeError.invalidRequest }
            var request = try KeptHTTP.request(connection.origin, path: path, method: method, connection: connection)
            if let body = call.getString("body") {
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = Data(body.utf8)
            }
            if let rowVersion = call.getString("ifMatch") {
                request.setValue(rowVersion, forHTTPHeaderField: "If-Match")
            }
            let (data, response) = try await KeptHTTP.send(request)
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }
            call.resolve(["status": response.statusCode, "body": String(decoding: data, as: UTF8.self)])
        }
    }

    @objc func outbox(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            let context = connection.id
            let result: JSObject = try await self.store.use { store in
                switch call.getString("action") {
                case "stage":
                    guard let id = call.getString("id"), let file = call.getString("file"),
                          let offset = call.getInt("offset"), let encoded = call.getString("data"),
                          encoded.utf8.count <= 350_000, let data = Data(base64Encoded: encoded)
                    else { throw KeptNativeError.invalidRequest }
                    try store.stage(context: context, draft: id, file: file, offset: offset, data: data)
                case "save":
                    guard let id = call.getString("id"), let payload = call.getString("payload"),
                          let takenAt = call.getString("takenAt"), let files = call.getString("files")
                    else { throw KeptNativeError.invalidRequest }
                    let originals = try JSONDecoder().decode([StagedOriginal].self, from: Data(files.utf8))
                    _ = try store.commit(context: context, id: id, payload: payload, takenAt: takenAt, files: originals)
                case "abort":
                    guard let id = call.getString("id") else { throw KeptNativeError.invalidRequest }
                    try store.abort(context: context, id: id)
                case "list":
                    let queue = try store.pending(context: context)
                    return ["data": String(decoding: try JSONEncoder().encode(queue), as: UTF8.self)]
                case "failed":
                    guard let id = call.getString("id"), let reason = call.getString("reason"), reason.count <= 100
                    else { throw KeptNativeError.invalidRequest }
                    try store.failed(context: context, id: id, reason: reason)
                case "clearFailure":
                    guard let id = call.getString("id") else { throw KeptNativeError.invalidRequest }
                    try store.clearFailure(context: context, id: id)
                case "retarget":
                    guard let id = call.getString("id"), let payload = call.getString("payload")
                    else { throw KeptNativeError.invalidRequest }
                    let updated = try store.retarget(context: context, id: id, payload: payload)
                    return ["data": String(decoding: try JSONEncoder().encode(updated), as: UTF8.self)]
                case "complete":
                    guard let id = call.getString("id") else { throw KeptNativeError.invalidRequest }
                    try store.complete(context: context, id: id)
                case "discard":
                    guard let id = call.getString("id") else { throw KeptNativeError.invalidRequest }
                    try store.discard(context: context, id: id)
                case "completions":
                    let states = try store.completions(context: context)
                    let raw = states.mapValues { $0.rawValue }
                    return ["data": String(decoding: try JSONEncoder().encode(raw), as: UTF8.self)]
                case "heldList":
                    let held = try store.heldEntries(current: context)
                    return ["data": String(decoding: try JSONEncoder().encode(held), as: UTF8.self)]
                case "heldDiscard":
                    guard let id = call.getString("id"), let heldContext = call.getString("heldContext"),
                          Outbox.isHeldContext(heldContext, current: context)
                    else { throw KeptNativeError.invalidRequest }
                    try store.discard(context: heldContext, id: id)
                case "stats":
                    let stats = try store.stats(context: context)
                    return ["data": String(decoding: try JSONEncoder().encode(stats), as: UTF8.self)]
                case "cached":
                    if let contents = try store.cache(context: context) { return ["data": contents] }
                case "saveCache":
                    guard let contents = call.getString("data") else { throw KeptNativeError.invalidRequest }
                    try store.saveCache(context: context, contents: contents)
                case "clearCache":
                    try store.clearCache(context: context)
                case "getValue":
                    guard let key = call.getString("key") else { throw KeptNativeError.invalidRequest }
                    if let value = try store.readValue(context: context, key: key) { return ["data": value] }
                case "setValue":
                    guard let key = call.getString("key"), let value = call.getString("data")
                    else { throw KeptNativeError.invalidRequest }
                    try store.saveValue(context: context, key: key, value: value)
                case "deleteValue":
                    guard let key = call.getString("key") else { throw KeptNativeError.invalidRequest }
                    try store.deleteValue(context: context, key: key)
                default:
                    throw KeptNativeError.invalidRequest
                }
                return [:]
            }
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }
            call.resolve(result)
        }
    }

    @objc func uploadOriginal(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            guard let id = call.getString("id"), let file = call.getString("file"),
                  let location = call.getString("location"), UUID(uuidString: location) != nil
            else { throw KeptNativeError.invalidRequest }
            let (url, original) = try await self.store.use {
                try $0.original(context: connection.id, draft: id, file: file)
            }
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }
            let fileClass = original.file.role == "photo" ? "evidence" : "document"
            let uploadId = call.getString("uploadId") ?? original.file.id
            guard UUID(uuidString: uploadId) != nil else { throw KeptNativeError.invalidRequest }
            let path = "/api/v1/files/\(uploadId)?locationId=\(location)&class=\(fileClass)"
            var request = try KeptHTTP.request(connection.origin, path: path, method: "PUT", connection: connection)
            request.setValue(original.file.mime, forHTTPHeaderField: "Content-Type")
            request.setValue(original.sha256, forHTTPHeaderField: "X-Kept-Sha256")
            request.setValue(String(original.file.bytes), forHTTPHeaderField: "Content-Length")
            let (data, response) = try await KeptHTTP.send(request, original: url)
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }
            call.resolve(["status": response.statusCode, "body": String(decoding: data, as: UTF8.self)])
        }
    }

    @objc func scanTag(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            guard self.nfc == nil else { call.resolve(["status": "busy"]); return }
            let mode: KeptNFC.Mode
            switch call.getString("mode") {
            case "read": mode = .read
            case "inspect", "write":
                guard let raw = call.getString("url"),
                      case .approved = NFCLabelValidation.validate(urlText: raw, expectedOrigin: connection.origin),
                      let url = URL(string: raw)
                else { throw KeptNativeError.invalidRequest }
                if call.getString("mode") == "inspect" { mode = .inspect(url) }
                else {
                    guard let fingerprint = call.getString("fingerprint"), fingerprint.count == 64
                    else { throw KeptNativeError.invalidRequest }
                    mode = .write(url, expected: fingerprint)
                }
            default:
                throw KeptNativeError.invalidRequest
            }
            let messages = call.getObject("messages")?.compactMapValues { $0 as? String } ?? [:]
            self.nfc = KeptNFC(mode: mode, messages: messages) { [weak self] answer in
                self?.nfc = nil
                call.resolve(answer)
            }
            self.nfc?.start()
        }
    }

    @objc func startFind(_ call: CAPPluginCall) {
        run(call) {
            _ = try self.requireConnection(call)
            guard self.nfc == nil else { call.resolve(["status": "busy"]); return }
            guard let sessionId = call.getString("sessionId"), !sessionId.isEmpty, sessionId.count <= 64
            else { throw KeptNativeError.invalidRequest }
            let messages = call.getObject("messages")?.compactMapValues { $0 as? String } ?? [:]
            self.nfc = KeptNFC(
                mode: .find,
                messages: messages,
                sessionId: sessionId,
                onEvent: { [weak self] event in
                    self?.notifyListeners("nfcFind", data: event)
                },
                result: { [weak self] answer in
                    self?.nfc = nil
                    call.resolve(answer)
                }
            )
            self.nfc?.start()
        }
    }

    /// True only when the call targets the live Find session (or carries no identity, legacy).
    @MainActor private func isCurrentFind(_ call: CAPPluginCall) -> Bool {
        guard let sessionId = call.getString("sessionId") else { return true }
        return nfc?.sessionId == sessionId
    }

    @objc func continueFind(_ call: CAPPluginCall) {
        run(call) {
            _ = try self.requireConnection(call)
            guard self.isCurrentFind(call) else { call.resolve(); return }
            self.nfc?.continuePolling(alertMessage: call.getString("message"))
            call.resolve()
        }
    }

    @objc func finishFind(_ call: CAPPluginCall) {
        run(call) {
            _ = try self.requireConnection(call)
            guard self.isCurrentFind(call) else { call.resolve(); return }
            self.nfc?.finishFind(alertMessage: call.getString("message"))
            call.resolve()
        }
    }

    @objc func cancelTag(_ call: CAPPluginCall) {
        run(call) {
            guard self.isCurrentFind(call) else { call.resolve(); return }
            self.nfc?.cancel()
            call.resolve()
        }
    }

    @objc func matchFeedback(_ call: CAPPluginCall) {
        run(call) {
            _ = try self.requireConnection(call)
            self.match.playMatch(announcement: call.getString("announcement"))
            call.resolve()
        }
    }

    @objc func nonMatchFeedback(_ call: CAPPluginCall) {
        run(call) {
            _ = try self.requireConnection(call)
            self.match.playNonMatch(announcement: call.getString("announcement"))
            call.resolve()
        }
    }

    @objc func openMedia(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            let thing = call.getString("thing")
            if let thing, !thing.isEmpty, UUID(uuidString: thing) == nil {
                throw KeptNativeError.invalidRequest
            }
            guard let file = call.getString("file"), UUID(uuidString: file) != nil,
                  let controller = self.bridge?.viewController,
                  let mime = call.getString("mime"), let ext = Self.mimeExtensions[mime]
            else { throw KeptNativeError.invalidRequest }
            let query = thing.flatMap { $0.isEmpty ? nil : "?thingId=\($0)" } ?? ""
            var request = try KeptHTTP.request(connection.origin, path: "/api/v1/files/\(file)/url\(query)",
                                               method: "POST", connection: connection)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = Data(#"{"variant":"original"}"#.utf8)
            let (data, response) = try await KeptHTTP.send(request)
            struct Link: Decodable { let url: String }
            guard response.statusCode == 200 else { throw KeptNativeError.invalidRequest }
            let link = try JSONDecoder().decode(Link.self, from: data)
            let downloaded = try await KeptHTTP.downloadMedia(link.url, from: connection.origin)
            defer { try? FileManager.default.removeItem(at: downloaded) }
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }

            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("kept-preview-\(UUID())", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                                                    attributes: [.protectionKey: FileProtectionType.complete])
            let target = folder.appendingPathComponent("Kept original.\(ext)")
            do {
                try FileManager.default.moveItem(at: downloaded, to: target)
                try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
                try self.preview.present(target, from: controller)
            } catch {
                try? FileManager.default.removeItem(at: folder)
                throw error
            }
            call.resolve()
        }
    }

    @objc func openPendingMedia(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            guard let id = call.getString("id"), UUID(uuidString: id) != nil,
                  let file = call.getString("file"), UUID(uuidString: file) != nil,
                  let controller = self.bridge?.viewController
            else { throw KeptNativeError.invalidRequest }
            let (sourceURL, original) = try await self.store.use {
                try $0.original(context: connection.id, draft: id, file: file)
            }
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }
            let ext = Self.mimeExtensions[original.file.mime] ?? "dat"
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("kept-preview-\(UUID())", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                                                    attributes: [.protectionKey: FileProtectionType.complete])
            let target = folder.appendingPathComponent("Kept pending.\(ext)")
            do {
                try FileManager.default.copyItem(at: sourceURL, to: target)
                try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
                try self.preview.present(target, from: controller)
            } catch {
                try? FileManager.default.removeItem(at: folder)
                throw error
            }
            call.resolve()
        }
    }

    @objc func openHeldMedia(_ call: CAPPluginCall) {
        run(call) {
            let connection = try self.requireConnection(call)
            guard let heldContext = call.getString("heldContext"),
                  Outbox.isHeldContext(heldContext, current: connection.id),
                  let id = call.getString("id"), UUID(uuidString: id) != nil,
                  let file = call.getString("file"), UUID(uuidString: file) != nil,
                  let controller = self.bridge?.viewController
            else { throw KeptNativeError.invalidRequest }
            let (sourceURL, original) = try await self.store.use {
                try $0.original(context: heldContext, draft: id, file: file)
            }
            guard try KeptKeychain.read() == connection else { throw KeptNativeError.missingSession }
            let ext = Self.mimeExtensions[original.file.mime] ?? "dat"
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("kept-preview-\(UUID())", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true,
                                                    attributes: [.protectionKey: FileProtectionType.complete])
            let target = folder.appendingPathComponent("Kept held.\(ext)")
            do {
                try FileManager.default.copyItem(at: sourceURL, to: target)
                try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
                try self.preview.present(target, from: controller)
            } catch {
                try? FileManager.default.removeItem(at: folder)
                throw error
            }
            call.resolve()
        }
    }

    func requireConnection(_ call: CAPPluginCall) throws -> KeptConnection {
        guard let context = call.getString("context"),
              let connection = try KeptKeychain.read(), connection.id == context
        else { throw KeptNativeError.missingSession }
        return connection
    }

    func run(_ call: CAPPluginCall, operation: @escaping @MainActor () async throws -> Void) {
        Task { @MainActor in
            do { try await operation() }
            catch let error as OutboxError where error == .storageFull {
                call.reject(error.localizedDescription, "storage_full", error)
            }
            catch let error as URLError { call.reject("Could not connect to Kept.", "network", error) }
            catch { call.reject(error.localizedDescription) }
        }
    }
}
