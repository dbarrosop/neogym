import Foundation

public struct HealthDailyEnergy: Sendable, Equatable, Hashable {
    public let energyOn: String
    public let activeKcal: Double?
    public let restingKcal: Double?

    public init(energyOn: String, activeKcal: Double? = nil, restingKcal: Double? = nil) {
        self.energyOn = energyOn
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
    }

    public func formValues(notes: String = "") -> DailyEnergyFormValues? {
        let active = Self.formattedHealthMetric(activeKcal)
        let resting = Self.formattedHealthMetric(restingKcal)
        guard active != nil || resting != nil else { return nil }
        return DailyEnergyFormValues(
            energyOn: energyOn,
            activeKcal: active ?? "",
            restingKcal: resting ?? "",
            notes: notes
        )
    }

    private static func formattedHealthMetric(_ value: Double?) -> String? {
        guard let value,
              value.isFinite,
              value > DailyEnergyValidation.kcalMin,
              value < DailyEnergyValidation.kcalMax
        else { return nil }

        let rounded = (value * 100).rounded() / 100
        guard rounded > DailyEnergyValidation.kcalMin, rounded < DailyEnergyValidation.kcalMax else { return nil }

        let formatted = String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), rounded)
        return formatted
            .replacingOccurrences(of: #"\.0+$"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"(\.\d*[1-9])0+$"#, with: "$1", options: .regularExpression)
    }
}

public protocol DailyEnergyHealthImporting: Sendable {
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy]
}

public enum HealthDailyEnergyGrouper {
    public static func sum(
        active: [(measuredOn: String, value: Double)],
        resting: [(measuredOn: String, value: Double)]
    ) -> [HealthDailyEnergy] {
        var activeByDay: [String: Double] = [:]
        var restingByDay: [String: Double] = [:]

        for sample in active where sample.value.isFinite && sample.value > DailyEnergyValidation.kcalMin {
            activeByDay[sample.measuredOn, default: 0] += sample.value
        }

        for sample in resting where sample.value.isFinite && sample.value > DailyEnergyValidation.kcalMin {
            restingByDay[sample.measuredOn, default: 0] += sample.value
        }

        let energyOns = Set(activeByDay.keys).union(restingByDay.keys)
        return energyOns.sorted(by: >).compactMap { energyOn in
            let activeKcal = activeByDay[energyOn]
            let restingKcal = restingByDay[energyOn]
            guard activeKcal != nil || restingKcal != nil else { return nil }
            return HealthDailyEnergy(
                energyOn: energyOn,
                activeKcal: activeKcal,
                restingKcal: restingKcal
            )
        }
    }
}
