import Foundation
import XCTest
@testable import NeoGymKit

final class DemoIntegrityTests: XCTestCase {
    func testLaunchArgumentsAreExplicitAndFailClosed() throws {
        let live = try DemoLaunchOptions(arguments: ["NeoGym"])
        XCTAssertFalse(live.enabled)
        let demo = try DemoLaunchOptions(arguments: ["NeoGym", "--demo", "--demo-reset", "--demo-screen", "train/session/current"])
        XCTAssertTrue(demo.enabled)
        XCTAssertTrue(demo.reset)
        XCTAssertEqual(demo.screen, .currentSession)
        for screen in DemoScreen.allCases {
            XCTAssertEqual(try DemoLaunchOptions(arguments: ["NeoGym", "--demo", "--demo-screen", screen.rawValue]).screen, screen)
        }
        for arguments in [["--demo-reset"], ["--demo-screen", "today"], ["--demo-scenario", "populated"],
                          ["--demo", "--demo-screen"], ["--demo", "--demo-screen", "typo"],
                          ["--demo", "--demo-scenario", "unknown"], ["--demo-typo"]] {
            XCTAssertThrowsError(try DemoLaunchOptions(arguments: ["NeoGym"] + arguments))
        }
        let session = try DemoIdentity.session()
        XCTAssertEqual(session.user?.id, DemoStore.userId)
        XCTAssertEqual(session.user?.email, "alex@example.invalid")
    }

    func testTodayHasACurrentSessionEvenImmediatelyAfterMidnightAcrossDSTDates() async throws {
        for (zone, days) in [
            ("Europe/Madrid", ["2026-03-08", "2026-03-29", "2026-10-25", "2026-11-01"]),
            ("America/New_York", ["2026-03-08", "2026-03-29", "2026-10-25", "2026-11-01"]),
            ("America/Santiago", ["2026-09-06", "2026-09-07", "2026-11-15"]),
            ("Atlantic/Azores", ["2026-03-29", "2026-03-30", "2026-04-20"])
        ] {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = try XCTUnwrap(TimeZone(identifier: zone))
            for day in days {
                let midnight = try XCTUnwrap(IntakeGrouping.localDateToDate(day, calendar: calendar))
                let now = midnight.addingTimeInterval(60)
                let store = try DemoStore(now: now, calendar: calendar)
                try await assertTodayIsSeeded(store: store, now: now, calendar: calendar)
                let energy = try await DemoEnergyRepository(store: store).listEntries()
                XCTAssertEqual(energy.count, 91, "\(zone) \(day)")
            }
        }
    }

    func testReopeningAfterSkippedMidnightSeedsTheNextLocalDay() async throws {
        for (zone, transitionDay) in [("America/Santiago", "2026-09-06"), ("Atlantic/Azores", "2026-03-29")] {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = try XCTUnwrap(TimeZone(identifier: zone))
            let firstStart = try XCTUnwrap(IntakeGrouping.localDateToDate(transitionDay, calendar: calendar))
            XCTAssertEqual(calendar.component(.hour, from: firstStart), 1, zone)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("demo.json")
            defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
            let store = try DemoStore(fileURL: url, now: firstStart.addingTimeInterval(60), calendar: calendar)
            await store.invalidate()

            let next = try XCTUnwrap(calendar.date(byAdding: .day, value: 1, to: firstStart))
            let now = calendar.startOfDay(for: next).addingTimeInterval(60)
            let reopened = try DemoStore(fileURL: url, now: now, calendar: calendar)
            try await assertTodayIsSeeded(store: reopened, now: now, calendar: calendar)
            await reopened.invalidate()
        }
    }

    private func assertTodayIsSeeded(store: DemoStore, now: Date, calendar: Calendar) async throws {
        let day = DateOnly.formatLocalISO(now, calendar: calendar)
        let context = "\(calendar.timeZone.identifier) \(day)"
        let repositories = AppRepositories.demo(store: store)
        let session = try await repositories.sessions.sessionDetail(id: "demo-session-\(day)")
        XCTAssertNotNil(session, context)
        var snapshot: TodayTrainingSnapshot?
        for try await value in repositories.sessions.todayTrainingUpdates(window: TodayTrainingWindow(now: now, calendar: calendar)) { snapshot = value }
        XCTAssertTrue(try XCTUnwrap(snapshot).todaySessions.contains { $0.id == "demo-session-\(day)" }, context)
        let intake = try await repositories.nutrition.openDailyIntake(date: day)
        XCTAssertEqual(intake.day?.logDate, day, context)
        XCTAssertEqual(intake.dailyEnergy?.energyOn, day, context)
        let body = try await repositories.body.measurement(id: "demo-body-\(day)")
        XCTAssertEqual(body?.measuredOn, day, context)
        let journal = try await repositories.journal.entry(id: "demo-journal-\(day)")
        XCTAssertEqual(journal?.entryDate, day, context)
    }

