import Combine
import Foundation

@MainActor
public final class BodyMeasurementsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[BodyMeasurement]> = .idle
    @Published public private(set) var healthSyncState: Loadable<BodyMeasurementsHealthSyncSummary> = .idle

    private let repository: any BodyMeasurementsRepositoryProtocol
    private let healthImporter: (any BodyMeasurementsHealthImporting)?
    private let calendar: Calendar

    public init(
        repository: any BodyMeasurementsRepositoryProtocol,
        healthImporter: (any BodyMeasurementsHealthImporting)? = nil,
        calendar: Calendar = .current
    ) {
        self.repository = repository
        self.healthImporter = healthImporter
        self.calendar = calendar
    }

    public var measurements: [BodyMeasurement] { state.value ?? [] }
    public var trendData: BodyMeasurementTrendData {
        BodyMeasurementTrendBuilder.make(from: measurements, calendar: calendar)
    }

    public func load(shouldSyncHealthMeasurements: Bool = false) async {
        state = .loading(previous: state.value)
        do {
            let measurements = try await repository.listMeasurements()
            state = .loaded(measurements)
            if shouldSyncHealthMeasurements {
                await syncHealthMeasurements(skippingExistingDatesFrom: measurements)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: state.value)
        }
    }

    private func syncHealthMeasurements(skippingExistingDatesFrom measurements: [BodyMeasurement]) async {
        guard let healthImporter else { return }
        let existingDates = Set(measurements.map(\.measuredOn))
        healthSyncState = .loading(previous: healthSyncState.value)
        do {
            let importedMeasurements = try await healthImporter.dailyMeasurements()
            let importableValues = importedMeasurements.compactMap { measurement -> BodyMeasurementFormValues? in
                guard !existingDates.contains(measurement.measuredOn) else { return nil }
                return measurement.formValues(notes: "Imported from Apple Health")
            }
            for values in importableValues {
                _ = try await repository.createMeasurement(values)
            }
            if !importableValues.isEmpty {
                state = .loaded(try await repository.listMeasurements())
            }
            healthSyncState = .loaded(BodyMeasurementsHealthSyncSummary(
                importedCount: importableValues.count,
                skippedExistingCount: importedMeasurements.count - importableValues.count
            ))
        } catch where GraphQLDomainError.isCancellation(error) {
            healthSyncState = healthSyncState.cancellationFallback
        } catch {
            healthSyncState = .failed(message: BodyMeasurementsErrorMapper.message(for: error), previous: healthSyncState.value)
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
