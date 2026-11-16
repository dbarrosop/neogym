import Foundation

/// A renderable entry. Its display is formatted for the entry's own date, so the
/// local-midnight entry drops estimates and relabels the day without a new fetch.
public struct EnergyBalanceWidgetTimelineEntry: Sendable, Equatable {
    public let date: Date
    public let snapshot: EnergyBalanceWidgetSnapshot?
    public let display: EnergyBalanceDisplay?

    public init(
        date: Date,
        snapshot: EnergyBalanceWidgetSnapshot?,
        calendar: Calendar = .current,
        locale: Locale = .current
    ) {
        self.date = date
        self.snapshot = snapshot
        display = snapshot.map { EnergyBalanceDisplay($0.displayInput, at: date, calendar: calendar, locale: locale) }
    }
}

/// Schedules the day change without requiring another live fetch or provider execution.
public struct EnergyBalanceWidgetTimeline: Sendable, Equatable {
    public let entries: [EnergyBalanceWidgetTimelineEntry]
    public let reloadAfter: Date
    public let refreshDecision: EnergyBalanceWidgetLiveRefreshDecision

    init(result: EnergyBalanceWidgetLiveRefreshResult, date: Date, calendar: Calendar, locale: Locale) {
        let entry = EnergyBalanceWidgetTimelineEntry(
            date: date, snapshot: result.snapshot, calendar: calendar, locale: locale
        )
        var entries = [entry]
        if entry.display?.isCurrentDay == true,
           let midnight = calendar.dateInterval(of: .day, for: date)?.end {
            // Reuse recorded values, but the new local date makes "today so far"
            // and yesterday's estimates ineligible.
            entries.append(EnergyBalanceWidgetTimelineEntry(
                date: midnight, snapshot: result.snapshot, calendar: calendar, locale: locale
            ))
        }
        self.entries = entries
        refreshDecision = result.decision
        let reloadInterval: TimeInterval = result.decision == .emptyState ? 15 * 60 : 30 * 60
        reloadAfter = date.addingTimeInterval(reloadInterval)
    }
}
