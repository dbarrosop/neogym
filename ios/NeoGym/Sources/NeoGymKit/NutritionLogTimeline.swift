import Foundation

/// One row of the Nutrition › Log timeline: a logged time slot, or a slot from
/// the day's selected plan. `hasLoggedFood` marks a planned slot whose time
/// already has logged food; matching times don't mean the plan was followed, so
/// the planned card stays, with a quieter Log that asks first.
public enum NutritionTimelineItem: Sendable, Identifiable {
    case logged(IntakeTimeSlot)
    case planned(NutritionPlanTimeSlot<NutritionPlanEntry>, hasLoggedFood: Bool)

    public var id: String {
        switch self {
        case let .logged(slot): "logged-\(slot.key)"
        case let .planned(slot, _): "planned-\(slot.key)"
        }
    }

    public var key: String {
        switch self {
        case let .logged(slot): slot.key
        case let .planned(slot, _): slot.key
        }
    }

    public var sortKey: String {
        switch self {
        case let .logged(slot): slot.sortKey
        case let .planned(slot, _): slot.sortKey
        }
    }

    public var isLogged: Bool {
        if case .logged = self { return true }
        return false
    }

    public var kcal: Double {
        switch self {
        case let .logged(slot): slot.totals.kcal
        case let .planned(slot, _): slot.totals.kcal
        }
    }
}

public extension NutritionTimeline {
    /// Logged slots plus every selected-plan slot, in time order, the logged
    /// slot first at a shared time. A planned slot stays beside same-time
    /// logged food (as on the web), flagged `hasLoggedFood`.
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
            + planned.map { NutritionTimelineItem.planned($0, hasLoggedFood: loggedKeys.contains($0.key)) }
        return items.sorted { left, right in
            if left.sortKey != right.sortKey { return left.sortKey < right.sortKey }
            return left.isLogged && !right.isLogged
        }
    }

    /// The first planned slot with nothing logged at its time: open by default,
    /// with the prominent Log.
    static func nextPlannedId(_ items: [NutritionTimelineItem]) -> String? {
        items.first { item in
            if case .planned(_, hasLoggedFood: false) = item { return true }
            return false
        }?.id
    }

    /// Open by default: the latest logged slot and the next planned slot.
    static func defaultExpandedIds(_ items: [NutritionTimelineItem]) -> Set<String> {
        var ids = Set<String>()
        if let lastLogged = items.last(where: \.isLogged) { ids.insert(lastLogged.id) }
        if let nextPlanned = nextPlannedId(items) { ids.insert(nextPlanned) }
        return ids
    }

    /// Message for the confirmation shown before logging a planned slot whose
    /// time already has logged food (the web dialog's wording).
    static func plannedSlotConfirmationMessage(_ slot: NutritionPlanTimeSlot<NutritionPlanEntry>) -> String {
        let count = slot.entries.count
        let items = count == 1 ? "1 planned item" : "\(count) planned items"
        guard !IntakeGrouping.timeToInputValue(slot.key).isEmpty else {
            return "Food without a time is already logged. This adds \(items) at the current time; "
                + "nothing already logged changes."
        }
        return "Food is already logged at \(slot.label). This adds \(items) at \(slot.label); "
            + "nothing already logged changes."
    }

    /// Child snapshots in their existing slot order, matched by logged group ID
    /// rather than template meal ID (the same meal may be logged more than once).
    static func loggedMealEntries(_ group: IntakeSlotMealGroup, in slot: IntakeTimeSlot) -> [IntakeSlotEntry] {
        slot.entries.filter { $0.kind == .meal && $0.mealId == group.id }
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
