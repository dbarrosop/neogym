import Combine
import Foundation

@MainActor
public final class BodyMeasurementsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[BodyMeasurement]> = .idle
    @Published public private(set) var healthSyncState: Loadable<BodyMeasurementsHealthSyncSummary> = .idle
    @Published public private(set) var isRefreshing = false

    private let repository: any BodyMeasurementsRepositoryProtocol
    private let healthImporter: (any BodyMeasurementsHealthImporting)?
    private let calendar: Calendar
    private let healthRefreshLookbackDays: Int
    private let now: @Sendable () -> Date
    private let userId: String?
    private let defaults: UserDefaults

    private static let healthImportNote = "Imported from Apple Health"

    public init(
        repository: any BodyMeasurementsRepositoryProtocol,
        healthImporter: (any BodyMeasurementsHealthImporting)? = nil,
        calendar: Calendar = .current,
        healthRefreshLookbackDays: Int = 7,
        now: @escaping @Sendable () -> Date = Date.init,
        userId: String? = nil,
        defaults: UserDefaults = .standard
    ) {
        self.repository = repository
        self.healthImporter = healthImporter
        self.calendar = calendar
        self.healthRefreshLookbackDays = healthRefreshLookbackDays
        self.now = now
        self.userId = userId
        self.defaults = defaults
    }

    public var measurements: [BodyMeasurement] { state.value ?? [] }
    public var trendData: BodyMeasurementTrendData {
        BodyMeasurementTrendBuilder.make(from: measurements, calendar: calendar)
    }

    public func load(shouldSyncHealthMeasurements: Bool = false) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        state = .loading(previous: state.value)
        do {
            if shouldSyncHealthMeasurements {
                async let initialLoad: Void = loadMeasurementUpdates()
                let didWrite = await syncHealthMeasurements()
                try await initialLoad
                if didWrite { try await loadMeasurementUpdates() }
            } else {
                try await loadMeasurementUpdates()
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: state.value)
        }
    }

    private func loadMeasurementUpdates() async throws {
        for try await measurements in repository.measurementListUpdates() {
            state = .loaded(measurements)
        }
    }

    /// Used by the Overview, whose chart has its own date-bounded query.
    @discardableResult
    public func syncHealthMeasurementsOnly() async -> Bool {
        guard !isRefreshing else { return false }
        isRefreshing = true
        defer { isRefreshing = false }
        return await syncHealthMeasurements()
    }

    private func syncHealthMeasurements() async -> Bool {
        guard let healthImporter else { return false }
        healthSyncState = .loading(previous: healthSyncState.value)
        var didWrite = false
        do {
            let key = userId.map { "body-health.anchor.v1.\($0)" }
            let saved = key.flatMap { defaults.data(forKey: $0) }
                .flatMap { try? JSONDecoder().decode(BodyHealthAnchors.self, from: $0) }
            // A timezone change moves local-day boundaries; rebuild once from history.
            let anchors = saved?.timeZone == calendar.timeZone.identifier ? saved : nil
            let batch = try await healthImporter.changes(since: anchors)
            try Task.checkCancellation()
            if batch.measurements.isEmpty {
                // HealthKit hides whether read permission was denied. Only checkpoint
                // a baseline when it actually delivered an event; otherwise retry
                // after the user grants permission.
                if batch.hasEvents, let key, let next = batch.nextAnchors {
                    defaults.set(try JSONEncoder().encode(next), forKey: key)
                }
                healthSyncState = .loaded(BodyMeasurementsHealthSyncSummary(importedCount: 0, skippedExistingCount: 0))
                return false
            }
            let existingMeasurements = try await repository.listMeasurements()
            let refreshStart = healthRefreshStartDate()
            var knownDates = Set(existingMeasurements.map(\.measuredOn))
            let existingMeasurementsByDate = Dictionary(
                uniqueKeysWithValues: existingMeasurements.map { ($0.measuredOn, $0) }
            )
            var importedCount = 0
            var updatedCount = 0
            var skippedExistingCount = 0

            for measurement in batch.measurements {
                try Task.checkCancellation()
                guard let values = measurement.formValues(notes: Self.healthImportNote) else { continue }

                if let existingMeasurement = existingMeasurementsByDate[measurement.measuredOn] {
                    guard existingMeasurement.measuredOn >= refreshStart,
                          existingMeasurement.notes == Self.healthImportNote,
                          shouldUpdateHealthImportedMeasurement(existingMeasurement, with: values)
                    else {
                        skippedExistingCount += 1
                        continue
                    }
                    try Task.checkCancellation()
                    try await repository.updateMeasurement(id: existingMeasurement.id, values: values)
                    didWrite = true
                    knownDates.insert(values.measuredOn)
                    updatedCount += 1
                    continue
                }

                guard !knownDates.contains(measurement.measuredOn) else {
                    skippedExistingCount += 1
                    continue
                }

                do {
                    try Task.checkCancellation()
                    _ = try await repository.createMeasurement(values)
                    didWrite = true
                    knownDates.insert(values.measuredOn)
                    importedCount += 1
                } catch where BodyMeasurementsErrorMapper.isDuplicateMeasuredOnError(error) {
                    knownDates.insert(values.measuredOn)
                    skippedExistingCount += 1
                }
            }
            try Task.checkCancellation()
            if let key, let next = batch.nextAnchors, batch.hasEvents {
                defaults.set(try JSONEncoder().encode(next), forKey: key)
            }
            healthSyncState = .loaded(BodyMeasurementsHealthSyncSummary(
                importedCount: importedCount,
                updatedCount: updatedCount,
                skippedExistingCount: skippedExistingCount
            ))
            return didWrite
        } catch where GraphQLDomainError.isCancellation(error) {
            healthSyncState = healthSyncState.cancellationFallback
        } catch {
            healthSyncState = .failed(
                message: BodyMeasurementsErrorMapper.message(for: error),
                previous: healthSyncState.value
            )
        }
        return didWrite
    }

    private func healthRefreshStartDate() -> String {
        let todayStart = calendar.startOfDay(for: now())
        let lookbackDays = max(healthRefreshLookbackDays, 1) - 1
        let startDate = calendar.date(byAdding: .day, value: -lookbackDays, to: todayStart) ?? todayStart
        return DateOnly.formatLocalISO(startDate, calendar: calendar)
    }

    private func shouldUpdateHealthImportedMeasurement(
        _ measurement: BodyMeasurement,
        with values: BodyMeasurementFormValues
    ) -> Bool {
        !approximatelyEqual(measurement.weightKg, Double(values.weightKg))
            || !approximatelyEqual(measurement.bodyFatPct, Double(values.bodyFatPct))
            || measurement.notes != values.notes
    }

    private func approximatelyEqual(_ lhs: Double?, _ rhs: Double?) -> Bool {
        switch (lhs, rhs) {
        case (.none, .none):
            true
        case let (.some(lhs), .some(rhs)):
            abs(lhs - rhs) < 0.005
        case (.some, .none), (.none, .some):
            false
        }
    }
}

