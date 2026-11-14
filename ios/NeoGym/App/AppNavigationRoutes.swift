import Foundation

/// The five top-level areas, one tab each, in design order.
enum AppTab: String, CaseIterable, Identifiable, Hashable {
    case today
    case train
    case nutrition
    case progress
    case me

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "Today"
        case .train: "Train"
        case .nutrition: "Nutrition"
        case .progress: "Progress"
        case .me: "Me"
        }
    }

    var systemImage: String {
        switch self {
        case .today: "sun.max"
        case .train: "dumbbell"
        case .nutrition: "fork.knife"
        case .progress: "chart.line.uptrend.xyaxis"
        case .me: "person.crop.circle"
        }
    }
}

/// Sections shown in an area root's segmented picker.
protocol AreaSection: CaseIterable, Hashable, Identifiable where AllCases: RandomAccessCollection {
    var title: String { get }
}

extension AreaSection where Self: RawRepresentable, RawValue == String {
    var id: String { rawValue }
}

enum TrainSection: String, AreaSection {
    case sessions
    case workouts
    case exercises

    var title: String {
        switch self {
        case .sessions: "Sessions"
        case .workouts: "Workouts"
        case .exercises: "Exercises"
        }
    }
}

enum NutritionSection: String, AreaSection {
    case log
    case plans
    case foods
    case meals

    var title: String {
        switch self {
        case .log: "Log"
        case .plans: "Plans"
        case .foods: "Foods"
        case .meals: "Meals"
        }
    }
}

enum ProgressSection: String, AreaSection {
    case overview
    case muscles
    case strength
    case body
    case energy

    var title: String {
        switch self {
        case .overview: "Overview"
        case .muscles: "Muscles"
        case .strength: "Strength"
        case .body: "Body"
        case .energy: "Energy"
        }
    }
}

enum MeSection: String, AreaSection {
    case journal
    case account

    var title: String {
        switch self {
        case .journal: "Journal"
        case .account: "Account"
        }
    }
}

enum TrainRoute: Hashable {
    case sessionDetail(String)
    case workoutDetail(String)
    case workoutCreate
    case exerciseDetail(String)

    var sessionId: String? {
        if case let .sessionDetail(id) = self { return id }
        return nil
    }
}

enum NutritionRoute: Hashable {
    case planDetail(String)
    case planCreate
    case foodDetail(String)
    case foodCreate
    case mealDetail(String)
    case mealCreate
}

enum ProgressRoute: Hashable {
    case exerciseDetail(String)
    case bodyMeasurementDetail(String)
    case bodyMeasurementCreate
    case energyDetail(String)
    case energyCreate
}

enum MeRoute: Hashable {
    case journalEntryDetail(String)
    case journalEntryCreate
}
