import Foundation

/// A HealthKit delivery is handed off locally before acknowledging its callback.
/// Only the watch app uses this private UserDefaults key; no Health values or
/// account details are shared with the complication or exported as events.
public struct WatchPendingHealthSync: Codable, Equatable, Sendable {
    public let userID: String
    public let firstObservedAt: Date
    public let generation: UUID
}

public final class WatchPendingHealthSyncStore: @unchecked Sendable {
    private let lock = NSLock()
    private let defaults: UserDefaults
    private let key = "watchPendingHealthSync.v1"

    public init(suite: String? = nil) {
        defaults = suite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    }

    /// Returns false if the local handoff cannot be read back. Each delivery
    /// changes the generation so an in-flight sync cannot erase a newer event.
    @discardableResult
    public func markPending(for userID: String, at date: Date = Date()) -> Bool {
        guard !userID.isEmpty else { return false }
        lock.lock()
        defer { lock.unlock() }
        let previous = loadLocked()
        let firstObservedAt = previous.flatMap { $0.userID == userID ? $0.firstObservedAt : nil } ?? date
        let pending = WatchPendingHealthSync(
            userID: userID, firstObservedAt: firstObservedAt, generation: UUID()
        )
        guard let data = try? JSONEncoder().encode(pending) else { return false }
        defaults.set(data, forKey: key)
        return defaults.data(forKey: key) == data
    }

    public func pending(for userID: String) -> WatchPendingHealthSync? {
        lock.lock()
        defer { lock.unlock() }
        guard let pending = loadLocked(), pending.userID == userID else { return nil }
        return pending
    }

    /// Clear only the delivery observed before a successful Health sync, fresh
    /// backend read and snapshot save. A later observer callback stays pending.
    @discardableResult
    public func clearIfUnchanged(_ pending: WatchPendingHealthSync) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard loadLocked() == pending else { return false }
        defaults.removeObject(forKey: key)
        return loadLocked() == nil
    }

    public func clear() {
        lock.lock()
        defer { lock.unlock() }
        defaults.removeObject(forKey: key)
    }

    public func clearIfDifferentOwner(_ userID: String) {
        lock.lock()
        defer { lock.unlock() }
        if let pending = loadLocked(), pending.userID != userID {
            defaults.removeObject(forKey: key)
        }
    }

    private func loadLocked() -> WatchPendingHealthSync? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WatchPendingHealthSync.self, from: data)
    }
}
