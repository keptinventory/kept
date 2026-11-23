import Foundation
import XCTest
@testable import KeptNativeStore

final class BrowserAuthenticationTests: XCTestCase {
    private enum Failure: Error, Equatable {
        case couldNotStart
        case browserRejected
    }

    @MainActor
    func testSynchronousBrowserFailureFollowedByFalseResumesOnce() async {
        do {
            _ = try await BrowserAuthentication.waitForCallback(startError: Failure.couldNotStart) { complete in
                complete(.failure(Failure.browserRejected))
                return false
            }
            XCTFail("Expected the browser failure")
        } catch {
            XCTAssertEqual(error as? Failure, .browserRejected)
        }
    }

    @MainActor
    func testFalseStartFinishesEvenIfTheBrowserCallsBackLater() async {
        var lateCompletion: (@Sendable (Result<URL, Error>) -> Void)?
        do {
            _ = try await BrowserAuthentication.waitForCallback(startError: Failure.couldNotStart) { complete in
                lateCompletion = complete
                return false
            }
            XCTFail("Expected a startup failure")
        } catch {
            XCTAssertEqual(error as? Failure, .couldNotStart)
        }
        lateCompletion?(.failure(Failure.browserRejected))
    }

    @MainActor
    func testStartedSessionCanCompleteOffTheMainActor() async throws {
        let expected = try XCTUnwrap(URL(string: "kept-nfc://auth/callback"))
        let callback = try await BrowserAuthentication.waitForCallback(startError: Failure.couldNotStart) { complete in
            Task.detached {
                complete(.success(expected))
            }
            return true
        }
        XCTAssertEqual(callback, expected)
    }
}
