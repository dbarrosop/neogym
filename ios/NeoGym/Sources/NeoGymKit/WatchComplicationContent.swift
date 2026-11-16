import Foundation

/// What the token-free watch complication renders for one timeline entry.
public enum WatchComplicationContent: Equatable, Sendable {
    /// No snapshot at all: never signed in, or cleared by sign-out or a blocking phone hint.
    case notConnected
    /// Signed in, but the last snapshot belongs to an earlier local date.
    case waitingForToday
    /// Today's values. Stale data names its time instead of claiming "so far".
    case balance(EnergyBalanceDisplay, isStale: Bool)

    /// The watch prefers hourly background refreshes, so older values are labelled.
    public static let staleAfter: TimeInterval = 60 * 60

    public init(latest snapshot: WatchEnergySnapshot?, at date: Date,
                calendar: Calendar = .current, locale: Locale = .current) {
        guard let snapshot else {
            self = .notConnected
            return
        }
        let display = EnergyBalanceDisplay(snapshot.displayInput, at: date, calendar: calendar, locale: locale)
        guard display.isCurrentDay else {
            self = .waitingForToday
            return
        }
        self = .balance(display, isStale: date.timeIntervalSince(snapshot.updatedAt) >= Self.staleAfter)
    }

    /// Dates after `date` where the same snapshot renders differently: when it turns
    /// stale and at local midnight. WidgetKit renders these without running the provider.
    public static func transitionDates(for snapshot: WatchEnergySnapshot?, after date: Date,
                                       calendar: Calendar = .current) -> [Date] {
        guard let snapshot, snapshot.localDate == DateOnly.formatLocalISO(date, calendar: calendar),
              let midnight = calendar.dateInterval(of: .day, for: date)?.end else { return [] }
        let stale = snapshot.updatedAt.addingTimeInterval(staleAfter)
        return (stale > date && stale < midnight ? [stale] : []) + [midnight]
    }
}
