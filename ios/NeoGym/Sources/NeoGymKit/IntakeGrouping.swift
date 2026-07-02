import Foundation

public struct IntakeEntry: Sendable {
    public var id: String
    public var nutritionLogMealId: String?
    public var source: NutritionLogEntrySource
    public var grams: JSONValue?
    public var position: Double
    public var slotTime: String?
    public var snapshotFoodName: String
    public var snapshotKcalPer100g: JSONValue?
    public var snapshotFatPer100g: JSONValue?
    public var snapshotCarbsPer100g: JSONValue?
    public var snapshotProteinPer100g: JSONValue?
    public var snapshotFiberPer100g: JSONValue?
    public var snapshotSugarPer100g: JSONValue?

    public init(
        id: String,
        nutritionLogMealId: String? = nil,
        source: NutritionLogEntrySource = .food,
        grams: JSONValue? = nil,
        position: Double = 0,
        slotTime: String? = nil,
        snapshotFoodName: String,
        snapshotKcalPer100g: JSONValue? = nil,
        snapshotFatPer100g: JSONValue? = nil,
        snapshotCarbsPer100g: JSONValue? = nil,
        snapshotProteinPer100g: JSONValue? = nil,
        snapshotFiberPer100g: JSONValue? = nil,
        snapshotSugarPer100g: JSONValue? = nil
    ) {
        self.id = id
        self.nutritionLogMealId = nutritionLogMealId
        self.source = source
        self.grams = grams
        self.position = position
        self.slotTime = slotTime
        self.snapshotFoodName = snapshotFoodName
        self.snapshotKcalPer100g = snapshotKcalPer100g
        self.snapshotFatPer100g = snapshotFatPer100g
        self.snapshotCarbsPer100g = snapshotCarbsPer100g
        self.snapshotProteinPer100g = snapshotProteinPer100g
        self.snapshotFiberPer100g = snapshotFiberPer100g
        self.snapshotSugarPer100g = snapshotSugarPer100g
    }

    public var isAdHoc: Bool { source == .adHoc }

    public var loggedSnapshot: LoggedSnapshotEntry {
        LoggedSnapshotEntry(
            grams: grams,
            snapshotKcalPer100g: snapshotKcalPer100g,
            snapshotFatPer100g: snapshotFatPer100g,
            snapshotCarbsPer100g: snapshotCarbsPer100g,
            snapshotProteinPer100g: snapshotProteinPer100g,
            snapshotFiberPer100g: snapshotFiberPer100g,
            snapshotSugarPer100g: snapshotSugarPer100g
        )
    }
}

public struct IntakeLoggedMealGroup: Sendable {
    public var id: String
    public var mealId: String?
    public var nutritionPlanMealId: String?
    public var name: String
    public var slotTime: String?
    public var position: Double
    public var nutritionLogEntries: [IntakeEntry]

    public init(
        id: String,
        mealId: String? = nil,
        nutritionPlanMealId: String? = nil,
        name: String,
        slotTime: String? = nil,
        position: Double = 0,
        nutritionLogEntries: [IntakeEntry] = []
    ) {
        self.id = id
        self.mealId = mealId
        self.nutritionPlanMealId = nutritionPlanMealId
        self.name = name
        self.slotTime = slotTime
        self.position = position
        self.nutritionLogEntries = nutritionLogEntries
    }
}

public struct IntakeSlotMealGroup: Sendable, Equatable {
    public var id: String
    public var mealId: String?
    public var nutritionPlanMealId: String?
    public var name: String
    public var slotTime: String?
    public var position: Double
    public var entryCount: Int

    public init(
        id: String,
        mealId: String? = nil,
        nutritionPlanMealId: String? = nil,
        name: String,
        slotTime: String? = nil,
        position: Double,
        entryCount: Int
    ) {
        self.id = id
        self.mealId = mealId
        self.nutritionPlanMealId = nutritionPlanMealId
        self.name = name
        self.slotTime = slotTime
        self.position = position
        self.entryCount = entryCount
    }
}

public enum IntakeSlotEntryKind: Sendable, Equatable {
    case meal
    case standalone
}

