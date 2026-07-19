import Combine
import Foundation

public struct ExerciseFilterOption: Identifiable, Sendable, Equatable {
    public let value: String
    public let count: Int

    public var id: String { value }

    public init(value: String, count: Int) {
        self.value = value
        self.count = count
    }
}

public struct ExerciseMuscleGroup: Identifiable, Sendable, Equatable {
    public let muscle: String
    public let exercises: [ExerciseListItem]

    public var id: String { muscle }

    public init(muscle: String, exercises: [ExerciseListItem]) {
        self.muscle = muscle
        self.exercises = exercises
    }
}

@MainActor
public final class ExercisesListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[ExerciseListItem]> = .idle
    @Published public var searchText = ""
    @Published public var filters: ExerciseFilters = [:]
    @Published public var visibility: ExerciseVisibilityFilter?

    private let repository: any ExercisesRepositoryProtocol

    public init(repository: any ExercisesRepositoryProtocol) {
        self.repository = repository
    }

    public var exercises: [ExerciseListItem] {
        state.value ?? []
    }

    public var isFiltered: Bool {
        !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || visibility != nil
            || !filters.isEmpty
    }

    public var filteredExercises: [ExerciseListItem] {
        Self.filteredExercises(
            exercises: exercises,
            searchText: searchText,
            filters: filters,
            visibility: visibility
        )
    }

    public var groupedExercises: [ExerciseMuscleGroup] {
        let grouped = Dictionary(grouping: filteredExercises, by: \ExerciseListItem.primaryMuscleGroup)
        return grouped.keys.sorted().map { muscle in
            ExerciseMuscleGroup(muscle: muscle, exercises: grouped[muscle] ?? [])
        }
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            for try await exercises in repository.exerciseListUpdates() {
                state = .loaded(exercises)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(
                message: GraphQLDomainError.map(error).localizedDescription,
                previous: state.value
            )
        }
    }

    public func setFilter(_ key: ExerciseFilterKey, value: String?) {
        if let value {
            filters[key] = value
        } else {
            filters.removeValue(forKey: key)
        }
    }

    public func clearAll() {
        searchText = ""
        filters = [:]
        visibility = nil
    }

    public func options(for column: ExerciseFilterKey) -> [ExerciseFilterOption] {
        Self.options(
            exercises: exercises,
            filters: filters,
            visibility: visibility,
            searchText: searchText,
            column: column
        )
    }

    public static func filteredExercises(
        exercises: [ExerciseListItem],
        searchText: String,
        filters: ExerciseFilters,
        visibility: ExerciseVisibilityFilter?
    ) -> [ExerciseListItem] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let scored = trimmed.isEmpty ? nil : searchScores(exercises: exercises, query: trimmed)
        let filtered = exercises.filter { exercise in
            Self.matches(
                exercise: exercise,
                filters: filters,
                visibility: visibility,
                searchMatchIds: scored.map { Set($0.keys) }
            )
        }
        guard let scored else { return filtered }
        return filtered.sorted { left, right in
            let leftScore = scored[left.id] ?? Int.max
            let rightScore = scored[right.id] ?? Int.max
            if leftScore != rightScore { return leftScore < rightScore }
            return left.name.localizedCaseInsensitiveCompare(right.name) == .orderedAscending
        }
    }

    public static func options(
        exercises: [ExerciseListItem],
        filters: ExerciseFilters,
        visibility: ExerciseVisibilityFilter?,
        searchText: String,
        column: ExerciseFilterKey
    ) -> [ExerciseFilterOption] {
        var otherFilters = filters
        otherFilters.removeValue(forKey: column)
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let searchMatchIds = trimmed.isEmpty
            ? nil
            : Set(searchScores(exercises: exercises, query: trimmed).keys)
        var counts: [String: Int] = [:]
        for exercise in exercises where matches(
            exercise: exercise,
            filters: otherFilters,
            visibility: visibility,
            searchMatchIds: searchMatchIds
        ) {
            for value in Set(values(for: exercise, key: column)) {
                counts[value, default: 0] += 1
            }
        }
        return counts.map(ExerciseFilterOption.init(value: count:)).sorted { $0.value < $1.value }
    }

    private static func matches(
        exercise: ExerciseListItem,
        filters: ExerciseFilters,
        visibility: ExerciseVisibilityFilter?,
        searchMatchIds: Set<String>?
    ) -> Bool {
        if let muscle = filters[.muscle] {
            let involves = exercise.primaryMuscleGroup == muscle
                || exercise.secondaryMuscleGroups.contains { $0.muscleGroup == muscle }
            if !involves { return false }
        }
        if let category = filters[.category], exercise.category != category { return false }
        if let equipment = filters[.equipment], exercise.equipment != equipment { return false }
        if let level = filters[.level], exercise.level != level { return false }
        if visibility == .mine, exercise.isPublic { return false }
        if visibility == .public, !exercise.isPublic { return false }
        if let searchMatchIds, !searchMatchIds.contains(exercise.id) { return false }
        return true
    }

    private static func values(for exercise: ExerciseListItem, key: ExerciseFilterKey) -> [String] {
        switch key {
        case .muscle:
            [exercise.primaryMuscleGroup] + exercise.secondaryMuscleGroups.map(\.muscleGroup)
        case .category:
            exercise.category.map { [$0] } ?? []
        case .equipment:
            exercise.equipment.map { [$0] } ?? []
        case .level:
            exercise.level.map { [$0] } ?? []
        }
    }

    private static func searchScores(exercises: [ExerciseListItem], query: String) -> [String: Int] {
        let needle = query.lowercased()
        return Dictionary(uniqueKeysWithValues: exercises.compactMap { exercise in
            let name = exercise.name.lowercased()
            if let range = name.range(of: needle) {
                return (exercise.id, name.distance(from: name.startIndex, to: range.lowerBound))
            }
            if fuzzyContains(needle: needle, haystack: name) {
                return (exercise.id, name.count + abs(name.count - needle.count))
            }
            return nil
        })
    }

    private static func fuzzyContains(needle: String, haystack: String) -> Bool {
        var searchIndex = needle.startIndex
        for char in haystack where searchIndex < needle.endIndex && char == needle[searchIndex] {
            searchIndex = needle.index(after: searchIndex)
        }
        return searchIndex == needle.endIndex
    }
}

