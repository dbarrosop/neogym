import Foundation

/// A renderable entry, including the estimates eligible on its scheduled local date.
public struct EnergyBalanceWidgetTimelineEntry: Sendable, Equatable {
    public let date: Date
    public let snapshot: EnergyBalanceWidgetSnapshot?
    public let estimatedBurnedValue: String?
    public let estimatedNetValue: String?

    public init(
        date: Date,
        snapshot: EnergyBalanceWidgetSnapshot?,
        calendar: Calendar = .current
    ) {
        self.date = date
        self.snapshot = snapshot
        let isSnapshotDay = snapshot?.localDate == DateOnly.formatLocalISO(date, calendar: calendar)
        estimatedBurnedValue = isSnapshotDay ? snapshot?.estimatedBurnedValue : nil
        estimatedNetValue = isSnapshotDay ? snapshot?.estimatedNetValue : nil
    }
}

/// Schedules estimate expiry without requiring another live fetch or provider execution.
public struct EnergyBalanceWidgetTimeline: Sendable, Equatable {
    public let entries: [EnergyBalanceWidgetTimelineEntry]
    public let reloadAfter: Date
    public let refreshDecision: EnergyBalanceWidgetLiveRefreshDecision

    init(result: EnergyBalanceWidgetLiveRefreshResult, date: Date, calendar: Calendar) {
        let entry = EnergyBalanceWidgetTimelineEntry(date: date, snapshot: result.snapshot, calendar: calendar)
        var entries = [entry]
        if entry.estimatedBurnedValue != nil || entry.estimatedNetValue != nil,
           let midnight = calendar.dateInterval(of: .day, for: date)?.end {
            // Reuse recorded values, but the new local date makes yesterday's estimates ineligible.
            entries.append(EnergyBalanceWidgetTimelineEntry(
                date: midnight,
                snapshot: result.snapshot,
                calendar: calendar
            ))
        }
        self.entries = entries
        refreshDecision = result.decision
        let reloadInterval: TimeInterval = result.decision == .emptyState ? 15 * 60 : 30 * 60
        reloadAfter = date.addingTimeInterval(reloadInterval)
    }
}
