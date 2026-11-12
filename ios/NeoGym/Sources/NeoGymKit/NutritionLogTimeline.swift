import Foundation

/// One row of the Nutrition › Log timeline: a logged time slot, or a slot from
/// the day's selected plan that has not been logged yet.
public enum NutritionTimelineItem: Sendable, Identifiable {
    case logged(IntakeTimeSlot)
    case planned(NutritionPlanTimeSlot<NutritionPlanEntry>)

    public var id: String {
        switch self {
        case let .logged(slot): "logged-\(slot.key)"
        case let .planned(slot): "planned-\(slot.key)"
        }
    }

    public var key: String {
        switch self {
        case let .logged(slot): slot.key
        case let .planned(slot): slot.key
        }
    }

    public var sortKey: String {
        switch self {
        case let .logged(slot): slot.sortKey
        case let .planned(slot): slot.sortKey
        }
    }

    public var isLogged: Bool {
        if case .logged = self { return true }
        return false
    }

    public var kcal: Double {
        switch self {
        case let .logged(slot): slot.totals.kcal
        case let .planned(slot): slot.totals.kcal
        }
    }
}

public extension NutritionTimeline {
    /// Logged slots plus selected-plan slots, in time order. A planned slot is
    /// hidden once a logged slot has the same time.
    static func items(
        day: NutritionDay?,
        selectedPlan: NutritionPlan?,
        locale: Locale = .current
    ) -> [NutritionTimelineItem] {
        let logged = day?.intakeSlots ?? []
        let loggedKeys = Set(logged.map(\.key))
        let planned = selectedPlan.map {
            NutritionPlanGrouping.groupPlanEntriesByTimeSlot($0.sortedEntries, locale: locale)
        } ?? []
        let items = logged.map(NutritionTimelineItem.logged)
            + planned.filter { !loggedKeys.contains($0.key) }.map(NutritionTimelineItem.planned)
        return items.sorted { left, right in
            if left.sortKey != right.sortKey { return left.sortKey < right.sortKey }
            return left.isLogged && !right.isLogged
        }
    }

    /// Open by default: the latest logged slot and the first slot still planned.
    static func defaultExpandedIds(_ items: [NutritionTimelineItem]) -> Set<String> {
        var ids = Set<String>()
        if let lastLogged = items.last(where: \.isLogged) { ids.insert(lastLogged.id) }
        if let firstPlanned = items.first(where: { !$0.isLogged }) { ids.insert(firstPlanned.id) }
        return ids
    }

    /// "5 foods", "2 meals, 1 food" for a logged slot.
    static func loggedCountLabel(_ slot: IntakeTimeSlot) -> String {
        let meals = slot.mealGroups.count
        let foods = slot.entries.filter { $0.kind == .standalone }.count
        var parts: [String] = []
        if meals > 0 { parts.append("\(meals) \(meals == 1 ? "meal" : "meals")") }
        if foods > 0 { parts.append("\(foods) \(foods == 1 ? "food" : "foods")") }
        return parts.isEmpty ? "No entries" : parts.joined(separator: ", ")
    }
}

/// The Monday-to-Sunday strip above the day log.
public enum NutritionWeekStrip {
    public static func days(containing date: String, calendar: Calendar = .current) -> [String] {
        var calendar = calendar
        calendar.firstWeekday = 2
        let anchor = IntakeGrouping.localDateToDate(date, calendar: calendar) ?? Date()
        let start = calendar.dateInterval(of: .weekOfYear, for: anchor)?.start ?? anchor
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: start).map {
                IntakeGrouping.formatLocalDate($0, calendar: calendar)
            }
        }
    }

    /// Exact date range for the week's calorie read (no warm-up days).
    public static func range(containing date: String, calendar: Calendar = .current) -> ChartHistoryRange {
        let days = days(containing: date, calendar: calendar)
        return ChartHistoryRange(from: days.first ?? date, through: days.last ?? date)
    }

    public static func kcalByDate(_ history: NutritionCalorieHistory?) -> [String: Double] {
        Dictionary((history?.days ?? []).map { ($0.logDate, $0.calories) }, uniquingKeysWith: { _, newer in newer })
    }
}
