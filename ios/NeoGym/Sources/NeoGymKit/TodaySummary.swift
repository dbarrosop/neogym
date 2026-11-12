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

/// Yesterday's actual balance plus today's estimate.
public struct TodayBalanceSummary: Sendable, Equatable {
    public let yesterday: String
    public let caloriesIn: Double
    public let activeKcal: Double
    public let restingKcal: Double
    public let caloriesOut: Double?
    public let net: Double?
    public let projection: DailyEnergyProjection?

    public init(payload: NutritionOverviewPayload, today: String, calendar: Calendar = .current) {
        yesterday = IntakeGrouping.addLocalDateDays(today, days: -1, calendar: calendar)
        let balance = payload.balance(for: yesterday)
        let energy = payload.energyByDate[yesterday]
        caloriesIn = balance.caloriesIn
        activeKcal = energy?.activeKcal ?? 0
        restingKcal = energy?.restingKcal ?? 0
        caloriesOut = balance.caloriesOut
        net = balance.net
        projection = payload.energyProjection(today: today, calendar: calendar)
    }
}

/// Latest weight and body fat with the seven-day average against the week before.
public struct TodayBodySummary: Sendable, Equatable {
    public let latestWeightKg: Double?
    public let latestWeightOn: String?
    public let latestBodyFatPct: Double?
    public let weekAverageKg: Double?
    public let priorWeekAverageKg: Double?
    /// Seven-day rolling average for each weighed day, oldest first.
    public let rollingWeights: [Double]

    public var weekChangeKg: Double? {
        guard let weekAverageKg, let priorWeekAverageKg else { return nil }
        return weekAverageKg - priorWeekAverageKg
    }

    public init(points: [BodyMeasurementChartPoint], today: String, calendar: Calendar = .current) {
        let sorted = points.sorted { $0.measuredOn < $1.measuredOn }
        let weights = sorted.compactMap { point in point.weightKg.map { (date: point.measuredOn, value: $0) } }
        latestWeightKg = weights.last?.value
        latestWeightOn = weights.last?.date
        latestBodyFatPct = sorted.last { $0.bodyFatPct != nil }?.bodyFatPct
        let weekStart = IntakeGrouping.addLocalDateDays(today, days: -6, calendar: calendar)
        let priorStart = IntakeGrouping.addLocalDateDays(today, days: -13, calendar: calendar)
        weekAverageKg = Self.average(weights.filter { $0.date >= weekStart && $0.date <= today }.map(\.value))
        priorWeekAverageKg = Self.average(
            weights.filter { $0.date >= priorStart && $0.date < weekStart }.map(\.value)
        )
        rollingWeights = weights.map { point in
            let from = IntakeGrouping.addLocalDateDays(point.date, days: -6, calendar: calendar)
            return Self.average(weights.filter { $0.date >= from && $0.date <= point.date }.map(\.value)) ?? point.value
        }
    }

    private static func average(_ values: [Double]) -> Double? {
        values.isEmpty ? nil : values.reduce(0, +) / Double(values.count)
    }
}
