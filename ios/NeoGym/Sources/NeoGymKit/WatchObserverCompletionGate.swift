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

/// Serializes a HealthKit callback's local handoff with observer shutdown.
/// A callback from an old account may still arrive after stop(query); it must
/// not replace a new owner's pending marker.
public final class WatchObserverRegistrationGate: @unchecked Sendable {
    private let lock = NSLock()
    private var active = true

    public init() {}

    @discardableResult
    public func runIfActive(_ handoff: () -> Void) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard active else { return false }
        handoff()
        return true
    }

    public func invalidate() {
        lock.lock()
        defer { lock.unlock() }
        active = false
    }
}
