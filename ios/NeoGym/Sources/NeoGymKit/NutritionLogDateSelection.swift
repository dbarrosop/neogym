import Foundation

/// The Nutrition Log follows the local day until the user browses another date.
/// An explicit Today shortcut always resumes following today.
public struct NutritionLogDateSelection: Equatable, Sendable {
    public private(set) var date: String
    public private(set) var today: String

    public init(now: Date = AppClock.now(), calendar: Calendar = AppClock.calendar) {
        let today = IntakeGrouping.formatLocalDate(now, calendar: calendar)
        self.today = today
        date = today
    }

    public mutating func select(_ date: String) {
        guard IntakeGrouping.isValidLocalDate(date) else { return }
        self.date = date
    }

    public mutating func showToday(now: Date = AppClock.now(), calendar: Calendar = AppClock.calendar) {
        today = IntakeGrouping.formatLocalDate(now, calendar: calendar)
        date = today
    }

    /// Handles foreground return, midnight and clock/time-zone changes without
    /// discarding a deliberately browsed historical (or future) date.
    public mutating func refreshToday(now: Date = AppClock.now(), calendar: Calendar = AppClock.calendar) {
        let newToday = IntakeGrouping.formatLocalDate(now, calendar: calendar)
        if date == today { date = newToday }
        today = newToday
    }
}
