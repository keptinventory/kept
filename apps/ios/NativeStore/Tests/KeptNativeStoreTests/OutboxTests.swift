import CryptoKit
import Foundation
import SQLite3
import XCTest
@testable import KeptNativeStore

final class OutboxTests: XCTestCase {
    private let context = "https://kept.example.com|account|epoch"
    private let takenAt = "2026-11-22T20:00:00Z"

    private func scratch() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: root) }
        return root
    }

    private func digest(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private func preparedCapture(in root: URL, payload: String = #"{"name":"Holiday decorations"}"#) throws -> PendingCapture {
        let outbox = try Outbox(root: root)
        let id = UUID().uuidString.lowercased()
        let file = StagedOriginal(id: UUID().uuidString.lowercased(), name: "guide.pdf",
                                  mime: "application/pdf", role: "document", bytes: 6)
        let start = Data("%PDF".utf8)
        try outbox.stage(context: context, draft: id, file: file.id, offset: 0, data: start)
        try outbox.stage(context: context, draft: id, file: file.id, offset: 0, data: start)
        XCTAssertThrowsError(try outbox.stage(context: context, draft: id, file: file.id, offset: 0, data: Data("Wrong".utf8)))
        try outbox.stage(context: context, draft: id, file: file.id, offset: start.count, data: Data("-1".utf8))
        return try outbox.commit(context: context, id: id, payload: payload,
                                 takenAt: takenAt, files: [file])
    }

    func testPersistsOriginalAndQueueAcrossReopenAndScopesEveryRead() throws {
        let root = try scratch()
        let saved = try preparedCapture(in: root)
        let file = try XCTUnwrap(saved.files.first)
        var outbox: Outbox? = try Outbox(root: root)
        XCTAssertEqual(try outbox?.pending(context: context).map(\.capture), [saved])
        XCTAssertEqual(try outbox?.pending(context: "different-account"), [])
        XCTAssertEqual(try outbox?.pending(context: "different-epoch"), [])
        XCTAssertThrowsError(try outbox?.original(context: "different-account", draft: saved.id, file: file.file.id))
        let original = try XCTUnwrap(try outbox?.original(context: context, draft: saved.id, file: file.file.id))
        let bytes = try Data(contentsOf: original.0)
        XCTAssertEqual(bytes, Data("%PDF-1".utf8))
        XCTAssertEqual(file.sha256, digest(bytes))
        try outbox?.failed(context: context, id: saved.id, reason: "needs_review")
        try outbox?.saveCache(context: context, contents: #"{"saved":true}"#)
        outbox = nil

        let restarted = try Outbox(root: root)
        XCTAssertEqual(try restarted.pending(context: context).first?.failure, "needs_review")
        XCTAssertNotNil(try restarted.cache(context: context))
        XCTAssertNil(try restarted.cache(context: "different-account"))
        try restarted.complete(context: context, id: saved.id)
        XCTAssertFalse(FileManager.default.fileExists(atPath: original.0.path))
        XCTAssertTrue(try Outbox(root: root).pending(context: context).isEmpty)
    }

    func testRepairRecoversCompleteManifestAndRemovesIncompleteStage() throws {
        let root = try scratch()
        let saved = try preparedCapture(in: root)
        let accountFolder = root.appendingPathComponent(digest(Data(context.utf8)))
        let final = accountFolder.appendingPathComponent(saved.id)
        let stage = accountFolder.appendingPathComponent("staged-" + saved.id)
        let partial = accountFolder.appendingPathComponent("staged-" + UUID().uuidString.lowercased())
        try FileManager.default.moveItem(at: final, to: stage)
        try FileManager.default.createDirectory(at: partial, withIntermediateDirectories: true)
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(root.appendingPathComponent("outbox.sqlite").path, &db), SQLITE_OK)
        XCTAssertEqual(sqlite3_exec(db, "DELETE FROM captures", nil, nil, nil), SQLITE_OK)
        sqlite3_close(db)

        let restarted = try Outbox(root: root)
        XCTAssertEqual(try restarted.pending(context: context).map(\.capture), [saved])
        XCTAssertTrue(FileManager.default.fileExists(atPath: final.path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: stage.path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: partial.path))
    }

    func testRepairCompletesFinishedCapturesWithoutResurrecting() throws {
        let root = try scratch()
        let saved = try preparedCapture(in: root)
        let accountFolder = root.appendingPathComponent(digest(Data(context.utf8)))
        let final = accountFolder.appendingPathComponent(saved.id)
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(root.appendingPathComponent("outbox.sqlite").path, &db), SQLITE_OK)
        XCTAssertEqual(sqlite3_exec(db, "UPDATE captures SET completed = 1", nil, nil, nil), SQLITE_OK)
        sqlite3_close(db)

        let restarted = try Outbox(root: root)
        XCTAssertTrue(try restarted.pending(context: context).isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: final.path))
    }

    func testMissingOriginalNeverAcknowledgesSave() throws {
        let root = try scratch()
        let outbox = try Outbox(root: root)
        let id = UUID().uuidString.lowercased()
        let file = StagedOriginal(id: UUID().uuidString.lowercased(), name: "photo.jpg",
                                  mime: "image/jpeg", role: "photo", bytes: 10)
        try outbox.stage(context: context, draft: id, file: file.id, offset: 0, data: Data("partial".utf8))
        XCTAssertThrowsError(try outbox.commit(context: context, id: id, payload: "{}", takenAt: takenAt, files: [file]))
        XCTAssertTrue(try outbox.pending(context: context).isEmpty)
    }

    func testCacheQuotaAndClearCacheNeverEvictPendingOriginals() throws {
        let root = try scratch()
        let saved = try preparedCapture(in: root)
        let outbox = try Outbox(root: root)
        let huge = String(repeating: "x", count: 32 * 1024 * 1024 + 1)
        XCTAssertThrowsError(try outbox.saveCache(context: context, contents: huge))
        try outbox.saveCache(context: context, contents: #"{"cached":true}"#)
        try outbox.clearCache(context: context)
        XCTAssertNil(try outbox.cache(context: context))
        XCTAssertEqual(try outbox.pending(context: context).map(\.capture), [saved])
        let file = try XCTUnwrap(saved.files.first)
        let original = try outbox.original(context: context, draft: saved.id, file: file.file.id)
        XCTAssertEqual(try Data(contentsOf: original.0), Data("%PDF-1".utf8))
    }

    func testRetargetAndClearFailurePreserveOriginalsAcrossReopen() throws {
        let root = try scratch()
        let saved = try preparedCapture(in: root, payload: #"{"boxId":"old-box","name":"Winter coats"}"#)
        let file = try XCTUnwrap(saved.files.first)
        let outbox = try Outbox(root: root)
        try outbox.failed(context: context, id: saved.id, reason: "target_trashed")
        try outbox.clearFailure(context: context, id: saved.id)
        XCTAssertNil(try outbox.pending(context: context).first?.failure)

        try outbox.failed(context: context, id: saved.id, reason: "target_missing")
        let retargeted = try outbox.retarget(
            context: context,
            id: saved.id,
            payload: #"{"boxId":"new-box","name":"Winter coats"}"#
        )
        XCTAssertEqual(retargeted.files, saved.files)
        XCTAssertEqual(retargeted.payload, #"{"boxId":"new-box","name":"Winter coats"}"#)

        let reopened = try Outbox(root: root)
        let entry = try XCTUnwrap(reopened.pending(context: context).first)
        XCTAssertNil(entry.failure)
        XCTAssertEqual(entry.capture.payload, #"{"boxId":"new-box","name":"Winter coats"}"#)
        let original = try reopened.original(context: context, draft: saved.id, file: file.file.id)
        XCTAssertEqual(try Data(contentsOf: original.0), Data("%PDF-1".utf8))
        XCTAssertEqual(original.1.sha256, file.sha256)
    }

    func testKeyValuePersistenceAndStats() throws {
        let root = try scratch()
        _ = try preparedCapture(in: root)
        let outbox = try Outbox(root: root)
        let cacheText = #"{"boxes":1}"#
        try outbox.saveCache(context: context, contents: cacheText)
        try outbox.saveValue(context: context, key: "findTarget", value: #"{"id":"box-1","name":"Holiday"}"#)

        let stats = try outbox.stats(context: context)
        XCTAssertEqual(stats, StorageStats(pendingCount: 1, pendingBytes: 6, cacheBytes: cacheText.utf8.count))

        let reopened = try Outbox(root: root)
        XCTAssertEqual(try reopened.readValue(context: context, key: "findTarget"), #"{"id":"box-1","name":"Holiday"}"#)
        XCTAssertNil(try reopened.readValue(context: "other-context", key: "findTarget"))
        try reopened.deleteValue(context: context, key: "findTarget")
        XCTAssertNil(try reopened.readValue(context: context, key: "findTarget"))
    }

    func testCompletionsDistinguishSyncedFromDiscardedAcrossReopen() throws {
        let root = try scratch()
        let synced = try preparedCapture(in: root)
        let discarded = try preparedCapture(in: root)
        let outbox = try Outbox(root: root)
        try outbox.complete(context: context, id: synced.id)
        try outbox.discard(context: context, id: discarded.id)
        XCTAssertTrue(try outbox.pending(context: context).isEmpty)

        let reopened = try Outbox(root: root)
        let states = try reopened.completions(context: context)
        XCTAssertEqual(states[synced.id], .synced)
        XCTAssertEqual(states[discarded.id], .discarded)
        XCTAssertTrue(try reopened.completions(context: "other|account|epoch").isEmpty)
    }

    func testRepairPreservesDiscardedCompletionState() throws {
        let root = try scratch()
        let saved = try preparedCapture(in: root)
        let accountFolder = root.appendingPathComponent(digest(Data(context.utf8)))
        let final = accountFolder.appendingPathComponent(saved.id)
        let outbox = try Outbox(root: root)
        try outbox.discard(context: context, id: saved.id)
        // Simulate a crash after recording `.discarded` and `completed = 1`, before folder/row cleanup.
        try FileManager.default.createDirectory(at: final, withIntermediateDirectories: true)
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(root.appendingPathComponent("outbox.sqlite").path, &db), SQLITE_OK)
        let stmtSql = "INSERT OR REPLACE INTO captures (id, context, manifest, completed) VALUES ('\(saved.id)', '\(context)', '{}', 1)"
        XCTAssertEqual(sqlite3_exec(db, stmtSql, nil, nil, nil), SQLITE_OK)
        sqlite3_close(db)

        let restarted = try Outbox(root: root)
        XCTAssertTrue(try restarted.pending(context: context).isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: final.path))
        XCTAssertEqual(try restarted.completions(context: context)[saved.id], .discarded)
    }

    func testHeldDiscoveryRequiresSameOriginAndAccountWithOlderEpoch() throws {
        let root = try scratch()
        let oldContext = "https://kept.example.com|account|epoch-old"
        let current = "https://kept.example.com|account|epoch-new"
        XCTAssertTrue(Outbox.isHeldContext(oldContext, current: current))
        XCTAssertFalse(Outbox.isHeldContext(current, current: current))
        XCTAssertFalse(Outbox.isHeldContext("https://kept.example.com|other|epoch-old", current: current))
        XCTAssertFalse(Outbox.isHeldContext("https://other.example.com|account|epoch-old", current: current))
        XCTAssertFalse(Outbox.isHeldContext("|account|epoch-old", current: current))
        XCTAssertFalse(Outbox.isHeldContext("https://kept.example.com||epoch-old", current: current))
        XCTAssertFalse(Outbox.isHeldContext("https://kept.example.com|account|", current: current))
        XCTAssertFalse(Outbox.isHeldContext("not-a-context", current: current))

        // Seed a capture under the old epoch, then read held work as the new session.
        let outbox = try Outbox(root: root)
        let id = UUID().uuidString.lowercased()
        let file = StagedOriginal(id: UUID().uuidString.lowercased(), name: "held.jpg",
                                  mime: "image/jpeg", role: "photo", bytes: 6)
        try outbox.stage(context: oldContext, draft: id, file: file.id, offset: 0, data: Data("%PDF-1".utf8))
        let held = try outbox.commit(context: oldContext, id: id, payload: #"{"name":"Held"}"#,
                                     takenAt: takenAt, files: [file])
        // A capture under the current context itself is ordinary pending work, never held.
        let currentId = UUID().uuidString.lowercased()
        let currentFile = StagedOriginal(id: UUID().uuidString.lowercased(), name: "now.jpg",
                                         mime: "image/jpeg", role: "photo", bytes: 6)
        try outbox.stage(context: current, draft: currentId, file: currentFile.id, offset: 0, data: Data("%PDF-1".utf8))
        let currentCapture = try outbox.commit(context: current, id: currentId, payload: #"{"name":"Now"}"#,
                                               takenAt: takenAt, files: [currentFile])
        XCTAssertEqual(try outbox.heldEntries(current: current).map(\.capture), [held])
        XCTAssertEqual(try outbox.heldEntries(current: "https://kept.example.com|other|epoch-new"), [])
        XCTAssertEqual(try outbox.heldEntries(current: "https://other.example.com|account|epoch-new"), [])
        XCTAssertEqual(try outbox.pending(context: current).map(\.capture), [currentCapture])
        let original = try outbox.original(context: oldContext, draft: held.id, file: file.id)
        XCTAssertEqual(try Data(contentsOf: original.0), Data("%PDF-1".utf8))
        try outbox.discard(context: oldContext, id: held.id)
        XCTAssertTrue(try outbox.heldEntries(current: current).isEmpty)
        XCTAssertEqual(try outbox.completions(context: oldContext)[held.id], .discarded)
    }

    func testStorageFullMappingDetectsDiskFullErrors() {
        let cocoa = NSError(domain: NSCocoaErrorDomain, code: CocoaError.fileWriteOutOfSpace.rawValue)
        XCTAssertEqual(mapStorageError(cocoa), .storageFull)
        let posix = NSError(domain: NSPOSIXErrorDomain, code: Int(ENOSPC))
        XCTAssertEqual(mapStorageError(posix), .storageFull)
        let nested = NSError(domain: "Test", code: 1, userInfo: [NSUnderlyingErrorKey: posix])
        XCTAssertEqual(mapStorageError(nested), .storageFull)
        XCTAssertEqual(mapStorageError(OutboxError.missing), .missing)
    }
}
