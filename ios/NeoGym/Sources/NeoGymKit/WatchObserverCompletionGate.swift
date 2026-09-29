import Foundation

/// HealthKit's observer completion must be called exactly once, whether work
/// finishes normally or a watchdog acknowledges it after a deadline. The
/// callback is provided by HealthKit on an arbitrary executor.
public final class WatchObserverCompletionGate: @unchecked Sendable {
    private let lock = NSLock()
    private let completion: () -> Void
    private var completed = false

    public init(_ completion: @escaping () -> Void) {
        self.completion = completion
    }

    /// Returns true only for the caller that acknowledged HealthKit.
    @discardableResult
    public func complete() -> Bool {
        lock.lock()
        let shouldComplete = !completed
        completed = true
        lock.unlock()
        if shouldComplete { completion() }
        return shouldComplete
    }
}
