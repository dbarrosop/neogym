import Foundation

/// Muscle-area chips on the Add exercises sheet. The catalog stores granular
/// primary muscles, so each chip groups several; Cardio follows the category.
public enum ExercisePickerFilter: String, CaseIterable, Identifiable, Sendable {
    case all
    case chest
    case back
    case legs
    case shoulders
    case arms
    case core
    case cardio

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .all: "All"
        case .chest: "Chest"
        case .back: "Back"
        case .legs: "Legs"
        case .shoulders: "Shoulders"
        case .arms: "Arms"
        case .core: "Core"
        case .cardio: "Cardio"
        }
    }

    private var muscles: Set<String> {
        switch self {
        case .all, .cardio: []
        case .chest: ["chest"]
        case .back: ["lats", "middle_back", "lower_back", "traps"]
        case .legs: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"]
        case .shoulders: ["shoulders", "front_delts", "side_delts", "rear_delts"]
        case .arms: ["biceps", "triceps", "forearms"]
        case .core: ["abdominals"]
        }
    }

    public func matches(_ exercise: ExerciseListItem) -> Bool {
        switch self {
        case .all: true
        case .cardio: exercise.isCardioCategory
        default: muscles.contains(exercise.primaryMuscleGroup)
        }
    }
}

public extension ExerciseListItem {
    /// Cardio exercises (`exercises.kind` is generated from this category).
    var isCardioCategory: Bool { category == "cardio" }
}

/// The Add exercises sheet's two lists: recently logged exercises first, then
/// everything else matching the search and chip, excluding what the session
/// or workout already has.
public struct ExercisePickerSections: Equatable, Sendable {
    public let recent: [ExerciseListItem]
    public let all: [ExerciseListItem]

    public init(
        exercises: [ExerciseListItem],
        excluding alreadySelected: Set<String>,
        recentIds: [String],
        filter: ExercisePickerFilter,
        query: String,
        recentLimit: Int = 5
    ) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let visible = exercises.filter { exercise in
            !alreadySelected.contains(exercise.id)
                && filter.matches(exercise)
                && (trimmed.isEmpty || exercise.name.localizedCaseInsensitiveContains(trimmed))
        }
        let byId = Dictionary(visible.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var seen = Set<String>()
        var recent: [ExerciseListItem] = []
        for id in recentIds where seen.insert(id).inserted {
            guard recent.count < recentLimit else { break }
            if let exercise = byId[id] { recent.append(exercise) }
        }
        let recentSet = Set(recent.map(\.id))
        self.recent = recent
        all = visible.filter { !recentSet.contains($0.id) }
    }

    public var isEmpty: Bool { recent.isEmpty && all.isEmpty }
}