@MainActor
public final class ExerciseDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<ExerciseDetailModel> = .idle
    @Published public private(set) var startState: Loadable<String> = .idle

    public let exerciseId: String
    private let repository: any ExercisesRepositoryProtocol
    private let now: @Sendable () -> Date

    public init(
        exerciseId: String,
        repository: any ExercisesRepositoryProtocol,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.exerciseId = exerciseId
        self.repository = repository
        self.now = now
    }

    public var exercise: ExerciseDetailModel? { state.value }

    public var history: [ExerciseHistoryEntry] {
        ExerciseProgressBuilder.sortedHistory(exercise?.workoutSessionExercises ?? [])
    }

    public var strengthProgressPoints: [StrengthProgressPoint] {
        ExerciseProgressBuilder.strengthPoints(
            entries: history,
            doubleWeight: exercise?.strength?.doubleWeight ?? false
        )
    }

    public var cardioMetricsSchema: CardioMetricsSchema? {
        exercise?.cardioSchema
    }

    public var primaryCardioMetric: CardioMetricSpec? {
        cardioMetricsSchema.flatMap { CardioMetricsSchemaHelpers.iterateMetrics($0).first }
    }

    public var cardioProgressPoints: [CardioProgressPoint] {
        guard let primaryCardioMetric else { return [] }
        return ExerciseProgressBuilder.cardioPoints(entries: history, primary: primaryCardioMetric)
    }

    public var isCardioSchemaMissing: Bool {
        exercise?.isCardio == true && cardioMetricsSchema == nil
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            var receivedValue = false
            var latestExercise: ExerciseDetailModel?
            for try await exercise in repository.exerciseDetailUpdates(id: exerciseId) {
                receivedValue = true
                latestExercise = exercise
                if let exercise { state = .loaded(exercise) }
            }
            if receivedValue, latestExercise == nil {
                state = .failed(message: "Exercise not found.", previous: nil)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(
                message: GraphQLDomainError.map(error).localizedDescription,
                previous: state.value
            )
        }
    }

    public func startAdHocSession() async -> String? {
        startState = .loading(previous: startState.value)
        do {
            let sessionId = try await repository.startAdHocSession(
                exerciseId: exerciseId,
                startedAt: now()
            )
            startState = .loaded(sessionId)
            await load()
            return sessionId
        } catch {
            startState = .failed(
                message: GraphQLDomainError.map(error).localizedDescription,
                previous: startState.value
            )
            return nil
        }
    }
}
