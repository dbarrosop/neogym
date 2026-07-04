import Foundation

enum WorkoutsRoute: Hashable {
    case sessionsList
    case workoutsList
    case exercisesList
    case sessionDetail(String)
    case workoutDetail(String)
    case workoutCreate
    case exerciseDetail(String)
}

enum NutritionRoute: Hashable {
    case day(String)
    case planDetail(String)
    case planCreate
    case foodDetail(String)
    case foodCreate
    case mealDetail(String)
    case mealCreate
}

enum MeRoute: Hashable {
    case bodyMeasurementDetail(String)
    case bodyMeasurementCreate
    case journalEntryDetail(String)
    case journalEntryCreate
}
