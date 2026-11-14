import Foundation

// Host-testable building blocks for the Today screen. Each summary is a pure
// function of data the app already loads (sessions, the nutrition overview and
// Body chart points), so the view only lays them out.

/// Today's sessions, the latest session overall and a seven-day count.
public struct TodayTrainingSnapshot: Decodable, Sendable, Equatable {
    public let todaySessions: [SessionDetailModel]
    public let latestSession: [SessionListItem]
    public let recentSessions: SessionCountAggregate

    public init(
        todaySessions: [SessionDetailModel] = [],
        latestSession: [SessionListItem] = [],
        recentSessions: SessionCountAggregate = SessionCountAggregate()
    ) {
        self.todaySessions = todaySessions
        self.latestSession = latestSession
        self.recentSessions = recentSessions
    }
}

public struct TodaySessionLine: Sendable, Equatable, Identifiable {
    public let id: String
    public let exerciseName: String
    public let summary: String
}

public struct TodaySessionSummary: Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let startedAt: Date?
    public let exerciseCount: Int
    public let totals: SessionStrengthTotals
    public let lines: [TodaySessionLine]
}

public struct TodayLatestSession: Sendable, Equatable {
    public let id: String
    public let name: String
    public let startedAt: Date?
}

public struct TodayTrainingSummary: Sendable, Equatable {
    public let sessions: [TodaySessionSummary]
    public let latest: TodayLatestSession?
    public let recentCount: Int

    public init(snapshot: TodayTrainingSnapshot) {
        sessions = snapshot.todaySessions.map { session in
            TodaySessionSummary(
                id: session.id,
                name: session.displayName,
                startedAt: session.startedAtDate,
                exerciseCount: session.workoutSessionExercises.count,
                totals: session.strengthTotals,
                lines: session.workoutSessionExercises.map { row in
                    TodaySessionLine(
                        id: row.id,
                        exerciseName: row.exercise.name,
                        summary: Self.rowSummary(row)
                    )
                }
            )
        }
        latest = snapshot.latestSession.first.map { item in
            TodayLatestSession(id: item.id, name: item.displayName, startedAt: item.startedAtDate)
        }
        recentCount = snapshot.recentSessions.aggregate?.count ?? 0
    }

    static func rowSummary(_ row: SessionExerciseRow) -> String {
        if row.exercise.isCardio {
            let count = row.workoutSessionCardioEntries.count
            return "\(count) \(count == 1 ? "entry" : "entries")"
        }
        let sets = row.workoutSessionStrengthSets.sorted { $0.setNumber < $1.setNumber }
        return sets.isEmpty ? "No sets yet" : StrengthSetFormatting.compactSessionSummary(sets)
    }
}

public extension StrengthSetFormatting {
    /// "80 kg × 6 · 6 · 5" when every set shares a weight, otherwise
    /// "80 kg × 6 · 85 kg × 5". Bodyweight sets read "BW".
    static func compactSessionSummary(_ sets: [SessionStrengthSet]) -> String {
        guard let first = sets.first else { return "" }
        func weightLabel(_ weight: Double) -> String {
            weight == 0 ? "BW" : "\(formatWeight(weight)) kg"
        }
        if sets.allSatisfy({ $0.weight == first.weight }) {
            return "\(weightLabel(first.weight)) × " + sets.map { String($0.reps) }.joined(separator: " · ")
        }
        return sets.map { "\(weightLabel($0.weight)) × \($0.reps)" }.joined(separator: " · ")
    }

    /// Compact "last time" cell: "95 × 12", "BW × 20", or "—" when missing.
    static func lastTimeCell(_ set: SessionStrengthSet?) -> String {
        guard let set else { return "—" }
        return "\(set.weight == 0 ? "BW" : formatWeight(set.weight)) × \(set.reps)"
    }
}

/// Nutrition logged so far against the day's selected plan.
public struct TodayNutritionSummary: Sendable, Equatable {
    public let hasDay: Bool
    public let eaten: MacroTotals
    public let planName: String?
    public let planned: MacroTotals?
    public let nextSlot: TodayPlannedSlot?

    public init(day: NutritionDay?, now: Date = Date(), calendar: Calendar = .current, locale: Locale = .current) {
        hasDay = day != nil
        eaten = day?.loggedTotals ?? .empty
        let plan = day?.nutritionPlan
        planName = plan?.name
        planned = plan?.macroTotals
        guard let plan, let day else {
            nextSlot = nil
            return
        }
        let current = IntakeGrouping.currentTimeInputValue(now, calendar: calendar)
        let logged = NutritionTimeline.loggedSlotKeys(day)
        nextSlot = NutritionPlanGrouping.groupPlanEntriesByTimeSlot(plan.sortedEntries, locale: locale)
            .first { slot in
                let time = IntakeGrouping.timeToInputValue(slot.key)
                return !time.isEmpty && time > current && !logged.contains(slot.key)
            }
            .map(TodayPlannedSlot.init(slot:))
    }
}

