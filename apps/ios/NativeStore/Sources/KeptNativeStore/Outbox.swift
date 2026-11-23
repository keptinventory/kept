import CryptoKit
import Foundation
import SQLite3

public struct StagedOriginal: Codable, Equatable {
    public let id: String
    public let name: String
    public let mime: String
    public let role: String
    public let bytes: Int

    public init(id: String, name: String, mime: String, role: String, bytes: Int) {
        self.id = id
        self.name = name
        self.mime = mime
        self.role = role
        self.bytes = bytes
    }
}

public struct PendingOriginal: Codable, Equatable {
    public let file: StagedOriginal
    public let sha256: String
}

public struct PendingCapture: Codable, Equatable {
    public let id: String
    public let context: String
    public let payload: String
    public let takenAt: String
    public let files: [PendingOriginal]
}

public struct OutboxEntry: Codable, Equatable {
    public let capture: PendingCapture
    public let failure: String?
}

public enum OutboxError: LocalizedError {
    case invalid, storage, missing

    public var errorDescription: String? {
        switch self {
        case .invalid: return "This capture or file could not be saved."
        case .storage: return "Kept could not save on this iPhone. Check available storage and try again."
        case .missing: return "A pending original is missing. Review this capture before trying again."
        }
    }
}

/// SQLite is the queue of record. The manifest allows an interrupted file-to-SQLite commit to
/// finish safely at launch. Paths are derived from validated IDs, never from selected filenames.
public final class Outbox {
    private let root: URL
    private let db: OpaquePointer
    private let fs = FileManager.default
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    private let perFileLimit = 25 * 1024 * 1024
    private let chunkLimit = 256 * 1024

    public init(root: URL) throws {
        self.root = root
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: root.path)
        var privateRoot = root
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try privateRoot.setResourceValues(values)
        #endif

