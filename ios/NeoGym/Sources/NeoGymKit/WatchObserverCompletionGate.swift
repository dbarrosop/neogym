import Foundation

/// Finish a HealthKit observer callback or watchOS background task exactly
/// once, even when normal completion races with system expiration. Callbacks
/// may arrive on arbitrary executors.
public final class WatchCompletionGate: @unchecked Sendable {
    private let lock = NSLock()
    private let completion: () -> Void
    private var completed = false

    public init(_ completion: @escaping () -> Void) {
        self.completion = completion
    }

    /// Returns true only for the caller that invoked the completion.
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

public typealias WatchObserverCompletionGate = WatchCompletionGate

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
