import Combine
import Foundation

public struct SessionMonthGroup: Identifiable, Sendable, Equatable {
    public let id: String
    public let title: String
    public let sessions: [SessionListItem]

    public init(id: String, title: String, sessions: [SessionListItem]) {
        self.id = id
        self.title = title
        self.sessions = sessions
    }
}

@MainActor
public final class SessionsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[SessionListItem]> = .idle
    @Published public private(set) var isLoadingMore = false
    @Published public private(set) var isRefreshing = false
    @Published public private(set) var hasNextPage = true

    private let repository: any SessionsRepositoryProtocol
    private let pageSize: Int
    private var needsReload = false

    public init(repository: any SessionsRepositoryProtocol, pageSize: Int = 25) {
        self.repository = repository
        self.pageSize = pageSize
    }

    public var sessions: [SessionListItem] { state.value ?? [] }

    public var monthGroups: [SessionMonthGroup] {
        var calendar = Calendar.current
        calendar.timeZone = TimeZone.current
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.calendar = calendar
        formatter.dateFormat = "MMMM yyyy"

        var groups: [(id: String, title: String, sessions: [SessionListItem])] = []
        for session in sessions {
            let date = session.startedAtDate ?? .distantPast
            let components = calendar.dateComponents([.year, .month], from: date)
            let id = String(format: "%04d-%02d", components.year ?? 0, components.month ?? 0)
            if let lastIndex = groups.indices.last, groups[lastIndex].id == id {
                groups[lastIndex].sessions.append(session)
            } else {
                groups.append((id: id, title: formatter.string(from: date), sessions: [session]))
            }
        }
        return groups.map(SessionMonthGroup.init(id:title:sessions:))
    }

    public func load() async {
        guard !isRefreshing, !isLoadingMore else {
            needsReload = true
            return
        }

        isRefreshing = true
        repeat {
            needsReload = false
            await loadFirstPage()
        } while needsReload
        isRefreshing = false
    }

    public func loadMore() async {
        guard hasNextPage, !isLoadingMore, !isRefreshing else { return }
        isLoadingMore = true
        let existing = sessions
        do {
            for try await loaded in repository.sessionListUpdates(
                limit: pageSize,
                offset: existing.count
            ) {
                hasNextPage = loaded.count == pageSize
                state = .loaded(Self.merging(existing, with: loaded))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
        isLoadingMore = false
        if needsReload { await load() }
    }

    private func loadFirstPage() async {
        state = .loading(previous: state.value)
        do {
            for try await loaded in repository.sessionListUpdates(limit: pageSize, offset: 0) {
                hasNextPage = loaded.count == pageSize
                state = .loaded(loaded)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    private static func merging(
        _ existing: [SessionListItem],
        with page: [SessionListItem]
    ) -> [SessionListItem] {
        var seen = Set(existing.map(\.id))
        return existing + page.filter { seen.insert($0.id).inserted }
    }
}

@MainActor
public final class SessionDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<SessionDetailModel> = .idle
    @Published public private(set) var priorHistoryState: Loadable<SessionPriorHistory> = .idle
    @Published public private(set) var priorWorkoutState: Loadable<[SessionDetailModel]> = .idle
    @Published public private(set) var mutationState: Loadable<String> = .idle

    public let sessionId: String
    private let repository: any SessionsRepositoryProtocol
    private var loadVersion = 0
    private var loadedPriorHistoryKey: PriorHistoryKey?
    private var loadedPriorWorkoutKey: PriorWorkoutKey?

    private struct PriorHistoryKey: Equatable {
        let exerciseIds: [String]
        let startedAt: Date
        let workoutId: String?
        let sessionId: String
    }

    private struct PriorWorkoutKey: Equatable {
        let workoutId: String
        let startedAt: Date
        let sessionId: String
    }

    public init(sessionId: String, repository: any SessionsRepositoryProtocol) {
        self.sessionId = sessionId
        self.repository = repository
    }

    public var session: SessionDetailModel? { state.value }
    public var displayName: String { session?.displayName ?? SessionDisplayName.untitled }
    public var totals: SessionStrengthTotals {
        session?.strengthTotals ?? SessionStrengthTotals(sets: 0, reps: 0, volume: 0, hasStrength: false)
    }

    public var priorWorkoutSessions: [SessionDetailModel] { priorWorkoutState.value ?? [] }

    public var priorStrengthByExercise: [String: [SessionPriorStrengthEntry]] {
        priorHistoryState.value?.strengthByExercise ?? [:]
    }

    public var priorCardioByExercise: [String: [SessionPriorCardioEntry]] {
        priorHistoryState.value?.cardioByExercise ?? [:]
    }

    public func load(refreshComparisons: Bool = false) async {
        loadVersion += 1
        let version = loadVersion
        state = .loading(previous: state.value)
        do {
            try Task.checkCancellation()
            var receivedValue = false
            var latestSession: SessionDetailModel?
            for try await session in repository.sessionDetailUpdates(id: sessionId) {
                guard version == loadVersion else { return }
                try Task.checkCancellation()
                receivedValue = true
                latestSession = session
                if let session { state = .loaded(session) }
            }
            guard version == loadVersion else { return }
            try Task.checkCancellation()
            guard let latestSession else {
                if receivedValue {
                    state = .failed(message: "Session not found.", previous: nil)
                    priorHistoryState = .loaded(SessionPriorHistory())
                    loadedPriorHistoryKey = nil
                    priorWorkoutState = .loaded([])
                    loadedPriorWorkoutKey = nil
                }
                return
            }
            await loadPriorHistory(for: latestSession, force: refreshComparisons, version: version)
            guard version == loadVersion else { return }
            try Task.checkCancellation()
            await loadPriorWorkoutSessions(for: latestSession, force: refreshComparisons, version: version)
        } catch where GraphQLDomainError.isCancellation(error) {
            guard version == loadVersion else { return }
            state = state.cancellationFallback
        } catch {
            guard version == loadVersion else { return }
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func updateStartedAt(_ startedAt: Date) async -> Bool {
        await mutate(label: "UpdateSessionStartedAt", reload: true) {
            try await repository.updateStartedAt(sessionId: sessionId, startedAt: startedAt)
        }
    }

    public func deleteSession() async -> Bool {
        await mutate(label: "DeleteWorkoutSession", reload: false) {
            try await repository.deleteSession(id: sessionId)
        }
    }

    public func addExercises(_ exercises: [ExerciseListItem]) async -> Bool {
        guard !exercises.isEmpty else { return true }
        let basePosition = session?.maxPosition ?? 0
        return await mutate(label: "InsertWorkoutSessionExercises", reload: true) {
            try await repository.addSessionExercises(
                sessionId: sessionId,
                exercises: exercises,
                basePosition: basePosition
            )
        }
    }

    public func removeExercise(id: String) async -> Bool {
        await mutate(label: "DeleteWorkoutSessionExercise", reload: true) {
            try await repository.removeSessionExercise(id: id)
        }
    }

    /// Reports the recorded insert before reloading; the method still awaits that reload.
    public func addStrengthSet(
        workoutSessionExerciseId: String,
        reps: Int,
        weight: Double,
        onInserted: @MainActor () -> Void = {}
    ) async -> Bool {
        let row = session?.workoutSessionExercises.first { $0.id == workoutSessionExerciseId }
        let nextSetNumber = StrengthSetNumbering.nextSetNumber(currentSets: row?.workoutSessionStrengthSets ?? [])
        return await mutate(label: "InsertWorkoutSessionStrengthSet", reload: true) {
            _ = try await repository.addStrengthSet(
                workoutSessionExerciseId: workoutSessionExerciseId,
                setNumber: nextSetNumber,
                reps: reps,
                weight: weight
            )
            onInserted()
        }
    }

    public func updateStrengthSet(id: String, reps: Int, weight: Double) async -> Bool {
        await mutate(label: "UpdateWorkoutSessionStrengthSet", reload: true) {
            try await repository.updateStrengthSet(id: id, reps: reps, weight: weight)
        }
    }

    public func deleteStrengthSet(id: String) async -> Bool {
        await mutate(label: "DeleteWorkoutSessionStrengthSet", reload: true) {
            try await repository.deleteStrengthSet(id: id)
        }
    }

    public func addCardioEntry(workoutSessionExerciseId: String, metrics: CardioMetrics) async -> Bool {
        let row = session?.workoutSessionExercises.first { $0.id == workoutSessionExerciseId }
        let nextEntryNumber = (row?.workoutSessionCardioEntries.map(\.entryNumber).max() ?? 0) + 1
        return await mutate(label: "InsertWorkoutSessionCardioEntry", reload: true) {
            _ = try await repository.addCardioEntry(
                workoutSessionExerciseId: workoutSessionExerciseId,
                entryNumber: nextEntryNumber,
                metrics: metrics
            )
        }
    }

    public func updateCardioEntry(id: String, metrics: CardioMetrics) async -> Bool {
        await mutate(label: "UpdateWorkoutSessionCardioEntry", reload: true) {
            try await repository.updateCardioEntry(id: id, metrics: metrics)
        }
    }

    public func deleteCardioEntry(id: String) async -> Bool {
        await mutate(label: "DeleteWorkoutSessionCardioEntry", reload: true) {
            try await repository.deleteCardioEntry(id: id)
        }
    }

    private func loadPriorHistory(for session: SessionDetailModel, force: Bool, version: Int) async {
        let exerciseIds = Set(session.workoutSessionExercises.map(\.exercise.id)).sorted()
        guard !exerciseIds.isEmpty else {
            loadedPriorHistoryKey = nil
            priorHistoryState = .loaded(SessionPriorHistory())
            return
        }
        let key = PriorHistoryKey(
            exerciseIds: exerciseIds, startedAt: session.startedAtDate ?? AppClock.now(),
            workoutId: session.workout?.id, sessionId: session.id
        )
        if !force, loadedPriorHistoryKey == key, case .loaded = priorHistoryState { return }
        // Failed or cancelled refreshes must not mark the retained fallback as current.
        loadedPriorHistoryKey = nil
        priorHistoryState = .loading(previous: priorHistoryState.value)
        do {
            let history = try await repository.priorSessionsPerExercise(
                exerciseIds: key.exerciseIds,
                before: key.startedAt,
                workoutId: key.workoutId,
                excludeSessionId: key.sessionId
            )
            guard version == loadVersion else { return }
            try Task.checkCancellation()
            loadedPriorHistoryKey = key
            priorHistoryState = .loaded(history)
        } catch where GraphQLDomainError.isCancellation(error) {
            guard version == loadVersion else { return }
            priorHistoryState = priorHistoryState.cancellationFallback
        } catch {
            guard version == loadVersion else { return }
            // Prior history is decorative; keep the main session detail usable if it fails.
            priorHistoryState = .failed(
                message: GraphQLDomainError.map(error).localizedDescription,
                previous: priorHistoryState.value ?? SessionPriorHistory()
            )
        }
    }

    private func loadPriorWorkoutSessions(for session: SessionDetailModel, force: Bool, version: Int) async {
        guard let workoutId = session.workout?.id, let startedAt = session.startedAtDate else {
            loadedPriorWorkoutKey = nil
            priorWorkoutState = .loaded([])
            return
        }
        let key = PriorWorkoutKey(workoutId: workoutId, startedAt: startedAt, sessionId: session.id)
        if !force, loadedPriorWorkoutKey == key, case .loaded = priorWorkoutState { return }
        loadedPriorWorkoutKey = nil
        priorWorkoutState = .loading(previous: priorWorkoutState.value)
        do {
            let sessions = try await repository.priorWorkoutSessions(
                workoutId: workoutId,
                before: startedAt,
                excludeSessionId: session.id
            )
            guard version == loadVersion else { return }
            try Task.checkCancellation()
            loadedPriorWorkoutKey = key
            priorWorkoutState = .loaded(sessions)
        } catch where GraphQLDomainError.isCancellation(error) {
            guard version == loadVersion else { return }
            priorWorkoutState = priorWorkoutState.cancellationFallback
        } catch {
            guard version == loadVersion else { return }
            // Comparison history should not prevent editing this session.
            priorWorkoutState = .failed(
                message: GraphQLDomainError.map(error).localizedDescription,
                previous: priorWorkoutState.value ?? []
            )
        }
    }

    private func mutate(label: String, reload: Bool, operation: () async throws -> Void) async -> Bool {
        mutationState = .loading(previous: mutationState.value)
        do {
            try await operation()
            if reload {
                await load()
            }
            mutationState = .loaded(label)
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }
}

public enum SessionSetFormValidationResult: Sendable, Equatable {
    case success(reps: Int, weight: Double)
    case failure(String)
}

public enum SessionSetFormValidator {
    public static func validate(repsText: String, weightText: String) -> SessionSetFormValidationResult {
        let trimmedReps = repsText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedWeight = weightText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard let reps = Int(trimmedReps), reps >= 0 else {
            return .failure("Reps must be a whole number ≥ 0.")
        }
        guard let weight = Double(trimmedWeight), weight.isFinite, weight >= 0 else {
            return .failure("Weight must be a number ≥ 0.")
        }
        return .success(reps: reps, weight: weight)
    }
}
