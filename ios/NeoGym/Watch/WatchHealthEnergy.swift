import Foundation
import HealthKit
import NeoGymKit

/// Read-only watch HealthKit access. Authorization is requested only from an explicit Energy-page tap;
/// observer callbacks and scheduled background refreshes never present a permission prompt.
final class WatchHealthEnergy: DailyEnergyHealthImporting, @unchecked Sendable {
    private let store = HKHealthStore()
    private let calendar = Calendar.current
    private var observers: [HKObserverQuery] = []
    private let active = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
    private let resting = HKQuantityType.quantityType(forIdentifier: .basalEnergyBurned)!

    func authorize() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw WatchHealthError.unavailable }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            store.requestAuthorization(toShare: [], read: [active, resting]) { success, error in
                if let error { continuation.resume(throwing: error) }
                else if success { continuation.resume() }
                else { continuation.resume(throwing: WatchHealthError.authorizationFailed) }
            }
        }
    }

    func startObserving(onChange: @escaping @Sendable () async -> Void) {
        guard observers.isEmpty, HKHealthStore.isHealthDataAvailable() else { return }
        for type in [active, resting] {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                guard error == nil else { completion(); return }
                let finished = HealthObserverCompletion(completion)
                Task {
                    await onChange()
                    finished.call() // HealthKit must be told when backend/snapshot work finishes.
                }
            }
            observers.append(query)
            store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { _, _ in }
        }
    }

    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] {
        guard HKHealthStore.isHealthDataAvailable() else { return [] }
        let start = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: Date()))!
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: Date()))!
        async let activeValues = dailyTotals(type: active, start: start, end: end)
        async let restingValues = dailyTotals(type: resting, start: start, end: end)
        let activeSamples: [(measuredOn: String, value: Double)]
        do {
            activeSamples = try await activeValues
        } catch {
            if error is CancellationError { throw error }
            throw WatchHealthSyncFailure(stage: .activeHealthQuery, cause: error)
        }
        let restingSamples: [(measuredOn: String, value: Double)]
        do {
            restingSamples = try await restingValues
        } catch {
            if error is CancellationError { throw error }
            throw WatchHealthSyncFailure(stage: .restingHealthQuery, cause: error)
        }
        return HealthDailyEnergyGrouper.sum(active: activeSamples, resting: restingSamples)
    }

    private func dailyTotals(type: HKQuantityType, start: Date, end: Date) async throws -> [(measuredOn: String, value: Double)] {
        let calendar = self.calendar
        let store = self.store
        return try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end,
                                                        options: [.strictStartDate, .strictEndDate])
            let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate,
                                                    options: .cumulativeSum, anchorDate: start,
                                                    intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { query, collection, error in
                defer { store.stop(query) }
                if let error { continuation.resume(throwing: error); return }
                var values: [(measuredOn: String, value: Double)] = []
                collection?.enumerateStatistics(from: start, to: end) { statistics, _ in
                    guard let quantity = statistics.sumQuantity() else { return }
                    values.append((DateOnly.formatLocalISO(statistics.startDate, calendar: calendar),
                                   quantity.doubleValue(for: .kilocalorie())))
                }
                continuation.resume(returning: values)
            }
            store.execute(query)
        }
    }
}

// HealthKit's completion is not annotated Sendable, but its one-shot callback may
// be invoked from the async task which processes the observer event.
private final class HealthObserverCompletion: @unchecked Sendable {
    private let callback: () -> Void
    init(_ callback: @escaping () -> Void) { self.callback = callback }
    func call() { callback() }
}

private enum WatchHealthError: LocalizedError {
    case unavailable, authorizationFailed
    var errorDescription: String? {
        switch self {
        case .unavailable: "Apple Health is unavailable on this watch."
        case .authorizationFailed: "Apple Health permission was not granted."
        }
    }
}
