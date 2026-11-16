import Foundation

/// Feature dependencies shared by the live and offline demo shells.
/// Keep SDK clients, credentials and platform effects outside this container.
public struct AppRepositories: Sendable {
    public let workouts: any WorkoutsRepositoryProtocol
    public let sessions: any SessionsRepositoryProtocol & TodayTrainingProviding
    public let exercises: any ExercisesRepositoryProtocol
    public let nutrition: any NutritionFoodMealRepositoryProtocol
    public let body: any BodyMeasurementsRepositoryProtocol
    public let energy: any DailyEnergyRepositoryProtocol
    public let journal: any JournalRepositoryProtocol

    public static func live(graphQL: any GraphQLServicing) -> AppRepositories {
        AppRepositories(
            workouts: WorkoutsRepository(graphQL: graphQL), sessions: SessionsRepository(graphQL: graphQL),
            exercises: ExercisesRepository(graphQL: graphQL), nutrition: NutritionFoodMealRepository(graphQL: graphQL),
            body: BodyMeasurementsRepository(graphQL: graphQL), energy: DailyEnergyRepository(graphQL: graphQL),
            journal: JournalRepository(graphQL: graphQL)
        )
    }

    public static func demo(store: DemoStore) -> AppRepositories {
        AppRepositories(
            workouts: DemoWorkoutsRepository(store: store), sessions: DemoSessionsRepository(store: store),
            exercises: DemoExercisesRepository(store: store), nutrition: DemoNutritionRepository(store: store),
            body: DemoBodyRepository(store: store), energy: DemoEnergyRepository(store: store), journal: DemoJournalRepository(store: store)
        )
    }
}