public struct IntakeSlotEntry: Sendable {
    public var kind: IntakeSlotEntryKind
    public var entry: IntakeEntry
    public var mealId: String?
    public var mealName: String?

    public init(kind: IntakeSlotEntryKind, entry: IntakeEntry, mealId: String?, mealName: String?) {
        self.kind = kind
        self.entry = entry
        self.mealId = mealId
        self.mealName = mealName
    }
}

public struct IntakeTimeSlot: Sendable {
    public var key: String
    public var label: String
    public var sortKey: String
    public var entries: [IntakeSlotEntry]
    public var mealGroups: [IntakeSlotMealGroup]
    public var totals: MacroTotals

    public init(
        key: String,
        label: String,
        sortKey: String,
        entries: [IntakeSlotEntry],
        mealGroups: [IntakeSlotMealGroup],
        totals: MacroTotals
    ) {
        self.key = key
        self.label = label
        self.sortKey = sortKey
        self.entries = entries
        self.mealGroups = mealGroups
        self.totals = totals
    }
}

public enum IntakeGrouping {
    private static let localDatePattern = #"^(\d{4})-(\d{2})-(\d{2})$"#
    private static let timeOfDayPattern = #"^(\d{2}):(\d{2})"#
    private static let noTimeSlotKey = "no-time"
    private static let noTimeSortKey = "99:99"

    public static func groupIntakeByTimeSlot(
        mealGroups: [IntakeLoggedMealGroup],
        standaloneEntries: [IntakeEntry],
        locale: Locale = .current
    ) -> [IntakeTimeSlot] {
        var slots: [String: MutableIntakeTimeSlot] = [:]

        for meal in mealGroups {
            var slot = ensureSlot(meal.slotTime, in: &slots, locale: locale)
            slot.sourceUnits.append(.meal(
                id: meal.id,
                position: meal.position,
                meal: metadata(for: meal),
                entries: meal.nutritionLogEntries
            ))
            slots[slot.key] = slot
        }

        for entry in standaloneEntries {
            var slot = ensureSlot(entry.slotTime, in: &slots, locale: locale)
            slot.sourceUnits.append(.standalone(id: entry.id, position: entry.position, entry: entry))
            slots[slot.key] = slot
        }

        return slots.values
            .map(intakeTimeSlot)
            .sorted { $0.sortKey < $1.sortKey }
    }

    private static func ensureSlot(
        _ slotTime: String?,
        in slots: inout [String: MutableIntakeTimeSlot],
        locale: Locale
    ) -> MutableIntakeTimeSlot {
        let inputValue = timeToInputValue(slotTime)
        let key = inputValue.isEmpty ? noTimeSlotKey : inputValue
        if let slot = slots[key] {
            return slot
        }
        let slot = MutableIntakeTimeSlot(
            key: key,
            label: inputValue.isEmpty ? "No time" : formatTimeOfDay(inputValue, locale: locale),
            sortKey: inputValue.isEmpty ? noTimeSortKey : inputValue,
            sourceUnits: []
        )
        slots[key] = slot
        return slot
    }

    private static func metadata(for meal: IntakeLoggedMealGroup) -> IntakeSlotMealGroup {
        IntakeSlotMealGroup(
            id: meal.id,
            mealId: meal.mealId,
            nutritionPlanMealId: meal.nutritionPlanMealId,
            name: meal.name,
            slotTime: meal.slotTime,
            position: meal.position,
            entryCount: meal.nutritionLogEntries.count
        )
    }

    private static func intakeTimeSlot(from slot: MutableIntakeTimeSlot) -> IntakeTimeSlot {
        let sourceUnits = slot.sourceUnits.sorted(by: compareIntakeSourceUnits)
        let entries = sourceUnits.flatMap(slotEntries)
        let mealGroups = sourceUnits.compactMap(mealGroup)
        return IntakeTimeSlot(
            key: slot.key,
            label: slot.label,
            sortKey: slot.sortKey,
            entries: entries,
            mealGroups: mealGroups,
            totals: NutritionMath.loggedMacroTotals(entries.map { $0.entry.loggedSnapshot })
        )
    }

