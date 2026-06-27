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
    @Published public private(set) var hasNextPage = true

    private let repository: any SessionsRepositoryProtocol
    private let pageSize: Int

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
        state = .loading(previous: state.value)
        do {
            let loaded = try await repository.listSessions(limit: pageSize, offset: 0)
            hasNextPage = loaded.count == pageSize
            state = .loaded(loaded)
        } catch is CancellationError {
            state = state.value.map(Loadable.loaded) ?? .idle
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func loadMore() async {
        guard hasNextPage, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let loaded = try await repository.listSessions(limit: pageSize, offset: sessions.count)
            hasNextPage = loaded.count == pageSize
            state = .loaded(sessions + loaded)
        } catch is CancellationError {
            // A view transition can cancel pagination/list reloads; keep the current list instead of surfacing it.
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class SessionDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<SessionDetailModel> = .idle
    @Published public private(set) var priorHistoryState: Loadable<SessionPriorHistory> = .idle
    @Published public private(set) var mutationState: Loadable<String> = .idle

    public let sessionId: String
    private let repository: any SessionsRepositoryProtocol

    public init(sessionId: String, repository: any SessionsRepositoryProtocol) {
        self.sessionId = sessionId
        self.repository = repository
    }

    public var session: SessionDetailModel? { state.value }
    public var displayName: String { session?.displayName ?? SessionDisplayName.untitled }
    public var totals: SessionStrengthTotals {
        session?.strengthTotals ?? SessionStrengthTotals(sets: 0, reps: 0, volume: 0, hasStrength: false)
    }

    public var priorStrengthByExercise: [String: [SessionPriorStrengthEntry]] {
        priorHistoryState.value?.strengthByExercise ?? [:]
    }

    public var priorCardioByExercise: [String: [SessionPriorCardioEntry]] {
        priorHistoryState.value?.cardioByExercise ?? [:]
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            guard let session = try await repository.sessionDetail(id: sessionId) else {
                state = .failed(message: "Session not found.", previous: nil)
                priorHistoryState = .loaded(SessionPriorHistory())
                return
            }
            state = .loaded(session)
            await loadPriorHistory(for: session)
        } catch {
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

    public func addStrengthSet(workoutSessionExerciseId: String, reps: Int, weight: Double) async -> Bool {
        let row = session?.workoutSessionExercises.first { $0.id == workoutSessionExerciseId }
        let nextSetNumber = (row?.workoutSessionStrengthSets.map(\.setNumber).max() ?? 0) + 1
        return await mutate(label: "InsertWorkoutSessionStrengthSet", reload: true) {
            _ = try await repository.addStrengthSet(
                workoutSessionExerciseId: workoutSessionExerciseId,
                setNumber: nextSetNumber,
                reps: reps,
                weight: weight
            )
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

    private func loadPriorHistory(for session: SessionDetailModel) async {
        let exerciseIds = session.workoutSessionExercises.map(\.exercise.id)
        guard !exerciseIds.isEmpty else {
            priorHistoryState = .loaded(SessionPriorHistory())
            return
        }
        priorHistoryState = .loading(previous: priorHistoryState.value)
        do {
            let history = try await repository.priorSessionsPerExercise(
                exerciseIds: exerciseIds,
                excludeSessionId: session.id
            )
            priorHistoryState = .loaded(history)
        } catch {
            // Prior history is decorative; keep the main session detail usable if it fails.
            priorHistoryState = .failed(
                message: GraphQLDomainError.map(error).localizedDescription,
                previous: priorHistoryState.value ?? SessionPriorHistory()
            )
        }
    }

    private func mutate(label: String, reload: Bool, operation: () async throws -> Void) async -> Bool {
        mutationState = .loading(previous: mutationState.value)
        do {
            try await operation()
            mutationState = .loaded(label)
            if reload {
                await load()
            }
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
