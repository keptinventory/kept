import Foundation

public enum BrowserAuthentication {
    /// A failed start can also call the completion handler, including before start returns.
    @MainActor
    public static func waitForCallback(
        startError: Error,
        start: (_ complete: @escaping @Sendable (Result<URL, Error>) -> Void) -> Bool
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let callback = Callback(continuation)
            if !start({ callback.complete($0) }) {
                callback.complete(.failure(startError))
            }
        }
    }

    private final class Callback: @unchecked Sendable {
        private let lock = NSLock()
        private var continuation: CheckedContinuation<URL, Error>?

        init(_ continuation: CheckedContinuation<URL, Error>) {
            self.continuation = continuation
        }

        func complete(_ result: Result<URL, Error>) {
            lock.lock()
            let pending = continuation
            continuation = nil
            lock.unlock()
            pending?.resume(with: result)
        }
    }
}