public struct TodayPlannedSlot: Sendable, Equatable {
    public let key: String
    public let label: String
    public let mealCount: Int
    public let foodCount: Int
    public let kcal: Double

    public init(slot: NutritionPlanTimeSlot<NutritionPlanEntry>) {
        key = slot.key
        label = slot.label
        mealCount = slot.mealCount
        foodCount = slot.foodCount
        kcal = slot.totals.kcal
    }

    /// "2 meals, 1 food".
    public var countLabel: String {
        var parts: [String] = []
        if mealCount > 0 { parts.append("\(mealCount) \(mealCount == 1 ? "meal" : "meals")") }
        if foodCount > 0 { parts.append("\(foodCount) \(foodCount == 1 ? "food" : "foods")") }
        return parts.joined(separator: ", ")
    }
}

public enum NutritionTimeline {
    /// A planned slot counts as logged when a logged slot has the same time.
    public static func loggedSlotKeys(_ day: NutritionDay?) -> Set<String> {
        Set((day?.intakeSlots ?? []).map(\.key))
    }
}

/// Today's balance so far (food logged against energy recorded so far) plus
/// the end-of-day estimate.
public struct TodayBalanceSummary: Sendable, Equatable {
    public let today: String
    public let caloriesIn: Double
    public let activeKcal: Double
    public let restingKcal: Double
    /// Energy recorded so far today; nil until today's row exists.
    public let caloriesOut: Double?
    public let net: Double?
    /// When today's energy row was last written (watch sync or manual edit),
    /// so "so far" says how fresh the energy side is.
    public let energyUpdatedAt: Date?
    public let projection: DailyEnergyProjection?

    public init(payload: NutritionOverviewPayload, today: String, calendar: Calendar = .current) {
        self.today = today
        let balance = payload.balance(for: today)
        let energy = payload.energyByDate[today]
        caloriesIn = balance.caloriesIn
        activeKcal = energy?.activeKcal ?? 0
        restingKcal = energy?.restingKcal ?? 0
        caloriesOut = balance.caloriesOut
        net = balance.net
        energyUpdatedAt = energy?.updatedAt.flatMap(ExerciseDateParser.parseTimestamp)
        projection = payload.energyProjection(today: today, calendar: calendar)
    }
}

/// One dated body reading.
public struct TodayBodyReading: Sendable, Equatable {
    public let day: String
    public let value: Double

    public init(day: String, value: Double) {
        self.day = day
        self.value = value
    }
}

/// One body metric on Today: its readings, the latest one, and the
/// seven-day average against the week before.
public struct TodayBodyMetric: Sendable, Equatable {
    /// Readings in the loaded range, oldest first.
    public let readings: [TodayBodyReading]
    public let weekAverage: Double?
    public let priorWeekAverage: Double?

    public var latest: TodayBodyReading? { readings.last }

    public var weekChange: Double? {
        guard let weekAverage, let priorWeekAverage else { return nil }
        return weekAverage - priorWeekAverage
    }

    init(readings: [TodayBodyReading], today: String, calendar: Calendar) {
        self.readings = readings
        let weekStart = IntakeGrouping.addLocalDateDays(today, days: -6, calendar: calendar)
        let priorStart = IntakeGrouping.addLocalDateDays(today, days: -13, calendar: calendar)
        weekAverage = Self.average(readings.filter { $0.day >= weekStart && $0.day <= today }.map(\.value))
        priorWeekAverage = Self.average(readings.filter { $0.day >= priorStart && $0.day < weekStart }.map(\.value))
    }

    private static func average(_ values: [Double]) -> Double? {
        values.isEmpty ? nil : values.reduce(0, +) / Double(values.count)
    }
}

/// Weight and body fat for Today's Body card: both series for the chart and,
/// for each, the latest reading with its seven-day average against the week
/// before. The two metrics are independent, so a body-fat-only reading shows.
public struct TodayBodySummary: Sendable, Equatable {
    public let weight: TodayBodyMetric
    public let bodyFat: TodayBodyMetric

    public var isEmpty: Bool { weight.readings.isEmpty && bodyFat.readings.isEmpty }

    public var latestWeightKg: Double? { weight.latest?.value }
    public var latestWeightOn: String? { weight.latest?.day }
    public var latestBodyFatPct: Double? { bodyFat.latest?.value }
    public var weekAverageKg: Double? { weight.weekAverage }
    public var priorWeekAverageKg: Double? { weight.priorWeekAverage }
    public var weekChangeKg: Double? { weight.weekChange }

    public init(points: [BodyMeasurementChartPoint], today: String, calendar: Calendar = .current) {
        let sorted = points.sorted { $0.measuredOn < $1.measuredOn }
        weight = TodayBodyMetric(
            readings: sorted.compactMap { point in point.weightKg.map { TodayBodyReading(day: point.measuredOn, value: $0) } },
            today: today,
            calendar: calendar
        )
        bodyFat = TodayBodyMetric(
            readings: sorted.compactMap { point in point.bodyFatPct.map { TodayBodyReading(day: point.measuredOn, value: $0) } },
            today: today,
            calendar: calendar
        )
    }
}
