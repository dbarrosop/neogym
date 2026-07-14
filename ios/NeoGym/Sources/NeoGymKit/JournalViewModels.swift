import Combine
import Foundation

@MainActor
public final class JournalListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[JournalEntry]> = .idle
    @Published public private(set) var labels: [JournalLabel] = []
    @Published public private(set) var selectedLabelIds: [String] = []
    @Published public private(set) var hasMore = false
    @Published public private(set) var isLoadingMore = false
    @Published public private(set) var isRefreshing = false
    @Published public private(set) var loadMoreErrorMessage: String?

    private let repository: any JournalRepositoryProtocol
    private let pageSize: Int

    public init(repository: any JournalRepositoryProtocol, pageSize: Int = JournalRepository.pageSize) {
        self.repository = repository
        self.pageSize = pageSize
    }

    public var entries: [JournalEntry] { state.value ?? [] }
    public var isFiltered: Bool { !selectedLabelIds.isEmpty }
    public var selectedLabelSet: Set<String> { Set(selectedLabelIds) }

    public func load() async {
        guard !isRefreshing, !isLoadingMore else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        state = .loading(previous: state.value)
        loadMoreErrorMessage = nil
        do {
            for try await payload in repository.journalListUpdates(
                limit: pageSize,
                offset: 0,
                labelIds: selectedLabelIds
            ) {
                labels = payload.labels
                hasMore = payload.entries.count == pageSize
                state = .loaded(payload.entries)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func loadMore() async {
        guard hasMore, !isLoadingMore, !isRefreshing else { return }
        isLoadingMore = true
        loadMoreErrorMessage = nil
        defer { isLoadingMore = false }
        let existing = entries
        do {
            for try await payload in repository.journalListUpdates(
                limit: pageSize,
                offset: existing.count,
                labelIds: selectedLabelIds
            ) {
                if labels.isEmpty { labels = payload.labels }
                hasMore = payload.entries.count == pageSize
                state = .loaded(Self.merging(existing, with: payload.entries))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            loadMoreErrorMessage = nil
        } catch {
            loadMoreErrorMessage = GraphQLDomainError.map(error).localizedDescription
        }
    }

    public func toggleLabel(_ id: String) async {
        if selectedLabelIds.contains(id) {
            selectedLabelIds.removeAll { $0 == id }
        } else {
            selectedLabelIds.append(id)
        }
        await load()
    }

    public func clearFilters() async {
        selectedLabelIds.removeAll()
        await load()
    }

    private static func merging(_ existing: [JournalEntry], with page: [JournalEntry]) -> [JournalEntry] {
        var seen = Set(existing.map(\.id))
        return existing + page.filter { seen.insert($0.id).inserted }
    }
}

@MainActor
public final class JournalEntryDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<JournalEntry> = .idle

    public let entryId: String
    private let repository: any JournalRepositoryProtocol

    public init(entryId: String, repository: any JournalRepositoryProtocol) {
        self.entryId = entryId
        self.repository = repository
    }

    public var entry: JournalEntry? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            guard let entry = try await repository.entry(id: entryId) else {
                state = .failed(message: "Entry not found.", previous: nil)
                return
            }
            state = .loaded(entry)
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class JournalEntryEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<JournalEditPayload> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    public let entryId: String?
    private let repository: any JournalRepositoryProtocol

    public init(entryId: String?, repository: any JournalRepositoryProtocol) {
        self.entryId = entryId
        self.repository = repository
    }

    public var entry: JournalEntry? { state.value?.entry }
    public var labels: [JournalLabel] { state.value?.labels ?? [] }
    public var initialValues: JournalEntryFormValues? {
        if let entry {
            return JournalEntryFormModel.values(from: entry)
        }
        if entryId == nil {
            return JournalEntryFormValues(entryDate: DateOnly.todayLocalISO(), title: "", body: "", labels: [])
        }
        return nil
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            if let entryId {
                let payload = try await repository.editEntry(id: entryId)
                guard payload.entry != nil else {
                    state = .failed(message: "Entry not found.", previous: nil)
                    return
                }
                state = .loaded(payload)
            } else {
                let labels = try await repository.labels()
                state = .loaded(JournalEditPayload(entry: nil, labels: labels))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func create(values: JournalEntryFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createEntry(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return nil
        }
    }

    public func save(values: JournalEntryFormValues) async -> Bool {
        guard let entryId, let initialValues else {
            saveState = .failed(message: "Entry not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.saveEntry(id: entryId, initialValues: initialValues, values: values)
            saveState = .loaded(entryId)
            return true
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
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
            deleteState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }
}
