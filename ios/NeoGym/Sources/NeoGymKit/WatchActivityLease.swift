import Foundation

/// Main-actor guard against a queued expiry cancelling a newer operation
/// using the same activity key. An ended generation has no expiry callback.
@MainActor
public final class WatchActivityExpiryGate {
    private var current: [String: (id: UUID, onExpire: @MainActor () -> Void)] = [:]

    public init() {}

    public func register(_ key: String, id: UUID, onExpire: @escaping @MainActor () -> Void) {
        current[key] = (id, onExpire)
    }

    public func matches(_ key: String, id: UUID) -> Bool {
        current[key]?.id == id
    }

    public func remove(_ key: String) {
        current.removeValue(forKey: key)
    }

    @discardableResult
    public func expire(_ key: String, id: UUID) -> Bool {
        guard let entry = current[key], entry.id == id else { return false }
        current.removeValue(forKey: key)
        entry.onExpire()
        return true
    }
}

/// Best-effort assertion lifetime. A local deadline releases the assertion,
/// but only a system expiry may ask the caller to cancel an auth operation.
/// Neither event guarantees that watchOS keeps the process running.
public final class WatchActivityLease: @unchecked Sendable {
    private let onSystemExpiry: @Sendable () -> Void
    private let signal = DispatchSemaphore(value: 0)
    private let lock = NSLock()
    private var ended = false

    public init(onSystemExpiry: @escaping @Sendable () -> Void) {
        self.onSystemExpiry = onSystemExpiry
    }

    public func waitUntilEnded(limit: DispatchTimeInterval = .seconds(20)) {
        if signal.wait(timeout: .now() + limit) == .timedOut { end() }
    }

    public func systemExpired() {
        guard finish() else { return }
        onSystemExpiry()
    }

    public func end() {
        _ = finish()
    }

    private func finish() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !ended else { return false }
        ended = true
        signal.signal()
        return true
    }
}