        var handle: OpaquePointer?
        guard sqlite3_open_v2(
            root.appendingPathComponent("outbox.sqlite").path, &handle,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil
        ) == SQLITE_OK, let handle else {
            sqlite3_close(handle)
            throw OutboxError.storage
        }
        db = handle
        try sql("PRAGMA journal_mode = WAL")
        try sql("PRAGMA synchronous = FULL")
        try sql("""
            CREATE TABLE IF NOT EXISTS captures (
                id TEXT NOT NULL,
                context TEXT NOT NULL,
                manifest TEXT NOT NULL,
                failure TEXT,
                completed INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (context, id)
            )
            """)
        try sql("""
            CREATE TABLE IF NOT EXISTS cache (
                context TEXT PRIMARY KEY,
                contents TEXT NOT NULL
            )
            """)
        try repair()
    }

    deinit { sqlite3_close(db) }

    public func stage(context: String, draft: String, file: String, offset: Int, data: Data) throws {
        guard UUID(uuidString: file) != nil, offset >= 0, !data.isEmpty,
              data.count <= chunkLimit, offset <= perFileLimit - data.count
        else { throw OutboxError.invalid }
        let folder = try captureFolder(context: context, id: draft, staged: true)
        try fs.createDirectory(at: folder, withIntermediateDirectories: true)
        let path = folder.appendingPathComponent(file.lowercased())
        if !fs.fileExists(atPath: path.path) {
            guard offset == 0, fs.createFile(atPath: path.path, contents: nil) else {
                throw OutboxError.invalid
            }
        }
        let original = try FileHandle(forUpdating: path)
        defer { try? original.close() }
        let end = try original.seekToEnd()
        // A retry may follow an interrupted bridge answer. Accept identical bytes at that offset.
        if end >= UInt64(offset + data.count) {
            try original.seek(toOffset: UInt64(offset))
            guard try original.read(upToCount: data.count) == data else { throw OutboxError.invalid }
            return
        }
        guard end == UInt64(offset) else { throw OutboxError.invalid }
        try original.write(contentsOf: data)
    }

    public func commit(
        context: String, id: String, payload: String, takenAt: String, files: [StagedOriginal]
    ) throws -> PendingCapture {
        guard !payload.isEmpty, payload.utf8.count <= 12_000, files.count <= 20,
              Set(files.map { $0.id.lowercased() }).count == files.count
        else { throw OutboxError.invalid }
        let stage = try captureFolder(context: context, id: id, staged: true)
        let final = try captureFolder(context: context, id: id, staged: false)
        if fs.fileExists(atPath: final.path) {
            let capture = try readManifest(final)
            guard matches(capture, folder: final), capture.payload == payload,
                  capture.takenAt == takenAt, capture.files.map(\.file) == files
            else { throw OutboxError.invalid }
            try insert(capture)
            return capture
        }

        try fs.createDirectory(at: stage, withIntermediateDirectories: true)
        let originals = try files.map { file in
            guard UUID(uuidString: file.id) != nil, (1...perFileLimit).contains(file.bytes),
                  file.name.utf8.count <= 512, file.mime.utf8.count <= 120,
                  ["photo", "document"].contains(file.role)
            else { throw OutboxError.invalid }
            let url = stage.appendingPathComponent(file.id.lowercased())
            let handle = try FileHandle(forUpdating: url)
            defer { try? handle.close() }
            guard try handle.seekToEnd() == UInt64(file.bytes) else { throw OutboxError.missing }
            try handle.synchronize()
            try handle.seek(toOffset: 0)
            var hasher = SHA256()
            while let bytes = try handle.read(upToCount: chunkLimit), !bytes.isEmpty {
                hasher.update(data: bytes)
            }
            let hash = hasher.finalize().map { String(format: "%02x", $0) }.joined()
            return PendingOriginal(file: file, sha256: hash)
        }
        let capture = PendingCapture(id: id.lowercased(), context: context, payload: payload, takenAt: takenAt, files: originals)
        let manifest = stage.appendingPathComponent("capture.json")
        try JSONEncoder().encode(capture).write(to: manifest, options: .atomic)
        let handle = try FileHandle(forUpdating: manifest)
        try handle.synchronize()
        try handle.close()
        try fs.moveItem(at: stage, to: final)
        try insert(capture)
        return capture
    }

    public func abort(context: String, id: String) throws {
        let folder = try captureFolder(context: context, id: id, staged: true)
        if fs.fileExists(atPath: folder.path) { try fs.removeItem(at: folder) }
    }

    public func pending(context: String) throws -> [OutboxEntry] {
        try query(
            "SELECT manifest, failure FROM captures WHERE context = ? AND completed = 0 ORDER BY id",
            [context]
        ) { row in
            OutboxEntry(capture: try decode(try string(row, 0)), failure: optionalString(row, 1))
        }
    }

    public func original(context: String, draft: String, file: String) throws -> (URL, PendingOriginal) {
        let folder = try captureFolder(context: context, id: draft, staged: false)
        let captures = try query(
            "SELECT manifest FROM captures WHERE context = ? AND id = ? AND completed = 0",
            [context, draft.lowercased()]
        ) { row in try decode(try string(row, 0)) }
        guard let original = captures.first?.files.first(where: { $0.file.id == file }) else {
            throw OutboxError.missing
        }
        let url = folder.appendingPathComponent(file.lowercased())
        guard fs.fileExists(atPath: url.path) else { throw OutboxError.missing }
        return (url, original)
    }

    public func failed(context: String, id: String, reason: String) throws {
        try sql("UPDATE captures SET failure = ? WHERE context = ? AND id = ? AND completed = 0",
                [reason, context, id.lowercased()])
    }

    public func complete(context: String, id: String) throws {
        let folder = try captureFolder(context: context, id: id, staged: false)
        // Record confirmation durably before removing file bytes. Repair never reopens a
        // completed capture even if the app stops before file cleanup finishes.
        try sql("UPDATE captures SET completed = 1 WHERE context = ? AND id = ?", [context, id.lowercased()])
        if fs.fileExists(atPath: folder.path) {
            do { try fs.removeItem(at: folder) }
            catch { return }
        }
        try sql("DELETE FROM captures WHERE context = ? AND id = ? AND completed = 1", [context, id.lowercased()])
    }

    public func cache(context: String) throws -> String? {
        try query("SELECT contents FROM cache WHERE context = ?", [context]) { row in
            try string(row, 0)
        }.first
    }

    public func saveCache(context: String, contents: String) throws {
        guard contents.utf8.count <= 32 * 1024 * 1024 else { throw OutboxError.storage }
        try sql("""
            INSERT INTO cache (context, contents) VALUES (?, ?)
            ON CONFLICT (context) DO UPDATE SET contents = EXCLUDED.contents
            """, [context, contents])
    }

    public func clearCache(context: String) throws {
        try sql("DELETE FROM cache WHERE context = ?", [context])
    }

    private func repair() throws {
        let scopes = try fs.contentsOfDirectory(at: root, includingPropertiesForKeys: [.isDirectoryKey])
        for scope in scopes where try scope.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true {
            let folders = try fs.contentsOfDirectory(at: scope, includingPropertiesForKeys: [.isDirectoryKey])
            for folder in folders where try folder.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true {
                if folder.lastPathComponent.hasPrefix("staged-") {
                    guard let capture = try? readManifest(folder), matches(capture, folder: folder, staged: true) else {
                        try fs.removeItem(at: folder)
                        continue
                    }
                    let final = try captureFolder(context: capture.context, id: capture.id, staged: false)
                    if fs.fileExists(atPath: final.path) { try fs.removeItem(at: folder) }
                    else { try fs.moveItem(at: folder, to: final) }
                    try insert(capture)
                } else if let capture = try? readManifest(folder), matches(capture, folder: folder) {
                    try insert(capture)
                }
            }
        }
        let completed = try query("SELECT context, id FROM captures WHERE completed = 1", []) { row in
            (try string(row, 0), try string(row, 1))
        }
        for (context, id) in completed { try complete(context: context, id: id) }
    }

    private func insert(_ capture: PendingCapture) throws {
        let encoded = String(decoding: try JSONEncoder().encode(capture), as: UTF8.self)
        try sql("INSERT OR IGNORE INTO captures (id, context, manifest) VALUES (?, ?, ?)",
                [capture.id, capture.context, encoded])
    }

    private func matches(_ capture: PendingCapture, folder: URL, staged: Bool = false) -> Bool {
        guard let expected = try? captureFolder(context: capture.context, id: capture.id, staged: staged),
              expected.standardizedFileURL == folder.standardizedFileURL else { return false }
        return capture.files.allSatisfy { original in
            guard UUID(uuidString: original.file.id) != nil else { return false }
            let url = folder.appendingPathComponent(original.file.id.lowercased())
            return (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) == original.file.bytes
        }
    }

    private func readManifest(_ folder: URL) throws -> PendingCapture {
        try JSONDecoder().decode(PendingCapture.self, from: Data(contentsOf: folder.appendingPathComponent("capture.json")))
    }

    private func decode(_ value: String) throws -> PendingCapture {
        try JSONDecoder().decode(PendingCapture.self, from: Data(value.utf8))
    }

    private func captureFolder(context: String, id: String, staged: Bool) throws -> URL {
        guard !context.isEmpty, context.utf8.count <= 1024, UUID(uuidString: id) != nil
        else { throw OutboxError.invalid }
        let scope = SHA256.hash(data: Data(context.utf8)).map { String(format: "%02x", $0) }.joined()
        let name = (staged ? "staged-" : "") + id.lowercased()
        return root.appendingPathComponent(scope, isDirectory: true).appendingPathComponent(name, isDirectory: true)
    }

    private func sql(_ sql: String, _ values: [String] = []) throws {
        _ = try query(sql, values) { _ in () }
    }

    private func query<T>(_ sql: String, _ values: [String], map: (OpaquePointer) throws -> T) throws -> [T] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement
        else { throw OutboxError.storage }
        defer { sqlite3_finalize(statement) }
        for (index, value) in values.enumerated() {
            guard sqlite3_bind_text(statement, Int32(index + 1), value, -1, transient) == SQLITE_OK
            else { throw OutboxError.storage }
        }
        var result: [T] = []
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW {
            result.append(try map(statement))
            status = sqlite3_step(statement)
        }
        guard status == SQLITE_DONE else { throw OutboxError.storage }
        return result
    }

    private func optionalString(_ statement: OpaquePointer, _ column: Int32) -> String? {
        sqlite3_column_text(statement, column).map { String(cString: $0) }
    }

    private func string(_ statement: OpaquePointer, _ column: Int32) throws -> String {
        guard let value = optionalString(statement, column) else { throw OutboxError.storage }
        return value
    }
}
