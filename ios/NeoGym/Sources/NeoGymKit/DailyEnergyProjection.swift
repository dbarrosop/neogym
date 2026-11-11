import Foundation

/// A read-only baseline, never an imported or persisted daily_energy value.
/// Missing, zero and invalid resting totals do not count as observed days.
public struct DailyRestingEnergyBaseline: Codable, Equatable, Sendable {
    public let kcal: Double
    public let dayCount: Int

    public init?(today: String, history: [DailyEnergy], calendar: Calendar = .current) {
        let dates = Set((1...7).map { IntakeGrouping.addLocalDateDays(today, days: -$0, calendar: calendar) })
        var seen = Set<String>()
        let values = history.compactMap { entry -> Double? in
            guard dates.contains(entry.energyOn), let value = entry.restingKcal,
                  value.isFinite, value > 0, value < DailyEnergyValidation.kcalMax,
                  seen.insert(entry.energyOn).inserted else { return nil }
            return value
        }
        guard !values.isEmpty else { return nil }
        kcal = values.reduce(0, +) / Double(values.count)
        dayCount = values.count
    }
}

/// Full-day resting baseline + activity already recorded, not a forecast of
/// future meals or activity. Actual daily totals and historical nets stay unchanged.
public struct DailyEnergyProjection: Equatable, Sendable {
    public let estimatedBurnedKcal: Double
    public let estimatedNetKcal: Double
    public let baseline: DailyRestingEnergyBaseline

    public static let explanation = "Uses recent resting energy plus activity so far. "
        + "Net uses food already logged; future food and activity are not predicted."

    public init?(
        date: String, today: String, caloriesIn: Double, dailyEnergy: DailyEnergy?,
        history: [DailyEnergy], calendar: Calendar = .current
    ) {
        guard date == today, let dailyEnergy, dailyEnergy.energyOn == today,
              let baseline = DailyRestingEnergyBaseline(today: today, history: history, calendar: calendar)
        else { return nil }
        self.init(caloriesIn: caloriesIn, activeKcal: dailyEnergy.activeKcal,
                  restingKcal: dailyEnergy.restingKcal, baseline: baseline)
    }

    public init?(
        caloriesIn: Double, activeKcal: Double?, restingKcal: Double?,
        baseline: DailyRestingEnergyBaseline
    ) {
        let active = activeKcal ?? 0
        let resting = restingKcal ?? 0
        guard caloriesIn.isFinite, caloriesIn >= 0,
              active.isFinite, active >= 0, active < DailyEnergyValidation.kcalMax,
              resting.isFinite, resting >= 0, resting < DailyEnergyValidation.kcalMax,
              baseline.kcal.isFinite, baseline.kcal > 0, baseline.kcal < DailyEnergyValidation.kcalMax,
              (1...7).contains(baseline.dayCount) else { return nil }
        self.baseline = baseline
        estimatedBurnedKcal = active + max(resting, baseline.kcal)
        estimatedNetKcal = caloriesIn - estimatedBurnedKcal
    }

    public var basisDescription: String {
        "Resting average: \(baseline.dayCount) of the previous 7 days."
    }

    public func burnedValue(locale: Locale = .current) -> String {
        "≈\(NutritionMath.formatMacro(estimatedBurnedKcal, unit: "kcal", locale: locale))"
    }

    public func netValue(locale: Locale = .current) -> String {
        let sign = estimatedNetKcal < 0 ? "−" : estimatedNetKcal > 0 ? "+" : ""
        return "≈\(sign)\(NutritionMath.formatMacro(abs(estimatedNetKcal), unit: "kcal", locale: locale))"
    }
}

public extension NutritionOverviewPayload {
    func energyProjection(today: String, calendar: Calendar = .current) -> DailyEnergyProjection? {
        DailyEnergyProjection(
            date: today, today: today, caloriesIn: balance(for: today).caloriesIn,
            dailyEnergy: energyByDate[today], history: dailyEnergyEntries, calendar: calendar
        )
    }
}

public extension DailyIntakePayload {
    func energyProjection(date: String, today: String = DateOnly.todayLocalISO()) -> DailyEnergyProjection? {
        DailyEnergyProjection(date: date, today: today, caloriesIn: loggedTotals.kcal,
                              dailyEnergy: dailyEnergy, history: energyHistory)
    }
}
