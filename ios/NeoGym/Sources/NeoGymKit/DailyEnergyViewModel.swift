import Combine
import Foundation

@MainActor
public final class DailyEnergyListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[DailyEnergy]> = .idle
    @Published public private(set) var healthSyncState: Loadable<DailyEnergyHealthSyncSummary> = .idle

    private let repository: any DailyEnergyRepositoryProtocol
    private let healthImporter: (any DailyEnergyHealthImporting)?
    private let calendar: Calendar

    public init(
        repository: any DailyEnergyRepositoryProtocol,
        healthImporter: (any DailyEnergyHealthImporting)? = nil,
        calendar: Calendar = .current
    ) {
        self.repository = repository
        self.healthImporter = healthImporter
        self.calendar = calendar
    }

    public var entries: [DailyEnergy] { state.value ?? [] }
    public var trendData: DailyEnergyTrendData {
        DailyEnergyTrendBuilder.make(from: entries, calendar: calendar)
    }

    public func load(shouldSyncHealthEnergy: Bool = false) async {
        state = .loading(previous: state.value)
        do {
            let entries = try await repository.listEntries()
            state = .loaded(entries)
            if shouldSyncHealthEnergy {
                await syncHealthEnergy(skippingExistingDatesFrom: entries)
            }
        } catch {
            state = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: state.value)
        }
    }

    private func syncHealthEnergy(skippingExistingDatesFrom entries: [DailyEnergy]) async {
        guard let healthImporter else { return }
        let existingDates = Set(entries.map(\.energyOn))
        healthSyncState = .loading(previous: healthSyncState.value)
        do {
            let importedEntries = try await healthImporter.dailyEnergyEntries()
            let importableValues = importedEntries.compactMap { entry -> DailyEnergyFormValues? in
                guard !existingDates.contains(entry.energyOn) else { return nil }
                return entry.formValues(notes: "Imported from Apple Health")
            }
            for values in importableValues {
                _ = try await repository.createEntry(values)
            }
            if !importableValues.isEmpty {
                state = .loaded(try await repository.listEntries())
            }
            healthSyncState = .loaded(DailyEnergyHealthSyncSummary(
                importedCount: importableValues.count,
                skippedExistingCount: importedEntries.count - importableValues.count
            ))
        } catch {
            healthSyncState = .failed(
                message: DailyEnergyErrorMapper.message(for: error),
                previous: healthSyncState.value
            )
        }
    }
}

@MainActor
public final class DailyEnergyDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<DailyEnergy> = .idle

    public let entryId: String
    private let repository: any DailyEnergyRepositoryProtocol

    public init(entryId: String, repository: any DailyEnergyRepositoryProtocol) {
        self.entryId = entryId
        self.repository = repository
    }

    public var entry: DailyEnergy? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            guard let entry = try await repository.entry(id: entryId) else {
                state = .failed(message: "Energy entry not found.", previous: nil)
                return
            }
            state = .loaded(entry)
        } catch {
            state = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: state.value)
        }
    }
}

@MainActor
public final class DailyEnergyEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<DailyEnergy> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    public let entryId: String?
    private let repository: any DailyEnergyRepositoryProtocol

    public init(entryId: String?, repository: any DailyEnergyRepositoryProtocol) {
        self.entryId = entryId
        self.repository = repository
    }

    public var entry: DailyEnergy? { state.value }
    public var initialValues: DailyEnergyFormValues? {
        entry.map(DailyEnergyFormModel.values(from:))
    }

    public func load() async {
        guard let entryId else {
            state = .loaded(DailyEnergy(
                id: "new",
                energyOn: DateOnly.todayLocalISO(),
                activeKcal: nil,
                restingKcal: nil,
                notes: nil,
                updatedAt: nil
            ))
            return
        }

        state = .loading(previous: state.value)
        do {
            guard let entry = try await repository.editEntry(id: entryId) else {
                state = .failed(message: "Energy entry not found.", previous: nil)
                return
            }
            state = .loaded(entry)
        } catch {
            state = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: state.value)
        }
    }

    public func create(values: DailyEnergyFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createEntry(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: nil)
            return nil
        }
    }

    public func save(values: DailyEnergyFormValues) async -> Bool {
        guard let entryId else {
            saveState = .failed(message: "Energy entry not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.updateEntry(id: entryId, values: values)
            saveState = .loaded(entryId)
            return true
        } catch {
            saveState = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: nil)
            return false
        }
    }

    public func delete() async -> Bool {
        guard let entryId else { return false }
        deleteState = .loading(previous: deleteState.value)
        do {
            try await repository.deleteEntry(id: entryId)
            deleteState = .loaded(entryId)
            return true
        } catch {
            deleteState = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: nil)
            return false
        }
    }
}