    func testStrengthReportsExcludeZeroRepSetsAndDoubleVolumeButNotOneRepMax() async throws {
        let now = Date(timeIntervalSince1970: 1_795_000_000)
        let today = DateOnly.todayLocalISO(now: now)
        let repository = DemoSessionsRepository(store: try DemoStore(now: now))
        let exercises = DemoExercisesRepository(store: repository.store)
        let id = try await exercises.startAdHocSession(exerciseId: "demo-exercise-row", startedAt: now)
        let loaded = try await repository.sessionDetail(id: id)
        let parent = try XCTUnwrap(loaded?.workoutSessionExercises.first).id
        _ = try await repository.addStrengthSet(workoutSessionExerciseId: parent, setNumber: 1, reps: 0, weight: 30)
        var rows: [StrengthProgressRow] = []
        for try await value in repository.strengthProgressUpdates(fromDay: today, throughDay: today, timeZone: Calendar.current.timeZone.identifier) { rows = value }
        XCTAssertFalse(rows.contains { $0.sessionId == id })
        _ = try await repository.addStrengthSet(workoutSessionExerciseId: parent, setNumber: 2, reps: 1, weight: 30)
        for try await value in repository.strengthProgressUpdates(fromDay: today, throughDay: today, timeZone: Calendar.current.timeZone.identifier) { rows = value }
        let point = try XCTUnwrap(rows.first { $0.sessionId == id })
        XCTAssertEqual(point.volume, 60)
        XCTAssertEqual(point.estimatedOneRepMax, 30)
    }

    func testPublicCatalogItemsCannotBeEditedOrDeleted() async throws {
        let repositories = AppRepositories.demo(store: try DemoStore())
        do {
            try await repositories.workouts.deleteWorkout(id: "demo-workout-public")
            XCTFail("Public template deleted")
        } catch DemoError.readOnly {}
        do {
            try await repositories.nutrition.deleteFood(id: "demo-food-yogurt")
            XCTFail("Public food deleted")
        } catch DemoError.readOnly {}
    }

    func testMealPlanCrudAndHistoricalProvenance() async throws {
        let repository = DemoNutritionRepository(store: try DemoStore())
        let mealValues = MealFormValues(name: "New meal", description: "Sample", ingredients: [
            MealIngredientFormValues(foodId: "demo-food-banana", grams: "100", position: 0)
        ])
        let mealId = try await repository.createMeal(mealValues)
        let values = NutritionPlanFormValues(name: "New plan", description: "Sample", slots: [
            NutritionPlanSlotFormValues(mealId: mealId, slotTime: "11:00", label: "Lunch", position: 0)
        ], foodSlots: [NutritionPlanFoodSlotFormValues(foodId: "demo-food-banana", grams: "80", slotTime: "16:00", label: "", position: 0)])
        let planId = try await repository.createPlan(values)
        let loadedPlan = try await repository.plan(id: planId)
        let plan = try XCTUnwrap(loadedPlan)
        let slot = try XCTUnwrap(plan.nutritionPlanFoods.first)
        let dayId = try await repository.createNutritionDay(date: "2030-01-01", nutritionPlanId: planId)
        let entryId = try await repository.logFood(LogFoodValues(
            dayId: dayId, foodId: slot.foodId, nutritionPlanFoodId: slot.id, grams: "80", slotTime: "16:00", position: 0
        ))
        try await repository.deletePlan(id: planId)
        let intake = try await repository.openDailyIntake(date: "2030-01-01")
        XCTAssertNil(intake.day?.nutritionPlanId)
        let entry = try XCTUnwrap(intake.day?.nutritionLogEntries.first { $0.id == entryId })
        XCTAssertNil(entry.nutritionPlanFoodId)
        XCTAssertGreaterThan(NutritionMath.normalizeNumeric(entry.snapshotKcalPer100g), 0)
        try await repository.deleteMeal(id: mealId)
        let removed = try await repository.meal(id: mealId)
        XCTAssertNil(removed)
    }

    func testBodyAndEnergyEnforceDateUniquenessAndChangesReachNutrition() async throws {
        let repositories = AppRepositories.demo(store: try DemoStore())
        let values = DailyEnergyFormValues(energyOn: "2030-02-01", activeKcal: "300", restingKcal: "1800", notes: "Manual")
        let id = try await repositories.energy.createEntry(values)
        do { _ = try await repositories.energy.createEntry(values); XCTFail("Duplicate date") } catch DemoError.duplicateDate {}
        let intake = try await repositories.nutrition.openDailyIntake(date: values.energyOn)
        XCTAssertEqual(intake.dailyEnergy?.restingKcal, 1800)
        try await repositories.energy.updateEntry(id: id, values: DailyEnergyFormValues(
            energyOn: values.energyOn, activeKcal: "400", restingKcal: "", notes: "Edited"
        ))
        let changed = try await repositories.nutrition.openDailyIntake(date: values.energyOn)
        XCTAssertEqual(changed.dailyEnergy?.activeKcal, 400)
        XCTAssertNil(changed.dailyEnergy?.restingKcal)
        let body = BodyMeasurementFormValues(measuredOn: "2030-02-01", weightKg: "80", bodyFatPct: "20", notes: "Manual")
        let bodyId = try await repositories.body.createMeasurement(body)
        do { _ = try await repositories.body.createMeasurement(body); XCTFail("Duplicate date") } catch DemoError.duplicateDate {}
        try await repositories.body.deleteMeasurement(id: bodyId)
        let deleted = try await repositories.body.measurement(id: bodyId)
        XCTAssertNil(deleted)
    }

    func testFailedPersistenceDoesNotPublishPartialMutation() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("demo.json")
        let store = try DemoStore(fileURL: url)
        let repository = DemoJournalRepository(store: store)
        let before = try await repository.listEntries(limit: 100, offset: 0, labelIds: [])
        try FileManager.default.removeItem(at: url)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false)
        do {
            _ = try await repository.createEntry(JournalEntryFormValues(entryDate: "2030-01-01", title: "No save", body: "Body", labels: []))
            XCTFail("Writing over a directory should fail")
        } catch {}
        let after = try await repository.listEntries(limit: 100, offset: 0, labelIds: [])
        XCTAssertEqual(before, after)
    }
}
