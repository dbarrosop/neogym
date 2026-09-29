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

    func startObserving(
        onChange: @escaping @Sendable (WatchEventMetric, UUID) async -> Void,
        onCompletion: @escaping @Sendable (WatchEventMetric, UUID, WatchEventOutcome, Int) -> Void,
        onFailure: @escaping @Sendable (WatchEventMetric, WatchEventAction, WatchEventStage,
                                       Int?, WatchEventErrorSource) -> Void
    ) {
        guard observers.isEmpty, HKHealthStore.isHealthDataAvailable() else { return }
        for (type, metric) in [(active, WatchEventMetric.activeEnergy), (resting, .restingEnergy)] {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                if let error {
                    let (code, source) = Self.failureDetails(error, stage: .observerQuery)
                    onFailure(metric, .healthObservation, .observerQuery, code, source)
                    completion()
                    return
                }
                let id = UUID()
                let started = ProcessInfo.processInfo.systemUptime
                let finished = WatchObserverCompletionGate(completion)
                let elapsed: @Sendable () -> Int = {
                    max(0, Int((ProcessInfo.processInfo.systemUptime - started).rounded(.up)))
                }
                let work = Task { await onChange(metric, id) }
                let watchdog = Task {
                    do { try await Task.sleep(for: .seconds(25)) }
                    catch { return }
                    if finished.complete() {
                        onCompletion(metric, id, .timedOut, elapsed())
                        work.cancel()
                    }
                }
                Task {
                    await work.value
                    watchdog.cancel()
                    if finished.complete() {
                        onCompletion(metric, id, .acknowledged, elapsed())
                    }
                }
            }
            observers.append(query)
            store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                guard !success || error != nil else { return }
                let (code, source) = Self.failureDetails(error, stage: .backgroundDelivery)
                onFailure(metric, .healthBackgroundDelivery, .backgroundDelivery, code, source)
            }
        }
    }

    private static func failureDetails(_ error: (any Error)?, stage: WatchEventStage) -> (Int?, WatchEventErrorSource) {
        guard let error = error as NSError? else { return (nil, .other) }
        return (error.code, .classify(domain: error.domain, stage: stage))
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

private enum WatchHealthError: LocalizedError {
    case unavailable, authorizationFailed
    var errorDescription: String? {
        switch self {
        case .unavailable: "Apple Health is unavailable on this watch."
        case .authorizationFailed: "Apple Health permission was not granted."
        }
    }
}