    private static func slotEntries(for sourceUnit: IntakeSourceUnit) -> [IntakeSlotEntry] {
        switch sourceUnit {
        case let .standalone(_, _, entry):
            return [IntakeSlotEntry(kind: .standalone, entry: entry, mealId: nil, mealName: nil)]
        case let .meal(_, _, meal, entries):
            return entries.sorted(by: compareIntakeEntries).map { entry in
                IntakeSlotEntry(kind: .meal, entry: entry, mealId: meal.id, mealName: meal.name)
            }
        }
    }

    private static func mealGroup(for sourceUnit: IntakeSourceUnit) -> IntakeSlotMealGroup? {
        guard case let .meal(_, _, meal, _) = sourceUnit else { return nil }
        return meal
    }

    public static func formatLocalDate(_ date: Date = Date(), calendar: Calendar = .current) -> String {
        DateOnly.formatLocalISO(date, calendar: calendar)
    }

    public static func currentTimeInputValue(_ date: Date = Date(), calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
    }

    public static func isValidLocalDate(_ value: String) -> Bool {
        guard let match = firstMatch(pattern: localDatePattern, in: value), match.count == 4,
              let year = Int(match[1]),
              let month = Int(match[2]),
              let day = Int(match[3])
        else {
            return false
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone.current
        guard let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else {
            return false
        }
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return components.year == year && components.month == month && components.day == day
    }

    public static func localDateToDate(_ value: String, calendar: Calendar = .current) -> Date? {
        guard isValidLocalDate(value) else { return nil }
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    public static func addLocalDateDays(_ value: String, days: Int, calendar: Calendar = .current) -> String {
        let start = localDateToDate(value, calendar: calendar) ?? Date()
        let date = calendar.date(byAdding: .day, value: days, to: start) ?? start
        return formatLocalDate(date, calendar: calendar)
    }

    public static func formatLocalDateLabel(
        _ value: String,
        locale: Locale = .current,
        calendar: Calendar = .current
    ) -> String {
        guard let date = localDateToDate(value, calendar: calendar) else { return value }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    public static func timeToInputValue(_ value: String?) -> String {
        guard let value,
              let match = firstMatch(pattern: timeOfDayPattern, in: value),
              match.count == 3,
              let hours = Int(match[1]),
              let minutes = Int(match[2]),
              (0 ... 23).contains(hours),
              (0 ... 59).contains(minutes)
        else {
            return ""
        }
        return "\(match[1]):\(match[2])"
    }

    public static func formatTimeOfDay(_ value: String?, locale: Locale = .current) -> String {
        let inputValue = timeToInputValue(value)
        guard !inputValue.isEmpty else { return "—" }
        let parts = inputValue.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return "—" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        let components = DateComponents(year: 2000, month: 1, day: 1, hour: parts[0], minute: parts[1])
        guard let date = calendar.date(from: components) else {
            return "—"
        }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private static func compareIntakeSourceUnits(_ left: IntakeSourceUnit, _ right: IntakeSourceUnit) -> Bool {
        let positionComparison = compareSortPosition(left.position, right.position)
        if positionComparison != 0 { return positionComparison < 0 }
        let kindComparison = sourceKindOrder(left.kind) - sourceKindOrder(right.kind)
        if kindComparison != 0 { return kindComparison < 0 }
        return left.id < right.id
    }

    private static func compareIntakeEntries(_ left: IntakeEntry, _ right: IntakeEntry) -> Bool {
        let positionComparison = compareSortPosition(left.position, right.position)
        if positionComparison != 0 { return positionComparison < 0 }
        return left.id < right.id
    }

    private static func compareSortPosition(_ left: Double, _ right: Double) -> Double {
        normalizeSortPosition(left) - normalizeSortPosition(right)
    }

    private static func normalizeSortPosition(_ value: Double) -> Double {
        value.isFinite ? value : Double.greatestFiniteMagnitude
    }

    private static func sourceKindOrder(_ kind: IntakeSourceKind) -> Int {
        kind == .meal ? 0 : 1
    }

    private static func firstMatch(pattern: String, in value: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value))
        else {
            return nil
        }
        return (0 ..< match.numberOfRanges).compactMap { index in
            guard let range = Range(match.range(at: index), in: value) else { return nil }
            return String(value[range])
        }
    }
}
