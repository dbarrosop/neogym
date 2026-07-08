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
    case overview
    case daysList
    case plansList
    case foodsList
    case mealsList
    case day(String)
    case planDetail(String)
    case planCreate
    case foodDetail(String)
    case foodCreate
    case mealDetail(String)
    case mealCreate
}

enum MeRoute: Hashable {
    case profile
    case bodyList
    case energyList
    case journalList
    case bodyMeasurementDetail(String)
    case bodyMeasurementCreate
    case journalEntryDetail(String)
    case journalEntryCreate
}
