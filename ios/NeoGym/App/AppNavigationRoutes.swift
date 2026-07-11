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
    case bodyList
    case energyList
    case day(String)
    case planDetail(String)
    case planCreate
    case foodDetail(String)
    case foodCreate
    case mealDetail(String)
    case mealCreate
    case bodyMeasurementDetail(String)
    case bodyMeasurementCreate
    case energyDetail(String)
    case energyCreate
}

enum MeRoute: Hashable {
    case profile
    case journalList
    case journalEntryDetail(String)
    case journalEntryCreate
}