@MainActor
public final class BodyMeasurementsChartViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<BodyMeasurementTrendData> = .idle
    @Published public private(set) var cachedThrough: String?
    private let repository: any BodyMeasurementsRepositoryProtocol
    private let calendar: Calendar
    private var requestGeneration = 0

    public init(repository: any BodyMeasurementsRepositoryProtocol, calendar: Calendar = .current) {
        self.repository = repository
        self.calendar = calendar
    }

    public var trendData: BodyMeasurementTrendData { state.value ?? BodyMeasurementTrendData(points: []) }

    public func load(range: ChartHistoryRange, cacheCandidates: [ChartHistoryRange] = []) async {
        // Keep the chart mounted, including its selected period, while a wider range loads.
        requestGeneration += 1
        let generation = requestGeneration
        state = .loading(previous: state.value)
        if state.value == nil {
            for candidate in cacheCandidates {
                guard generation == requestGeneration, !Task.isCancelled else { return }
                if let cached = try? await repository.cachedMeasurementChart(range: candidate) {
                    guard generation == requestGeneration, !Task.isCancelled else { return }
                    cachedThrough = candidate == range ? nil : candidate.through
                    state = .loaded(BodyMeasurementTrendBuilder.make(from: cached, calendar: calendar))
                    break
                }
            }
        }
        do {
            for try await measurements in repository.measurementChartUpdates(range: range) {
                guard generation == requestGeneration, !Task.isCancelled else { return }
                cachedThrough = nil
                state = .loaded(BodyMeasurementTrendBuilder.make(from: measurements, calendar: calendar))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            guard generation == requestGeneration else { return }
            state = state.cancellationFallback
        } catch {
            guard generation == requestGeneration, !Task.isCancelled else { return }
            state = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: state.value)
        }
    }
}

@MainActor
public final class BodyMeasurementDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<BodyMeasurement> = .idle

    public let measurementId: String
    private let repository: any BodyMeasurementsRepositoryProtocol

    public init(measurementId: String, repository: any BodyMeasurementsRepositoryProtocol) {
        self.measurementId = measurementId
        self.repository = repository
    }

    public var measurement: BodyMeasurement? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            var receivedValue = false
            var latestMeasurement: BodyMeasurement?
            for try await measurement in repository.measurementUpdates(id: measurementId) {
                receivedValue = true
                latestMeasurement = measurement
                if let measurement { state = .loaded(measurement) }
            }
            if receivedValue, latestMeasurement == nil {
                state = .failed(message: "Measurement not found.", previous: nil)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: state.value)
        }
    }
}

@MainActor
public final class BodyMeasurementEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<BodyMeasurement> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    public let measurementId: String?
    private let repository: any BodyMeasurementsRepositoryProtocol

    public init(measurementId: String?, repository: any BodyMeasurementsRepositoryProtocol) {
        self.measurementId = measurementId
        self.repository = repository
    }

    public var measurement: BodyMeasurement? { state.value }
    public var initialValues: BodyMeasurementFormValues? {
        measurement.map(BodyMeasurementFormModel.values(from:))
    }

    public func load() async {
        guard let measurementId else {
            state = .loaded(BodyMeasurement(
                id: "new",
                measuredOn: DateOnly.todayLocalISO(),
                weightKg: nil,
                bodyFatPct: nil,
                notes: nil,
                updatedAt: nil
            ))
            return
        }

        state = .loading(previous: state.value)
        do {
            guard let measurement = try await repository.editMeasurement(id: measurementId) else {
                state = .failed(message: "Measurement not found.", previous: nil)
                return
            }
            state = .loaded(measurement)
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: state.value)
        }
    }

    public func create(values: BodyMeasurementFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createMeasurement(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: nil)
            return nil
        }
    }

    public func save(values: BodyMeasurementFormValues) async -> Bool {
        guard let measurementId else {
            saveState = .failed(message: "Measurement not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.updateMeasurement(id: measurementId, values: values)
            saveState = .loaded(measurementId)
            return true
        } catch {
            saveState = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: nil)
            return false
        }
    }

    public func delete() async -> Bool {
        guard let measurementId else { return false }
        deleteState = .loading(previous: deleteState.value)
        do {
            try await repository.deleteMeasurement(id: measurementId)
            deleteState = .loaded(measurementId)
            return true
        } catch {
            deleteState = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: nil)
            return false
        }
    }
}
