import Foundation

/// Best-effort watchOS scheduling policy. A preferred date is never a promise
/// of a wake; remembering it only coalesces duplicate requests in this process.
public struct WatchRefreshSchedule: Sendable {
    public private(set) var pendingPreferredDate: Date?
    public private(set) var consecutiveFailures = 0
    private var pendingRetryDate: Date?
    private var pendingHealthDate: Date?

    public init() {}

    /// A suspended app cannot run a watchdog on time. When a new eligible
    /// trigger arrives, let it replace a refresh started over 30s ago rather
    /// than joining a possibly suspended or stuck in-flight task forever.
    public static func isStaleRefresh(startedAt: Date, now: Date) -> Bool {
        now.timeIntervalSince(startedAt) >= 30
    }

    public mutating func requestHourly(now: Date) -> Date? {
        request(now.addingTimeInterval(60 * 60), now: now)
    }

    /// Retry sooner after an interrupted sync or backend failure, backing off
    /// from 15 to 30 to 60 minutes. An earlier pending request always wins.
    public mutating func requestRetry(now: Date) -> Date? {
        // A second failure from the same observer/refresh before its retry wake
        // must not advance backoff or replace the earlier pending request.
        if let pendingRetryDate, pendingRetryDate > now { return nil }
        consecutiveFailures = min(3, consecutiveFailures + 1)
        let delay = TimeInterval(15 * 60 * (1 << (consecutiveFailures - 1)))
        let date = request(now.addingTimeInterval(delay), now: now)
        pendingRetryDate = date ?? pendingPreferredDate
        return date
    }

    /// A HealthKit callback was locally persisted; prefer a sooner fallback
    /// wake without counting it as a failed sync. Bursts share one request.
    public mutating func requestPendingHealth(now: Date) -> Date? {
        if let pendingHealthDate, pendingHealthDate > now { return nil }
        let date = request(now.addingTimeInterval(15 * 60), now: now)
        pendingHealthDate = date ?? pendingPreferredDate
        return date
    }

    public mutating func didRefreshSuccessfully() { consecutiveFailures = 0 }

    public mutating func didWake() {
        pendingPreferredDate = nil
        pendingRetryDate = nil
        pendingHealthDate = nil
    }

    public mutating func didFailToSchedule(_ date: Date) {
        if pendingPreferredDate == date { pendingPreferredDate = nil }
        if pendingRetryDate == date { pendingRetryDate = nil }
        if pendingHealthDate == date { pendingHealthDate = nil }
    }

    private mutating func request(_ date: Date, now: Date) -> Date? {
        // A remembered date that has already passed is not proof the OS will
        // still deliver it. Re-arm when the app gets another chance to run.
        if let pendingPreferredDate, pendingPreferredDate > now, pendingPreferredDate <= date { return nil }
        pendingPreferredDate = date
        return date
    }
}
