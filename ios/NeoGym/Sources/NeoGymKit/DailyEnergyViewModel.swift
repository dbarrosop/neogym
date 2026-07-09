import Combine
import Foundation

@MainActor
public final class DailyEnergyListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[DailyEnergy]> = .idle
    @Published public private(set) var healthSyncState: Loadable<DailyEnergyHealthSyncSummary> = .idle
    @Published public private(set) var hasMore = false
    @Published public private(set) var isLoadingMore = false
    @Published public private(set) var loadMoreErrorMessage: String?

    private let repository: any DailyEnergyRepositoryProtocol
    private let healthImporter: (any DailyEnergyHealthImporting)?
    private let calendar: Calendar
    private let pageSize: Int
    private let healthRefreshLookbackDays: Int
    private let now: @Sendable () -> Date

    private static let healthImportNote = "Imported from Apple Health"

    public init(
        repository: any DailyEnergyRepositoryProtocol,
        healthImporter: (any DailyEnergyHealthImporting)? = nil,
        calendar: Calendar = .current,
        pageSize: Int = DailyEnergyRepository.pageSize,
        healthRefreshLookbackDays: Int = 7,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.repository = repository
        self.healthImporter = healthImporter
        self.calendar = calendar
        self.pageSize = pageSize
        self.healthRefreshLookbackDays = healthRefreshLookbackDays
        self.now = now
    }

    public var entries: [DailyEnergy] { state.value ?? [] }
    public var trendData: DailyEnergyTrendData {
        DailyEnergyTrendBuilder.make(from: entries, calendar: calendar)
    }

    public func load(shouldSyncHealthEnergy: Bool = false) async {
        state = .loading(previous: state.value)
        loadMoreErrorMessage = nil
        do {
            let entries = try await repository.listEntries(limit: pageSize, offset: 0)
            hasMore = entries.count == pageSize
            state = .loaded(entries)
            if shouldSyncHealthEnergy {
                await syncHealthEnergy(skippingExistingDatesFrom: entries)
            }
        } catch {
            state = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: state.value)
        }
    }

    public func loadMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        loadMoreErrorMessage = nil
        defer { isLoadingMore = false }
        do {
            let nextEntries = try await repository.listEntries(limit: pageSize, offset: entries.count)
            hasMore = nextEntries.count == pageSize
            state = .loaded(entries + nextEntries)
        } catch {
            loadMoreErrorMessage = DailyEnergyErrorMapper.message(for: error)
        }
    }

    private func syncHealthEnergy(skippingExistingDatesFrom entries: [DailyEnergy]) async {
        guard let healthImporter else { return }
        let refreshStart = healthRefreshStartDate()
        var knownDates = Set(entries.map(\.energyOn))
        if let allEntryDates = try? await repository.listEntryDates() {
            knownDates.formUnion(allEntryDates)
        }
        let refreshableEntries = (try? await repository.listEntriesForHealthRefresh(since: refreshStart))
            ?? entries.filter { $0.energyOn >= refreshStart }
        let refreshableEntriesByDate = Dictionary(uniqueKeysWithValues: refreshableEntries.map { ($0.energyOn, $0) })
        var importedCount = 0
        var updatedCount = 0
        var skippedExistingCount = 0
        var shouldReload = false
        healthSyncState = .loading(previous: healthSyncState.value)
        do {
            let importedEntries = try await healthImporter.dailyEnergyEntries()
            for entry in importedEntries {
                guard let values = entry.formValues(notes: Self.healthImportNote) else { continue }

                if let existingEntry = refreshableEntriesByDate[entry.energyOn] {
                    guard existingEntry.notes == Self.healthImportNote else {
                        skippedExistingCount += 1
                        continue
                    }
                    guard shouldUpdateHealthImportedEntry(existingEntry, with: values) else {
                        skippedExistingCount += 1
                        continue
                    }
                    try await repository.updateEntry(id: existingEntry.id, values: values)
                    knownDates.insert(values.energyOn)
                    updatedCount += 1
                    shouldReload = true
                    continue
                }

                guard !knownDates.contains(entry.energyOn) else {
                    skippedExistingCount += 1
                    continue
                }

                do {
                    _ = try await repository.createEntry(values)
                    knownDates.insert(values.energyOn)
                    importedCount += 1
                    shouldReload = true
                } catch where DailyEnergyErrorMapper.isDuplicateEnergyOnError(error) {
                    knownDates.insert(values.energyOn)
                    skippedExistingCount += 1
                    shouldReload = true
                }
            }
            if shouldReload {
                let entries = try await repository.listEntries(limit: pageSize, offset: 0)
                hasMore = entries.count == pageSize
                state = .loaded(entries)
            }
            healthSyncState = .loaded(DailyEnergyHealthSyncSummary(
                importedCount: importedCount,
                updatedCount: updatedCount,
                skippedExistingCount: skippedExistingCount
            ))
        } catch {
            healthSyncState = .failed(
                message: DailyEnergyErrorMapper.message(for: error),
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

    private func shouldUpdateHealthImportedEntry(_ entry: DailyEnergy, with values: DailyEnergyFormValues) -> Bool {
        !approximatelyEqual(entry.activeKcal, Double(values.activeKcal))
            || !approximatelyEqual(entry.restingKcal, Double(values.restingKcal))
            || entry.notes != values.notes
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
