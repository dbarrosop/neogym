import Combine
import Foundation

@MainActor
public final class DailyEnergyListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[DailyEnergy]> = .idle
    @Published public private(set) var hasMore = false
    @Published public private(set) var isLoadingMore = false
    @Published public private(set) var isRefreshing = false
    @Published public private(set) var loadMoreErrorMessage: String?
    /// All of the user's entries, from the first page's aggregate.
    @Published public private(set) var totalCount: Int?
    /// The list shows the latest five, then five more per Load more; server
    /// pages stay `pageSize` long and load when the window passes them.
    @Published public private(set) var window = EntryHistoryWindow()

    private let repository: any DailyEnergyRepositoryProtocol
    private let calendar: Calendar
    private let pageSize: Int

    public init(
        repository: any DailyEnergyRepositoryProtocol,
        calendar: Calendar = .current,
        pageSize: Int = DailyEnergyRepository.pageSize
    ) {
        self.repository = repository
        self.calendar = calendar
        self.pageSize = pageSize
    }

    public var entries: [DailyEnergy] { state.value ?? [] }
    public var visibleEntries: [DailyEnergy] { window.visible(entries) }
    public var canShowMore: Bool { window.canShowMore(loadedCount: entries.count, hasMoreRemote: hasMore) }
    /// "5 of 41", once the total is known.
    public var countLabel: String? {
        EntryHistoryWindow.countLabel(shown: visibleEntries.count, total: totalCount)
    }

    /// Shows the next five entries, loading the next server page first when
    /// the window runs past the loaded ones.
    public func showMore() async {
        guard canShowMore else { return }
        if window.limit + EntryHistoryWindow.pageSize > entries.count, hasMore {
            await loadMore()
        }
        window.showMore()
    }
    public var trendData: DailyEnergyTrendData {
        DailyEnergyTrendBuilder.make(from: entries, calendar: calendar)
    }

    public func load() async {
        guard !isRefreshing, !isLoadingMore else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        state = .loading(previous: state.value)
        loadMoreErrorMessage = nil
        do {
            try await loadEnergyUpdates()
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: DailyEnergyErrorMapper.message(for: error), previous: state.value)
        }
    }

    private func loadEnergyUpdates() async throws {
        for try await page in repository.energyListPageUpdates(limit: pageSize, offset: 0) {
            hasMore = page.entries.count == pageSize
            if let total = page.totalCount { totalCount = total }
            state = .loaded(page.entries)
        }
    }

    public func loadMore() async {
        guard hasMore, !isLoadingMore, !isRefreshing else { return }
        isLoadingMore = true
        loadMoreErrorMessage = nil
        defer { isLoadingMore = false }
        let existing = entries
        do {
            for try await page in repository.energyListPageUpdates(
                limit: pageSize,
                offset: existing.count
            ) {
                hasMore = page.entries.count == pageSize
                if let total = page.totalCount { totalCount = total }
                state = .loaded(Self.merging(existing, with: page.entries))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            loadMoreErrorMessage = nil
        } catch {
            loadMoreErrorMessage = DailyEnergyErrorMapper.message(for: error)
        }
    }

    private static func merging(_ existing: [DailyEnergy], with page: [DailyEnergy]) -> [DailyEnergy] {
        var seen = Set(existing.map(\.id))
        return existing + page.filter { seen.insert($0.id).inserted }
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
            var receivedValue = false
            var latestEntry: DailyEnergy?
            for try await entry in repository.entryUpdates(id: entryId) {
                receivedValue = true
                latestEntry = entry
                if let entry { state = .loaded(entry) }
            }
            if receivedValue, latestEntry == nil {
                state = .failed(message: "Energy entry not found.", previous: nil)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
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
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
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
