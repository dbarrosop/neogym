import Combine
import Foundation

@MainActor
public final class WorkoutsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<WorkoutIndexPayload> = .idle
    @Published public var visibility: WorkoutVisibilityFilter?
    @Published public var selectedLabelIds: Set<String> = []

    private let repository: any WorkoutsRepositoryProtocol

    public init(repository: any WorkoutsRepositoryProtocol) {
        self.repository = repository
    }

    public var workouts: [WorkoutListItem] { state.value?.workouts ?? [] }
    public var labels: [WorkoutLabel] { state.value?.labels ?? [] }

    public var isFiltered: Bool {
        visibility != nil || !selectedLabelIds.isEmpty
    }

    public var filteredWorkouts: [WorkoutListItem] {
        workouts.filter { workout in
            if visibility == .mine, workout.isPublic { return false }
            if visibility == .public, !workout.isPublic { return false }
            if !selectedLabelIds.isEmpty {
                let ids = Set(workout.workoutLabels.map(\.labelId))
                if !selectedLabelIds.isSubset(of: ids) { return false }
            }
            return true
        }
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            for try await payload in repository.workoutListUpdates() {
                state = .loaded(payload)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func toggleVisibility(_ next: WorkoutVisibilityFilter) {
        visibility = visibility == next ? nil : next
    }

    public func toggleLabel(_ id: String) {
        if selectedLabelIds.contains(id) {
            selectedLabelIds.remove(id)
        } else {
            selectedLabelIds.insert(id)
        }
    }

    public func clearFilters() {
        visibility = nil
        selectedLabelIds = []
    }
}

@MainActor
public final class WorkoutDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<WorkoutDetailModel> = .idle
    @Published public private(set) var startState: Loadable<String> = .idle

    public let workoutId: String
    private let repository: any WorkoutsRepositoryProtocol
    private let now: @Sendable () -> Date

    public init(
        workoutId: String,
        repository: any WorkoutsRepositoryProtocol,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.workoutId = workoutId
        self.repository = repository
        self.now = now
    }

    public var workout: WorkoutDetailModel? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            var receivedValue = false
            var latestWorkout: WorkoutDetailModel?
            for try await workout in repository.workoutDetailUpdates(id: workoutId) {
                receivedValue = true
                latestWorkout = workout
                if let workout { state = .loaded(workout) }
            }
            if receivedValue, latestWorkout == nil {
                state = .failed(message: "Workout not found.", previous: nil)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func startSession() async -> String? {
        guard let workout else { return nil }
        startState = .loading(previous: startState.value)
        do {
            let id = try await repository.startSession(from: workout, startedAt: now())
            startState = .loaded(id)
            return id
        } catch {
            startState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return nil
        }
    }
}

@MainActor
public final class WorkoutEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<WorkoutEditPayload> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    private let repository: any WorkoutsRepositoryProtocol
    public let workoutId: String?
    public private(set) var initialValues: WorkoutFormValues?

    public init(workoutId: String?, repository: any WorkoutsRepositoryProtocol) {
        self.workoutId = workoutId
        self.repository = repository
    }

    public var labels: [WorkoutLabel] { state.value?.labels ?? [] }
    public var workout: WorkoutDetailModel? { state.value?.workout }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            if let workoutId {
                let payload = try await repository.editWorkout(id: workoutId)
                initialValues = payload.workout.map(WorkoutFormModel.values(from:))
                state = .loaded(payload)
            } else {
                let labels = try await repository.labels()
                state = .loaded(WorkoutEditPayload(workout: nil, labels: labels))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func create(values: WorkoutFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createWorkout(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return nil
        }
    }

    public func save(values: WorkoutFormValues) async -> Bool {
        guard let workoutId, let initialValues else {
            saveState = .failed(message: "Workout not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.saveWorkout(id: workoutId, initialValues: initialValues, values: values)
            self.initialValues = values
            saveState = .loaded(workoutId)
            return true
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func delete() async -> Bool {
        guard let workoutId else { return false }
        deleteState = .loading(previous: deleteState.value)
        do {
            try await repository.deleteWorkout(id: workoutId)
            deleteState = .loaded(workoutId)
            return true
        } catch {
            deleteState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }
}
