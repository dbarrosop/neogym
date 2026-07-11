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
    public let updatedCount: Int
    public let skippedExistingCount: Int

    public init(importedCount: Int, updatedCount: Int = 0, skippedExistingCount: Int) {
        self.importedCount = importedCount
        self.updatedCount = updatedCount
        self.skippedExistingCount = skippedExistingCount
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

#if canImport(HealthKit) && !os(macOS)
import HealthKit

public enum HealthKitDailyEnergyImportError: LocalizedError, Sendable, Equatable {
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
public final class HealthKitDailyEnergyImporter: DailyEnergyHealthImporting, @unchecked Sendable {
    private let store: HKHealthStore
    private let calendar: Calendar
    private let lookbackYears: Int

    public init(store: HKHealthStore = HKHealthStore(), calendar: Calendar = .current, lookbackYears: Int = 20) {
        self.store = store
        self.calendar = calendar
        self.lookbackYears = lookbackYears
    }

    public func dailyEnergyEntries() async throws -> [HealthDailyEnergy] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        guard let activeType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            throw HealthKitDailyEnergyImportError.missingQuantityType("activeEnergyBurned")
        }
        guard let restingType = HKQuantityType.quantityType(forIdentifier: .basalEnergyBurned) else {
            throw HealthKitDailyEnergyImportError.missingQuantityType("basalEnergyBurned")
        }

        try await requestReadAuthorization(for: [activeType, restingType])

        let window = statisticsWindow()
        async let active = queryCumulativeDailyEnergy(type: activeType, window: window)
        async let resting = queryCumulativeDailyEnergy(type: restingType, window: window)

        return try await HealthDailyEnergyGrouper.sum(active: active, resting: resting)
    }

    private func requestReadAuthorization(for types: Set<HKObjectType>) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            store.requestAuthorization(toShare: [], read: types) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: HealthKitDailyEnergyImportError.authorizationDenied)
                }
            }
        }
    }

    private func statisticsWindow(now: Date = Date()) -> (start: Date, endExclusive: Date, anchor: Date) {
        let todayStart = calendar.startOfDay(for: now)
        let endExclusive = calendar.date(byAdding: .day, value: 1, to: todayStart) ?? todayStart
        let rawStart = calendar.date(byAdding: .year, value: -lookbackYears, to: endExclusive) ?? todayStart
        let start = calendar.startOfDay(for: rawStart)
        return (start: start, endExclusive: endExclusive, anchor: start)
    }

    private func queryCumulativeDailyEnergy(
        type: HKQuantityType,
        window: (start: Date, endExclusive: Date, anchor: Date)
    ) async throws -> [(measuredOn: String, value: Double)] {
        let calendar = self.calendar
        return try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(
                withStart: window.start,
                end: window.endExclusive,
                options: [.strictStartDate, .strictEndDate]
            )
            var interval = DateComponents()
            interval.day = 1

            let queryBox = HealthKitStatisticsCollectionQueryBox()
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: window.anchor,
                intervalComponents: interval
            )
            queryBox.query = query
            query.initialResultsHandler = { [store, queryBox] _, collection, error in
                defer {
                    if let query = queryBox.query {
                        store.stop(query)
                    }
                }
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let collection else {
                    continuation.resume(returning: [])
                    return
                }

                var samples: [(measuredOn: String, value: Double)] = []
                collection.enumerateStatistics(from: window.start, to: window.endExclusive) { statistics, _ in
                    guard let quantity = statistics.sumQuantity() else { return }
                    samples.append((
                        measuredOn: DateOnly.formatLocalISO(statistics.startDate, calendar: calendar),
                        value: quantity.doubleValue(for: .kilocalorie())
                    ))
                }
                continuation.resume(returning: samples)
            }
            store.execute(query)
        }
    }
}

private final class HealthKitStatisticsCollectionQueryBox: @unchecked Sendable {
    var query: HKStatisticsCollectionQuery?
}
#endif
