import Combine
import Foundation

@MainActor
public final class BodyMeasurementsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[BodyMeasurement]> = .idle
    @Published public private(set) var healthSyncState: Loadable<BodyMeasurementsHealthSyncSummary> = .idle

    private let repository: any BodyMeasurementsRepositoryProtocol
    private let healthImporter: (any BodyMeasurementsHealthImporting)?
    private let calendar: Calendar
    private let healthRefreshLookbackDays: Int
    private let now: @Sendable () -> Date

    private static let healthImportNote = "Imported from Apple Health"

    public init(
        repository: any BodyMeasurementsRepositoryProtocol,
        healthImporter: (any BodyMeasurementsHealthImporting)? = nil,
        calendar: Calendar = .current,
        healthRefreshLookbackDays: Int = 7,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.repository = repository
        self.healthImporter = healthImporter
        self.calendar = calendar
        self.healthRefreshLookbackDays = healthRefreshLookbackDays
        self.now = now
    }

    public var measurements: [BodyMeasurement] { state.value ?? [] }
    public var trendData: BodyMeasurementTrendData {
        BodyMeasurementTrendBuilder.make(from: measurements, calendar: calendar)
    }

    public func load(shouldSyncHealthMeasurements: Bool = false) async {
        state = .loading(previous: state.value)
        do {
            if shouldSyncHealthMeasurements {
                async let initialLoad: Void = loadMeasurementUpdates()
                await syncHealthMeasurements()
                try await initialLoad
                try await loadMeasurementUpdates()
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

    private func syncHealthMeasurements() async {
        guard let healthImporter else { return }
        healthSyncState = .loading(previous: healthSyncState.value)
        do {
            async let importedMeasurementsTask = healthImporter.dailyMeasurements()
            async let existingMeasurementsTask = repository.listMeasurements()

            let importedMeasurements = try await importedMeasurementsTask
            let existingMeasurements = (try? await existingMeasurementsTask) ?? []
            let refreshStart = healthRefreshStartDate()
            var knownDates = Set(existingMeasurements.map(\.measuredOn))
            let existingMeasurementsByDate = Dictionary(
                uniqueKeysWithValues: existingMeasurements.map { ($0.measuredOn, $0) }
            )
            var importedCount = 0
            var updatedCount = 0
            var skippedExistingCount = 0

            for measurement in importedMeasurements {
                guard let values = measurement.formValues(notes: Self.healthImportNote) else { continue }

                if let existingMeasurement = existingMeasurementsByDate[measurement.measuredOn] {
                    guard existingMeasurement.measuredOn >= refreshStart,
                          existingMeasurement.notes == Self.healthImportNote,
                          shouldUpdateHealthImportedMeasurement(existingMeasurement, with: values)
                    else {
                        skippedExistingCount += 1
                        continue
                    }
                    try await repository.updateMeasurement(id: existingMeasurement.id, values: values)
                    knownDates.insert(values.measuredOn)
                    updatedCount += 1
                    continue
                }

                guard !knownDates.contains(measurement.measuredOn) else {
                    skippedExistingCount += 1
                    continue
                }

                do {
                    _ = try await repository.createMeasurement(values)
                    knownDates.insert(values.measuredOn)
                    importedCount += 1
                } catch where BodyMeasurementsErrorMapper.isDuplicateMeasuredOnError(error) {
                    knownDates.insert(values.measuredOn)
                    skippedExistingCount += 1
                }
            }
            healthSyncState = .loaded(BodyMeasurementsHealthSyncSummary(
                importedCount: importedCount,
                updatedCount: updatedCount,
                skippedExistingCount: skippedExistingCount
            ))
        } catch where GraphQLDomainError.isCancellation(error) {
            healthSyncState = healthSyncState.cancellationFallback
        } catch {
            healthSyncState = .failed(
                message: BodyMeasurementsErrorMapper.message(for: error),
                previous: healthSyncState.value
            )
        }
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
            guard let measurement = try await repository.measurement(id: measurementId) else {
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
