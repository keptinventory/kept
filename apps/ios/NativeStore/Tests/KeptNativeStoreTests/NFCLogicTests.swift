import Foundation
import XCTest
@testable import KeptNativeStore

final class NFCLogicTests: XCTestCase {
    private let origin = URL(string: "https://kept.example.com")!

    func testLabelValidationAcceptsApprovedOriginAndFoldsShortCode() {
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://kept.example.com/l/7kq4mz", expectedOrigin: origin),
            .approved(code: "7KQ4MZ")
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://KEPT.EXAMPLE.COM/l/oIl4mz", expectedOrigin: origin),
            .approved(code: "0114MZ")
        )
    }

    func testLabelValidationRejectsForeignOriginsAndMalformedPayloads() {
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://other.example.com/l/7KQ4MZ", expectedOrigin: origin),
            .foreign
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://kept.example.com:8443/l/7KQ4MZ", expectedOrigin: origin),
            .foreign
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "http://kept.example.com/l/7KQ4MZ", expectedOrigin: origin),
            .malformed
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://kept.example.com/l/7KQ4MZ?x=1", expectedOrigin: origin),
            .malformed
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://kept.example.com/l/7KQ4MZ#top", expectedOrigin: origin),
            .malformed
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "https://kept.example.com/other/7KQ4MZ", expectedOrigin: origin),
            .malformed
        )
        XCTAssertEqual(
            NFCLabelValidation.validate(urlText: "not a url", expectedOrigin: origin),
            .malformed
        )
    }

    func testRepeatDebouncerSuppressesSameTagWithinWindowAndAllowsOthers() {
        var debouncer = NFCRepeatDebouncer(window: 2.5)
        let start = Date(timeIntervalSince1970: 1_700_000_000)

        XCTAssertTrue(debouncer.shouldAccept(fingerprint: "tag-a", at: start))
        XCTAssertFalse(debouncer.shouldAccept(fingerprint: "tag-a", at: start.addingTimeInterval(1.0)))
        XCTAssertTrue(debouncer.shouldAccept(fingerprint: "tag-b", at: start.addingTimeInterval(1.2)))
        XCTAssertTrue(debouncer.shouldAccept(fingerprint: "tag-a", at: start.addingTimeInterval(1.5)))
        XCTAssertFalse(debouncer.shouldAccept(fingerprint: "tag-a", at: start.addingTimeInterval(2.5)))
        XCTAssertTrue(debouncer.shouldAccept(fingerprint: "tag-a", at: start.addingTimeInterval(4.1)))

        debouncer.reset()
        XCTAssertTrue(debouncer.shouldAccept(fingerprint: "tag-a", at: start.addingTimeInterval(4.2)))
    }

    func testRecordSnapshotFingerprintIsDeterministic() {
        let r1 = NDEFRecordSnapshot(
            typeNameFormat: 1,
            type: Data("U".utf8),
            identifier: Data(),
            payload: Data("\u{04}kept.example.com/l/7KQ4MZ".utf8)
        )
        let r2 = NDEFRecordSnapshot(
            typeNameFormat: 1,
            type: Data("U".utf8),
            identifier: Data(),
            payload: Data("\u{04}kept.example.com/l/9AB2CD".utf8)
        )
        XCTAssertEqual(NDEFRecordSnapshot.fingerprint([r1]), NDEFRecordSnapshot.fingerprint([r1]))
        XCTAssertNotEqual(NDEFRecordSnapshot.fingerprint([r1]), NDEFRecordSnapshot.fingerprint([r2]))
        XCTAssertEqual(NDEFRecordSnapshot.fingerprint([]).count, 64)
    }

    func testFindSessionGateRejectsStaleAndEmptySessions() {
        var gate = NFCFindSessionGate()
        XCTAssertFalse(gate.begin(""))
        XCTAssertFalse(gate.begin(String(repeating: "a", count: 65)))
        XCTAssertTrue(gate.acceptsCancel(sessionId: nil))
        XCTAssertFalse(gate.acceptsCommand(sessionId: nil))

        XCTAssertTrue(gate.begin("session-a"))
        XCTAssertEqual(gate.activeSessionId, "session-a")
        XCTAssertFalse(gate.begin("session-b"))

        XCTAssertTrue(gate.acceptsCommand(sessionId: "session-a"))
        XCTAssertFalse(gate.acceptsCommand(sessionId: "session-b"))
        XCTAssertFalse(gate.acceptsCommand(sessionId: nil))
        XCTAssertFalse(gate.acceptsCommand(sessionId: ""))

        XCTAssertTrue(gate.acceptsCancel(sessionId: "session-a"))
        XCTAssertFalse(gate.acceptsCancel(sessionId: "session-b"))
        XCTAssertTrue(gate.acceptsCancel(sessionId: nil))

        gate.end(sessionId: "session-b")
        XCTAssertEqual(gate.activeSessionId, "session-a")

        gate.end(sessionId: "session-a")
        XCTAssertNil(gate.activeSessionId)
        XCTAssertFalse(gate.acceptsCommand(sessionId: "session-a"))

        XCTAssertTrue(gate.begin("session-b"))
        XCTAssertEqual(gate.activeSessionId, "session-b")
    }
}
