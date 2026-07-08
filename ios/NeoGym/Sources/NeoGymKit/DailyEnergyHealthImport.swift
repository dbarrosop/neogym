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

public struct DailyEnergyHealthSyncSummary: Sendable, Equatable {
    public let importedCount: Int
    public let skippedExistingCount: Int

    public init(importedCount: Int, skippedExistingCount: Int) {
        self.importedCount = importedCount
        self.skippedExistingCount = skippedExistingCount
    }
}

public protocol DailyEnergyHealthImporting: Sendable {
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy]
}
