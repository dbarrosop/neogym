import Foundation
import XCTest
@testable import NeoGymKit

final class DemoDataTests: XCTestCase {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "Europe/Madrid") ?? .gmt
        return value
    }
    private var now: Date { Date(timeIntervalSince1970: 1_795_000_000) }
    private var today: String { DateOnly.formatLocalISO(now, calendar: calendar) }

    func testPopulatedDemoDecodesEveryDomainAndItsDetailScreens() async throws {
        let store = try DemoStore(now: now, calendar: calendar)
        let repositories = AppRepositories.demo(store: store)
        let workouts = try await repositories.workouts.listWorkouts()
        XCTAssertEqual(workouts.workouts.count, 3)
        for workout in workouts.workouts {
            let detail = try await repositories.workouts.workoutDetail(id: workout.id)
            XCTAssertFalse(try XCTUnwrap(detail).workoutExercises.isEmpty)
            let insights = try await repositories.workouts.workoutDetailInsights(
                workoutId: workout.id, exerciseIds: detail?.workoutExercises.map(\.exercise.id) ?? [], today: now
            )
            if workout.id == DemoSeed.workoutId { XCTAssertFalse(insights.volumeBars.isEmpty) }
        }
        let sessions = try await repositories.sessions.listSessions(limit: 100, offset: 0)
        XCTAssertGreaterThan(sessions.count, 20)
        for item in sessions { _ = try await repositories.sessions.sessionDetail(id: item.id) }
        let exercises = try await repositories.exercises.listExercises()
        for exercise in exercises {
            let detail = try await repositories.exercises.exerciseDetail(id: exercise.id)
            XCTAssertNotNil(detail)
        }
        let nutrition = repositories.nutrition
        let plans = try await nutrition.listPlans()
        XCTAssertEqual(plans.count, 1)
        XCTAssertEqual(plans[0].nutritionPlanFoods.count, 1)
        let meals = try await nutrition.listMeals()
        XCTAssertEqual(meals.count, 2)
        XCTAssertNotNil(meals[0].deleteBlockedReason)
        let overview = try await nutrition.nutritionOverview()
        XCTAssertEqual(overview.days.count, 91)
        XCTAssertGreaterThan(try XCTUnwrap(overview.daysByDate[today]).loggedTotals.kcal, 0)
        let intake = try await nutrition.openDailyIntake(date: today)
        XCTAssertNotNil(intake.day)
        XCTAssertNotNil(intake.dailyEnergy)
        let body = try await repositories.body.listMeasurements()
        let energy = try await repositories.energy.listEntries()
        let journal = try await repositories.journal.listEntries(limit: 100, offset: 0, labelIds: [])
        XCTAssertFalse(body.isEmpty)
        XCTAssertEqual(energy.count, 91)
        XCTAssertFalse(journal.entries.isEmpty)
    }

    func testTrainingMutationsUpdateTodayProgressAndHistoryAndDetachDeletedWorkout() async throws {
        let store = try DemoStore(now: now, calendar: calendar)
        let repositories = AppRepositories.demo(store: store)
        let loadedWorkout = try await repositories.workouts.workoutDetail(id: DemoSeed.workoutId)
        let workout = try XCTUnwrap(loadedWorkout)
        let id = try await repositories.workouts.startSession(from: workout, startedAt: now)
        let loadedDetail = try await repositories.sessions.sessionDetail(id: id)
        let detail = try XCTUnwrap(loadedDetail)
        let row = try XCTUnwrap(detail.workoutSessionExercises.first)
        let setId = try await repositories.sessions.addStrengthSet(workoutSessionExerciseId: row.id, setNumber: 1, reps: 1, weight: 100)
        let loadedChanged = try await repositories.sessions.sessionDetail(id: id)
        let changed = try XCTUnwrap(loadedChanged)
        XCTAssertEqual(changed.strengthTotals.volume, 100)
        var progress: [StrengthProgressRow] = []
        for try await rows in repositories.sessions.strengthProgressUpdates(fromDay: today, throughDay: today, timeZone: calendar.timeZone.identifier) {
            progress = rows
        }
        XCTAssertEqual(progress.first { $0.sessionId == id }?.estimatedOneRepMax, 100)
        var snapshot: TodayTrainingSnapshot?
        for try await value in repositories.sessions.todayTrainingUpdates(window: TodayTrainingWindow(now: now, calendar: calendar)) { snapshot = value }
        XCTAssertTrue(try XCTUnwrap(snapshot).todaySessions.contains { $0.id == id && $0.strengthTotals.volume == 100 })
        try await repositories.sessions.updateStrengthSet(id: setId, reps: 5, weight: 80)
        let updated = try await repositories.sessions.sessionDetail(id: id)
        XCTAssertEqual(updated?.strengthTotals.volume, 400)
        let prior = try await repositories.sessions.priorSessionsPerExercise(
            exerciseIds: [row.exercise.id], before: now.addingTimeInterval(1), workoutId: workout.id, excludeSessionId: "not-current"
        )
        XCTAssertEqual(prior.exercises.first?.sameWorkoutSessions.first?.workoutSession.id, id)
        try await repositories.workouts.deleteWorkout(id: workout.id)
        let detached = try await repositories.sessions.sessionDetail(id: id)
        XCTAssertNil(detached?.workout)
        XCTAssertEqual(detached?.strengthTotals.volume, 400)
        try await repositories.sessions.deleteSession(id: id)
        let deleted = try await repositories.sessions.sessionDetail(id: id)
        XCTAssertNil(deleted)
    }

    func testKindAndCardioSchemaValidationAreNotNoOps() async throws {
        let store = try DemoStore(now: now, calendar: calendar)
        let exercises = DemoExercisesRepository(store: store)
        let sessions = DemoSessionsRepository(store: store)
        let id = try await exercises.startAdHocSession(exerciseId: "demo-exercise-run", startedAt: now)
        let loadedDetail = try await sessions.sessionDetail(id: id)
        let detail = try XCTUnwrap(loadedDetail)
        let parent = try XCTUnwrap(detail.workoutSessionExercises.first).id
        do {
            _ = try await sessions.addStrengthSet(workoutSessionExerciseId: parent, setNumber: 1, reps: 5, weight: 10)
            XCTFail("A strength set must not attach to cardio")
        } catch DemoError.invalidEntry {}
        do {
            _ = try await sessions.addCardioEntry(workoutSessionExerciseId: parent, entryNumber: 1, metrics: ["distance_km": 2])
            XCTFail("Required duration must be checked")
        } catch DemoError.invalidEntry {}
        _ = try await sessions.addCardioEntry(workoutSessionExerciseId: parent, entryNumber: 1, metrics: ["duration_s": 1200, "distance_km": 3])
        let changed = try await sessions.sessionDetail(id: id)
        XCTAssertEqual(changed?.workoutSessionExercises.first?.workoutSessionCardioEntries.count, 1)
    }

    func testFoodSnapshotsSurviveSourceEditsAndDeletionAndMealLogsCascade() async throws {
        let store = try DemoStore(now: now, calendar: calendar)
        let nutrition = DemoNutritionRepository(store: store)
        let intake = try await nutrition.openDailyIntake(date: today)
        let dayId = try XCTUnwrap(intake.day).id
        let foodId = try await nutrition.createFood(foodValues(kcal: "100"))
        let logId = try await nutrition.logFood(LogFoodValues(dayId: dayId, foodId: foodId, grams: "200", slotTime: "10:00", position: 0))
        try await nutrition.updateFood(id: foodId, values: foodValues(kcal: "900"))
        try await nutrition.deleteFood(id: foodId)
        let loaded = try await nutrition.openDailyIntake(date: today)
        let entry = try XCTUnwrap(loaded.day?.nutritionLogEntries.first { $0.id == logId })
        XCTAssertNil(entry.foodId)
        XCTAssertEqual(entry.source, .food)
        XCTAssertEqual(NutritionMath.normalizeNumeric(entry.snapshotKcalPer100g), 100)
        let loadedMeals = try await nutrition.listMeals()
        let meal = try XCTUnwrap(loadedMeals.first)
        let group = try await nutrition.logMeal(LogMealValues(dayId: dayId, meal: meal, name: meal.name, slotTime: "12:00", position: 0))
        let withMeal = try await nutrition.openDailyIntake(date: today)
        XCTAssertEqual(withMeal.day?.nutritionLogMeals.first { $0.id == group }?.nutritionLogEntries.count, meal.mealIngredients.count)
        try await nutrition.deleteLogMeal(id: group)
        let after = try await nutrition.openDailyIntake(date: today)
        XCTAssertFalse(after.day?.nutritionLogMeals.contains { $0.id == group } ?? true)
        do {
            try await nutrition.deleteMeal(id: meal.id)
            XCTFail("Plan references restrict deletion")
        } catch DemoError.referencedTemplate {}
    }

    func testMultiRowPlanLoggingRollsBackOnWrongDayChild() async throws {
        let store = try DemoStore(now: now, calendar: calendar)
        let nutrition = DemoNutritionRepository(store: store)
        let before = try await nutrition.openDailyIntake(date: today)
        let dayId = try XCTUnwrap(before.day).id
        let invalid = PlanLogMaterialization(mealObjects: [PlanLogMealInsertValues(
            dayId: dayId, mealId: "demo-meal-breakfast", nutritionPlanMealId: "demo-plan-meal-07:30:00",
            name: "Breakfast", slotTime: "07:30", position: 1,
            entries: [PlanLogEntryInsertValues(dayId: "wrong-day", foodId: "demo-food-yogurt", grams: .number(100), position: 0, slotTime: "07:30")]
        )], entryObjects: [])
        do { _ = try await nutrition.logSelectedPlan(invalid); XCTFail("Wrong-day child accepted") } catch DemoError.invalidEntry {}
        let after = try await nutrition.openDailyIntake(date: today)
        XCTAssertEqual(before.day, after.day)
    }

    func testPersistenceResetNewDayAndInvalidatedStore() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("demo.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let first = try DemoStore(fileURL: url, now: now, calendar: calendar)
        let repository = DemoNutritionRepository(store: first)
        let id = try await repository.createFood(foodValues(kcal: "100"))
        await first.invalidate()
        do { _ = try await repository.listFoods(); XCTFail("Retired runtime remained usable") } catch is CancellationError {}
        let reopened = try DemoStore(fileURL: url, now: now, calendar: calendar)
        let saved = try await DemoNutritionRepository(store: reopened).food(id: id)
        XCTAssertNotNil(saved)
        await reopened.invalidate()
        let tomorrow = try XCTUnwrap(calendar.date(byAdding: .day, value: 1, to: now))
        let next = try DemoStore(fileURL: url, now: tomorrow, calendar: calendar)
        let nextRepository = DemoNutritionRepository(store: next)
        let retained = try await nextRepository.food(id: id)
        let nextDay = try await nextRepository.openDailyIntake(date: DateOnly.formatLocalISO(tomorrow, calendar: calendar))
        XCTAssertNotNil(retained)
        XCTAssertNotNil(nextDay.day)
        await next.invalidate()
        let reset = try DemoStore(fileURL: url, reset: true, now: now, calendar: calendar)
        let removed = try await DemoNutritionRepository(store: reset).food(id: id)
        XCTAssertNil(removed)
    }

    private func foodValues(kcal: String) -> FoodFormValues {
        FoodFormValues(name: "Custom sample", kcalPer100g: kcal, fatPer100g: "0", carbsPer100g: "0", proteinPer100g: "0", fiberPer100g: "0", sugarPer100g: "0")
    }
}
