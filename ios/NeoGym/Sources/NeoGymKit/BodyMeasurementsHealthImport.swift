import Foundation

public struct HealthBodyMeasurement: Sendable, Equatable, Hashable {
    public let measuredOn: String
    public let weightKg: Double?
    public let bodyFatPct: Double?

    public init(measuredOn: String, weightKg: Double? = nil, bodyFatPct: Double? = nil) {
        self.measuredOn = measuredOn
        self.weightKg = weightKg
        self.bodyFatPct = bodyFatPct
    }

    public func formValues(notes: String = "") -> BodyMeasurementFormValues? {
        let weight = Self.formattedHealthMetric(
            weightKg,
            min: BodyMeasurementValidation.weightMin,
            max: BodyMeasurementValidation.weightMax,
            allowsZero: false
        )
        let fat = Self.formattedHealthMetric(
            bodyFatPct,
            min: BodyMeasurementValidation.bodyFatMin,
            max: BodyMeasurementValidation.bodyFatMax,
            allowsZero: true
        )
        guard weight != nil || fat != nil else { return nil }
        return BodyMeasurementFormValues(
            measuredOn: measuredOn,
            weightKg: weight ?? "",
            bodyFatPct: fat ?? "",
            notes: notes
        )
    }

    private static func formattedHealthMetric(
        _ value: Double?,
        min: Double,
        max: Double,
        allowsZero: Bool
    ) -> String? {
        guard let value, value.isFinite else { return nil }
        if allowsZero {
            guard value >= min, value < max else { return nil }
        } else {
            guard value > min, value < max else { return nil }
        }

        let rounded = (value * 100).rounded() / 100
        if allowsZero {
            guard rounded >= min, rounded < max else { return nil }
        } else {
            guard rounded > min, rounded < max else { return nil }
        }

        let formatted = String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), rounded)
        return formatted
            .replacingOccurrences(of: #"\.0+$"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"(\.\d*[1-9])0+$"#, with: "$1", options: .regularExpression)
    }
}

public struct BodyMeasurementsHealthSyncSummary: Sendable, Equatable {
    public let importedCount: Int
    public let updatedCount: Int
    public let skippedExistingCount: Int

    public init(importedCount: Int, updatedCount: Int = 0, skippedExistingCount: Int) {
        self.importedCount = importedCount
        self.updatedCount = updatedCount
        self.skippedExistingCount = skippedExistingCount
    }
}

public protocol BodyMeasurementsHealthImporting: Sendable {
    func dailyMeasurements() async throws -> [HealthBodyMeasurement]
}

fileprivate struct DatedHealthMetricSample: Sendable, Equatable {
    let measuredOn: String
    let endDate: Date
    let value: Double
}

public enum HealthBodyMeasurementGrouper {
    public static func merge(
        weights: [(measuredOn: String, endDate: Date, value: Double)],
        bodyFats: [(measuredOn: String, endDate: Date, value: Double)]
    ) -> [HealthBodyMeasurement] {
        merge(
            weightSamples: weights.map {
                DatedHealthMetricSample(measuredOn: $0.measuredOn, endDate: $0.endDate, value: $0.value)
            },
            bodyFatSamples: bodyFats.map {
                DatedHealthMetricSample(measuredOn: $0.measuredOn, endDate: $0.endDate, value: $0.value)
            }
        )
    }

    fileprivate static func merge(
        weightSamples: [DatedHealthMetricSample],
        bodyFatSamples: [DatedHealthMetricSample]
    ) -> [HealthBodyMeasurement] {
        var latestWeights: [String: DatedHealthMetricSample] = [:]
        var latestBodyFats: [String: DatedHealthMetricSample] = [:]

        for sample in weightSamples where sample.value.isFinite {
            if let existing = latestWeights[sample.measuredOn], existing.endDate >= sample.endDate {
                continue
            }
            latestWeights[sample.measuredOn] = sample
        }

        for sample in bodyFatSamples where sample.value.isFinite {
            if let existing = latestBodyFats[sample.measuredOn], existing.endDate >= sample.endDate {
                continue
            }
            latestBodyFats[sample.measuredOn] = sample
        }

        let measuredOns = Set(latestWeights.keys).union(latestBodyFats.keys)
        return measuredOns.sorted(by: >).map { measuredOn in
            HealthBodyMeasurement(
                measuredOn: measuredOn,
                weightKg: latestWeights[measuredOn]?.value,
                bodyFatPct: latestBodyFats[measuredOn]?.value
            )
        }
    }
}

#if canImport(HealthKit) && !os(macOS)
import HealthKit

public enum HealthKitBodyMeasurementImportError: LocalizedError, Sendable, Equatable {
    case authorizationDenied
    case unavailable
    case missingQuantityType(String)

    public var errorDescription: String? {
        switch self {
        case .authorizationDenied:
            "Apple Health access was not granted."
        case .unavailable:
            "Apple Health data is not available on this device."
        case let .missingQuantityType(identifier):
            "Apple Health does not expose \(identifier) on this device."
        }
    }
}

@available(iOS 15.0, *)
public final class HealthKitBodyMeasurementImporter: BodyMeasurementsHealthImporting, @unchecked Sendable {
    private let store: HKHealthStore
    private let calendar: Calendar

    public init(store: HKHealthStore = HKHealthStore(), calendar: Calendar = .current) {
        self.store = store
        self.calendar = calendar
    }

    public func dailyMeasurements() async throws -> [HealthBodyMeasurement] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        guard let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            throw HealthKitBodyMeasurementImportError.missingQuantityType("bodyMass")
        }
        guard let bodyFatType = HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage) else {
            throw HealthKitBodyMeasurementImportError.missingQuantityType("bodyFatPercentage")
        }

        try await requestReadAuthorization(for: [bodyMassType, bodyFatType])

        async let weights = queryQuantitySamples(type: bodyMassType, unit: .gramUnit(with: .kilo), multiplier: 1)
        async let bodyFats = queryQuantitySamples(type: bodyFatType, unit: .percent(), multiplier: 100)

        return try await HealthBodyMeasurementGrouper.merge(weightSamples: weights, bodyFatSamples: bodyFats)
    }

    private func requestReadAuthorization(for types: Set<HKObjectType>) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            store.requestAuthorization(toShare: [], read: types) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: HealthKitBodyMeasurementImportError.authorizationDenied)
                }
            }
        }
    }

    private func queryQuantitySamples(
        type: HKQuantityType,
        unit: HKUnit,
        multiplier: Double
    ) async throws -> [DatedHealthMetricSample] {
        let calendar = self.calendar
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[DatedHealthMetricSample], any Error>) in
            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let query = HKSampleQuery(
                sampleType: type,
                predicate: nil,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let quantitySamples = samples?.compactMap { $0 as? HKQuantitySample } ?? []
                let mapped = quantitySamples.map { sample in
                    DatedHealthMetricSample(
                        measuredOn: DateOnly.formatLocalISO(sample.endDate, calendar: calendar),
                        endDate: sample.endDate,
                        value: sample.quantity.doubleValue(for: unit) * multiplier
                    )
                }
                continuation.resume(returning: mapped)
            }
            store.execute(query)
        }
    }
}
#endif
