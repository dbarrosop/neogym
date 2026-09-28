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

/// Opaque HealthKit cursors are committed only after the corresponding backend writes succeed.
public struct BodyHealthAnchors: Codable, Sendable {
    public let weight: Data
    public let bodyFat: Data
    public let timeZone: String

    public init(weight: Data, bodyFat: Data, timeZone: String) {
        self.weight = weight
        self.bodyFat = bodyFat
        self.timeZone = timeZone
    }
}

public struct BodyHealthChangeBatch: Sendable {
    public let measurements: [HealthBodyMeasurement]
    public let nextAnchors: BodyHealthAnchors?
    public let hasEvents: Bool

    public init(measurements: [HealthBodyMeasurement], nextAnchors: BodyHealthAnchors?, hasEvents: Bool) {
        self.measurements = measurements
        self.nextAnchors = nextAnchors
        self.hasEvents = hasEvents
    }
}

public protocol BodyMeasurementsHealthImporting: Sendable {
    func dailyMeasurements() async throws -> [HealthBodyMeasurement]
    func changes(since anchors: BodyHealthAnchors?) async throws -> BodyHealthChangeBatch
}

public extension BodyMeasurementsHealthImporting {
    /// Host fakes can continue supplying a complete set of daily measurements.
    func changes(since anchors: BodyHealthAnchors?) async throws -> BodyHealthChangeBatch {
        let measurements = try await dailyMeasurements()
        return BodyHealthChangeBatch(measurements: measurements, nextAnchors: nil, hasEvents: !measurements.isEmpty)
    }
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

#if canImport(HealthKit) && os(iOS)
import HealthKit

public enum HealthKitBodyMeasurementImportError: LocalizedError, Sendable, Equatable {
    case authorizationDenied
    case unavailable
    case missingQuantityType(String)
    case invalidAnchor

    public var errorDescription: String? {
        switch self {
        case .authorizationDenied:
            "Apple Health access was not granted."
        case .unavailable:
            "Apple Health data is not available on this device."
        case let .missingQuantityType(identifier):
            "Apple Health does not expose \(identifier) on this device."
        case .invalidAnchor:
            "The saved Apple Health body cursor could not be read."
        }
    }
}

@available(iOS 15.4, *)
public final class HealthKitBodyMeasurementImporter: BodyMeasurementsHealthImporting, @unchecked Sendable {
    private let store: HKHealthStore
    private let calendar: Calendar

    public init(store: HKHealthStore = HKHealthStore(), calendar: Calendar = .current) {
        self.store = store
        self.calendar = calendar
    }

    public func dailyMeasurements() async throws -> [HealthBodyMeasurement] {
        try await changes(since: nil).measurements
    }

    public func changes(since anchors: BodyHealthAnchors?) async throws -> BodyHealthChangeBatch {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitBodyMeasurementImportError.unavailable
        }
        guard let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            throw HealthKitBodyMeasurementImportError.missingQuantityType("bodyMass")
        }
        guard let bodyFatType = HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage) else {
            throw HealthKitBodyMeasurementImportError.missingQuantityType("bodyFatPercentage")
        }
        try await requestReadAuthorization(for: [bodyMassType, bodyFatType])

        async let weightChanges = anchoredSamples(type: bodyMassType, since: anchors?.weight)
        async let fatChanges = anchoredSamples(type: bodyFatType, since: anchors?.bodyFat)
        let weights = try await weightChanges
        let fats = try await fatChanges
        let hasEvents = !weights.samples.isEmpty || !fats.samples.isEmpty
            || weights.deletedCount > 0 || fats.deletedCount > 0

        // A nil cursor performs the historical import once. An incremental batch may
        // contain an older sample for a date, so re-read only changed dates to retain
        // the latest *current* weight and fat measurement for each affected day.
        let measurements: [HealthBodyMeasurement]
        if anchors == nil {
            measurements = HealthBodyMeasurementGrouper.merge(
                weightSamples: mapped(weights.samples, unit: .gramUnit(with: .kilo), multiplier: 1),
                bodyFatSamples: mapped(fats.samples, unit: .percent(), multiplier: 100)
            )
        } else {
            let dates = Set((weights.samples + fats.samples).map {
                DateOnly.formatLocalISO($0.endDate, calendar: calendar)
            })
            var currentWeights: [DatedHealthMetricSample] = []
            var currentFats: [DatedHealthMetricSample] = []
            for date in dates.sorted() {
                guard let start = DateOnly.parse(date, calendar: calendar),
                      let end = calendar.date(byAdding: .day, value: 1, to: start) else { continue }
                async let dayWeights = queryQuantitySamples(
                    type: bodyMassType, unit: .gramUnit(with: .kilo), multiplier: 1, start: start, end: end
                )
                async let dayFats = queryQuantitySamples(
                    type: bodyFatType, unit: .percent(), multiplier: 100, start: start, end: end
                )
                currentWeights += try await dayWeights
                currentFats += try await dayFats
            }
            measurements = HealthBodyMeasurementGrouper.merge(
                weightSamples: currentWeights, bodyFatSamples: currentFats
            )
        }
        return BodyHealthChangeBatch(
            measurements: measurements,
            nextAnchors: BodyHealthAnchors(
                weight: weights.nextAnchor, bodyFat: fats.nextAnchor, timeZone: calendar.timeZone.identifier
            ),
            hasEvents: hasEvents
        )
    }

    private func anchoredSamples(type: HKQuantityType, since data: Data?) async throws
        -> (samples: [HKQuantitySample], deletedCount: Int, nextAnchor: Data) {
        let anchor: HKQueryAnchor?
        if let data {
            guard let decoded = try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data) else {
                throw HealthKitBodyMeasurementImportError.invalidAnchor
            }
            anchor = decoded
        } else {
            anchor = nil
        }
        let query = HKAnchoredObjectQueryDescriptor<HKQuantitySample>(
            predicates: [.quantitySample(type: type)], anchor: anchor, limit: HKObjectQueryNoLimit
        )
        let result = try await query.result(for: store)
        let nextAnchor = try NSKeyedArchiver.archivedData(
            withRootObject: result.newAnchor, requiringSecureCoding: true
        )
        return (result.addedSamples, result.deletedObjects.count, nextAnchor)
    }

    private func mapped(_ samples: [HKQuantitySample], unit: HKUnit, multiplier: Double)
        -> [DatedHealthMetricSample] {
        samples.map { sample in
            DatedHealthMetricSample(
                measuredOn: DateOnly.formatLocalISO(sample.endDate, calendar: calendar),
                endDate: sample.endDate,
                value: sample.quantity.doubleValue(for: unit) * multiplier
            )
        }
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
        multiplier: Double,
        start: Date,
        end: Date
    ) async throws -> [DatedHealthMetricSample] {
        let calendar = self.calendar
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[DatedHealthMetricSample], any Error>) in
            let predicate = HKQuery.predicateForSamples(
                withStart: start, end: end, options: [.strictEndDate]
            )
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
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
