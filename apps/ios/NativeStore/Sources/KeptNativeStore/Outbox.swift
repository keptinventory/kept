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

/// Durable terminal state for a capture: only `synced` means the server confirmed
/// the record and its original attachments. `discarded` is a deliberate local deletion.
public enum CompletionState: String, Codable, Equatable {
    case synced
    case discarded
}

public struct StorageStats: Codable, Equatable {
    public let pendingCount: Int
    public let pendingBytes: Int
    public let cacheBytes: Int

    public init(pendingCount: Int, pendingBytes: Int, cacheBytes: Int) {
        self.pendingCount = pendingCount
        self.pendingBytes = pendingBytes
        self.cacheBytes = cacheBytes
    }
}

public enum OutboxError: LocalizedError, Equatable {
    case invalid, storage, storageFull, missing

    public var errorDescription: String? {
        switch self {
        case .invalid: return "This capture or file could not be saved."
        case .storage: return "Kept could not save on this iPhone. Check available storage and try again."
        case .storageFull: return "Your iPhone storage is full. Free up space and try again."
        case .missing: return "A pending original is missing. Review this capture before trying again."
        }
    }
}

/// Maps POSIX / Cocoa disk-full errors and SQLITE_FULL into `OutboxError.storageFull`,
/// preserving `.invalid` and `.missing` and turning other storage failures into `.storage`.
public func mapStorageError(_ error: Error) -> OutboxError {
    if let outbox = error as? OutboxError { return outbox }
    var current: NSError? = error as NSError
    while let ns = current {
        if ns.domain == NSCocoaErrorDomain && ns.code == CocoaError.fileWriteOutOfSpace.rawValue {
            return .storageFull
        }
        if ns.domain == NSPOSIXErrorDomain && ns.code == Int(ENOSPC) {
            return .storageFull
        }
        current = ns.userInfo[NSUnderlyingErrorKey] as? NSError
    }
    return .storage
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
    private let cacheQuotaBytes = 32 * 1024 * 1024

    public init(root: URL) throws {
        self.root = root
        do {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: root.path)
            var privateRoot = root
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try privateRoot.setResourceValues(values)
            #endif
        } catch {
            throw mapStorageError(error)
        }

        var handle: OpaquePointer?
        let openResult = sqlite3_open_v2(
            root.appendingPathComponent("outbox.sqlite").path, &handle,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil,
        )
        guard openResult == SQLITE_OK, let handle else {
            sqlite3_close(handle)
            throw openResult == SQLITE_FULL ? OutboxError.storageFull : OutboxError.storage
        }
        db = handle
        try sql("PRAGMA busy_timeout = 5000")
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
        try sql("""
            CREATE TABLE IF NOT EXISTS kv (
                context TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (context, key)
            )
            """)
        try sql("""
            CREATE TABLE IF NOT EXISTS completions (
                context TEXT NOT NULL,
                id TEXT NOT NULL,
                state TEXT NOT NULL,
                PRIMARY KEY (context, id)
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
        do {
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
        } catch {
            throw mapStorageError(error)
        }
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

        do {
            try fs.createDirectory(at: stage, withIntermediateDirectories: true)
        } catch {
            throw mapStorageError(error)
        }
        let originals = try files.map { file in
            guard UUID(uuidString: file.id) != nil, (1...perFileLimit).contains(file.bytes),
                  file.name.utf8.count <= 512, file.mime.utf8.count <= 120,
                  ["photo", "document"].contains(file.role)
            else { throw OutboxError.invalid }
            let url = stage.appendingPathComponent(file.id.lowercased())
            guard fs.fileExists(atPath: url.path) else { throw OutboxError.missing }
            let handle: FileHandle
            do {
                handle = try FileHandle(forUpdating: url)
            } catch {
                throw mapStorageError(error)
            }
            defer { try? handle.close() }
            let length: UInt64
            do {
                length = try handle.seekToEnd()
            } catch {
                throw mapStorageError(error)
            }
            guard length == UInt64(file.bytes) else { throw OutboxError.missing }
            do {
                try handle.synchronize()
                try handle.seek(toOffset: 0)
                var hasher = SHA256()
                while let bytes = try handle.read(upToCount: chunkLimit), !bytes.isEmpty {
                    hasher.update(data: bytes)
                }
                let hash = hasher.finalize().map { String(format: "%02x", $0) }.joined()
                return PendingOriginal(file: file, sha256: hash)
            } catch {
                throw mapStorageError(error)
            }
        }
        let capture = PendingCapture(id: id.lowercased(), context: context, payload: payload, takenAt: takenAt, files: originals)
        let manifest = stage.appendingPathComponent("capture.json")
        do {
            try JSONEncoder().encode(capture).write(to: manifest, options: .atomic)
            let handle = try FileHandle(forUpdating: manifest)
            defer { try? handle.close() }
            try handle.synchronize()
            try fs.moveItem(at: stage, to: final)
        } catch {
            throw mapStorageError(error)
        }
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
        guard let original = captures.first?.files.first(where: { $0.file.id.lowercased() == file.lowercased() }) else {
            throw OutboxError.missing
        }
        let url = folder.appendingPathComponent(file.lowercased())
        guard fs.fileExists(atPath: url.path) else { throw OutboxError.missing }
        return (url, original)
    }

    public func failed(context: String, id: String, reason: String) throws {
        guard UUID(uuidString: id) != nil else { throw OutboxError.invalid }
        try sql("UPDATE captures SET failure = ? WHERE context = ? AND id = ? AND completed = 0",
                [reason, context, id.lowercased()])
    }

    public func clearFailure(context: String, id: String) throws {
        guard UUID(uuidString: id) != nil else { throw OutboxError.invalid }
        try sql("UPDATE captures SET failure = NULL WHERE context = ? AND id = ? AND completed = 0",
                [context, id.lowercased()])
    }

    public func retarget(context: String, id: String, payload: String) throws -> PendingCapture {
        guard !payload.isEmpty, payload.utf8.count <= 12_000, UUID(uuidString: id) != nil
        else { throw OutboxError.invalid }
        let normalizedId = id.lowercased()
        let existing = try query(
            "SELECT manifest FROM captures WHERE context = ? AND id = ? AND completed = 0",
            [context, normalizedId]
        ) { row in try decode(try string(row, 0)) }.first
        guard let existing else { throw OutboxError.missing }
        let final = try captureFolder(context: context, id: normalizedId, staged: false)
        guard matches(existing, folder: final) else { throw OutboxError.missing }

        let updated = PendingCapture(
            id: existing.id,
            context: existing.context,
            payload: payload,
            takenAt: existing.takenAt,
            files: existing.files
        )
        let manifest = final.appendingPathComponent("capture.json")
        do {
            try JSONEncoder().encode(updated).write(to: manifest, options: .atomic)
            let handle = try FileHandle(forUpdating: manifest)
            defer { try? handle.close() }
            try handle.synchronize()
        } catch {
            throw mapStorageError(error)
        }
        let encoded = String(decoding: try JSONEncoder().encode(updated), as: UTF8.self)
        try sql(
            "UPDATE captures SET manifest = ?, failure = NULL WHERE context = ? AND id = ? AND completed = 0",
            [encoded, context, normalizedId]
        )
        return updated
    }

    public func complete(context: String, id: String) throws {
        try finish(context: context, id: id, state: .synced)
    }

    /// Deliberate local deletion. Recorded distinctly from a server-confirmed sync so
    /// disappearance from the pending queue is never mistaken for synchronization.
    public func discard(context: String, id: String) throws {
        try finish(context: context, id: id, state: .discarded)
    }

    private func finish(context: String, id: String, state: CompletionState) throws {
        try sql("""
            INSERT INTO completions (context, id, state) VALUES (?, ?, ?)
            ON CONFLICT (context, id) DO UPDATE SET state = EXCLUDED.state
            """, [context, id.lowercased(), state.rawValue])
        // Record confirmation durably before removing file bytes. Repair never reopens a
        // completed capture even if the app stops before file cleanup finishes.
        try sql("UPDATE captures SET completed = 1 WHERE context = ? AND id = ?", [context, id.lowercased()])
        try cleanupCompleted(context: context, id: id)
    }

    private func cleanupCompleted(context: String, id: String) throws {
        let folder = try captureFolder(context: context, id: id, staged: false)
        if fs.fileExists(atPath: folder.path) {
            do { try fs.removeItem(at: folder) }
            catch { return }
        }
        try sql("DELETE FROM captures WHERE context = ? AND id = ? AND completed = 1", [context, id.lowercased()])
    }

    public func completions(context: String) throws -> [String: CompletionState] {
        let rows = try query("SELECT id, state FROM completions WHERE context = ?", [context]) { row in
            (try string(row, 0), try string(row, 1))
        }
        var result: [String: CompletionState] = [:]
        for (id, raw) in rows {
            if let state = CompletionState(rawValue: raw) { result[id] = state }
        }
        return result
    }

    // MARK: Held-work recovery (post-restore)

    /// Contexts are `origin|account|epoch`. Held work shares the configured origin and
    /// canonical account with the current session but carries an older epoch, so the
    /// ordinary epoch guard correctly refuses automatic replay. Email alone never proves
    /// identity: only the authenticated session's canonical account is compared.
    public static func isHeldContext(_ candidate: String, current: String) -> Bool {
        guard candidate != current else { return false }
        let held = candidate.split(separator: "|", omittingEmptySubsequences: false)
        let active = current.split(separator: "|", omittingEmptySubsequences: false)
        guard held.count == 3, active.count == 3,
              !held[0].isEmpty, !held[1].isEmpty, !held[2].isEmpty, !active[2].isEmpty
        else { return false }
        return held[0] == active[0] && held[1] == active[1] && held[2] != active[2]
    }

    public func heldContexts(current: String) throws -> [String] {
        let contexts = try query(
            "SELECT DISTINCT context FROM captures WHERE completed = 0", []
        ) { row in try string(row, 0) }
        return contexts.filter { Self.isHeldContext($0, current: current) }
    }

    public func heldEntries(current: String) throws -> [OutboxEntry] {
        try heldContexts(current: current).flatMap { try pending(context: $0) }
    }

    public func cache(context: String) throws -> String? {
        try query("SELECT contents FROM cache WHERE context = ?", [context]) { row in
            try string(row, 0)
        }.first
    }

    public func saveCache(context: String, contents: String) throws {
        guard !context.isEmpty, context.utf8.count <= 1024 else { throw OutboxError.invalid }
        guard contents.utf8.count <= cacheQuotaBytes else { throw OutboxError.storage }
        try sql("""
            INSERT INTO cache (context, contents) VALUES (?, ?)
            ON CONFLICT (context) DO UPDATE SET contents = EXCLUDED.contents
            """, [context, contents])
    }

    public func clearCache(context: String) throws {
        try sql("DELETE FROM cache WHERE context = ?", [context])
    }

    public func readValue(context: String, key: String) throws -> String? {
        guard !context.isEmpty, context.utf8.count <= 1024,
              !key.isEmpty, key.utf8.count <= 256
        else { throw OutboxError.invalid }
        return try query("SELECT value FROM kv WHERE context = ? AND key = ?", [context, key]) { row in
            try string(row, 0)
        }.first
    }

    public func saveValue(context: String, key: String, value: String) throws {
        guard !context.isEmpty, context.utf8.count <= 1024,
              !key.isEmpty, key.utf8.count <= 256,
              value.utf8.count <= 65_536
        else { throw OutboxError.invalid }
        try sql("""
            INSERT INTO kv (context, key, value) VALUES (?, ?, ?)
            ON CONFLICT (context, key) DO UPDATE SET value = EXCLUDED.value
            """, [context, key, value])
    }

    public func deleteValue(context: String, key: String) throws {
        guard !context.isEmpty, context.utf8.count <= 1024,
              !key.isEmpty, key.utf8.count <= 256
        else { throw OutboxError.invalid }
        try sql("DELETE FROM kv WHERE context = ? AND key = ?", [context, key])
    }

    public func stats(context: String) throws -> StorageStats {
        let entries = try pending(context: context)
        let pendingBytes = entries.reduce(0) { sum, entry in
            sum + entry.capture.files.reduce(0) { $0 + $1.file.bytes }
        }
        let cacheBytes = try query(
            "SELECT COALESCE(length(CAST(contents AS BLOB)), 0) FROM cache WHERE context = ?",
            [context]
        ) { row in
            Int(sqlite3_column_int64(row, 0))
        }.first ?? 0
        return StorageStats(pendingCount: entries.count, pendingBytes: pendingBytes, cacheBytes: cacheBytes)
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
        for (context, id) in completed { try cleanupCompleted(context: context, id: id) }
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
        let prepStatus = sqlite3_prepare_v2(db, sql, -1, &statement, nil)
        guard prepStatus == SQLITE_OK, let statement else {
            throw prepStatus == SQLITE_FULL ? OutboxError.storageFull : OutboxError.storage
        }
        defer { sqlite3_finalize(statement) }
        for (index, value) in values.enumerated() {
            let bindStatus = sqlite3_bind_text(statement, Int32(index + 1), value, -1, transient)
            guard bindStatus == SQLITE_OK else {
                throw bindStatus == SQLITE_FULL ? OutboxError.storageFull : OutboxError.storage
            }
        }
        var result: [T] = []
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW {
            result.append(try map(statement))
            status = sqlite3_step(statement)
        }
        guard status == SQLITE_DONE else {
            throw status == SQLITE_FULL ? OutboxError.storageFull : OutboxError.storage
        }
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
