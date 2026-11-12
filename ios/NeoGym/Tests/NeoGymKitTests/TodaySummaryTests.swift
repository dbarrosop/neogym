import Foundation
import XCTest
@testable import NeoGymKit

final class TodaySummaryTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Stockholm")!
        return calendar
    }

    private func date(_ value: String) -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)!
    }

    // MARK: - Training

    func testTodayTrainingRepositoryUsesLocalDayWindowAndSessionsCache() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "todaySessions": .array([.object([
                "id": .string("s1"),
                "startedAt": .string("2026-11-12T05:03:00+00:00"),
                "workout": .object(["id": .string("w1"), "name": .string("Lower A")]),
                "workoutSessionExercises": .array([
                    .object([
                        "id": .string("we1"), "position": .number(1),
                        "exercise": .object([
                            "id": .string("e1"), "name": .string("Romanian Deadlift"), "kind": .string("strength"),
                            "primaryMuscleGroup": .string("hamstrings"),
                            "strength": .object(["doubleWeight": .bool(false)])
                        ]),
                        "workoutSessionStrengthSets": .array([
                            .object(["id": .string("a"), "setNumber": .number(1), "reps": .number(6), "weight": .string("140")]),
                            .object(["id": .string("b"), "setNumber": .number(2), "reps": .number(7), "weight": .number(140)])
                        ]),
                        "workoutSessionCardioEntries": .array([])
                    ]),
                    .object([
                        "id": .string("we2"), "position": .number(2),
                        "exercise": .object([
                            "id": .string("e2"), "name": .string("Rowing"), "kind": .string("cardio"),
                            "primaryMuscleGroup": .string("middle_back")
                        ]),
                        "workoutSessionStrengthSets": .array([]),
                        "workoutSessionCardioEntries": .array([
                            .object(["id": .string("c1"), "entryNumber": .number(1), "metrics": .object([:])])
                        ])
                    ])
                ])
            ])]),
            "latestSession": .array([.object([
                "id": .string("s1"), "startedAt": .string("2026-11-12T05:03:00+00:00"),
                "workout": .object(["id": .string("w1"), "name": .string("Lower A")]),
                "workoutSessionExercises_aggregate": .object(["aggregate": .object(["count": .number(2)])]),
                "workoutSessionExercises": .array([])
            ])]),
            "recentSessions": .object(["aggregate": .object(["count": .number(4)])])
        ]))])
        let repository = SessionsRepository(graphQL: fake)
        let now = date("2026-11-12T10:00:00Z")
        let model = await TodayTrainingViewModel(repository: repository, calendar: calendar, now: { now })
        await model.load()

        let loaded = await model.summary
        let summary = try XCTUnwrap(loaded)
        XCTAssertEqual(summary.recentCount, 4)
        XCTAssertEqual(summary.latest?.name, "Lower A")
        let session = try XCTUnwrap(summary.sessions.first)
        XCTAssertEqual(session.name, "Lower A")
        XCTAssertEqual(session.exerciseCount, 2)
        XCTAssertEqual(session.totals.sets, 2)
        XCTAssertEqual(session.totals.reps, 13)
        XCTAssertEqual(session.totals.volume, 1_820)
        XCTAssertEqual(session.lines.map(\.summary), ["140 kg × 6 · 7", "1 entry"])

        let requests = await fake.cachedRequestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.request.operationName, "TodayTraining")
        XCTAssertEqual(request.namespace, "sessions")
        XCTAssertEqual(request.tags, ["sessions"])
        // Stockholm is UTC+1 in November: local midnight is 23:00Z the day before.
        XCTAssertEqual(request.request.variables?["dayStart"], .string("2026-11-11T23:00:00.000Z"))
        XCTAssertEqual(request.request.variables?["dayEnd"], .string("2026-11-12T23:00:00.000Z"))
        XCTAssertEqual(request.request.variables?["weekStart"], .string("2026-11-05T23:00:00.000Z"))
    }

    func testCompactSessionSummaryCollapsesSharedWeight() {
        let same = [
            SessionStrengthSet(id: "1", setNumber: 1, reps: 6, weight: 80),
            SessionStrengthSet(id: "2", setNumber: 2, reps: 6, weight: 80),
            SessionStrengthSet(id: "3", setNumber: 3, reps: 5, weight: 80)
        ]
        XCTAssertEqual(StrengthSetFormatting.compactSessionSummary(same), "80 kg × 6 · 6 · 5")

        let mixed = [
            SessionStrengthSet(id: "1", setNumber: 1, reps: 6, weight: 80),
            SessionStrengthSet(id: "2", setNumber: 2, reps: 5, weight: 82.5)
        ]
        XCTAssertEqual(StrengthSetFormatting.compactSessionSummary(mixed), "80 kg × 6 · 82.5 kg × 5")

        let bodyweight = [SessionStrengthSet(id: "1", setNumber: 1, reps: 20, weight: 0)]
        XCTAssertEqual(StrengthSetFormatting.compactSessionSummary(bodyweight), "BW × 20")
        XCTAssertEqual(StrengthSetFormatting.lastTimeCell(bodyweight[0]), "BW × 20")
        XCTAssertEqual(StrengthSetFormatting.lastTimeCell(mixed[1]), "82.5 × 5")
        XCTAssertEqual(StrengthSetFormatting.lastTimeCell(nil), "—")
    }

    // MARK: - Nutrition

    private func food(_ id: String, kcal: Double, protein: Double = 10) -> Food {
        Food(
            id: id, name: id, isPublic: false,
            kcalPer100g: .number(kcal), fatPer100g: .number(5), carbsPer100g: .number(20),
            proteinPer100g: .number(protein), fiberPer100g: .number(0), sugarPer100g: .number(0)
        )
    }

    private func entry(_ id: String, time: String, grams: Double, kcal: Double) -> NutritionLogEntry {
        NutritionLogEntry(
            id: id, grams: .number(grams), position: 0, slotTime: time, snapshotFoodName: id,
            snapshotKcalPer100g: .number(kcal), snapshotFatPer100g: .number(0),
            snapshotCarbsPer100g: .number(0), snapshotProteinPer100g: .number(10),
            snapshotFiberPer100g: .number(0), snapshotSugarPer100g: .number(0)
        )
    }

    private func plan() -> NutritionPlan {
        NutritionPlan(
            id: "p1", name: "Cut",
            nutritionPlanFoods: [
                NutritionPlanFoodSlot(id: "f1", foodId: "oats", grams: .number(100), slotTime: "07:00:00", position: 0,
                                      food: food("oats", kcal: 380)),
                NutritionPlanFoodSlot(id: "f2", foodId: "rice", grams: .number(200), slotTime: "13:00:00", position: 1,
                                      food: food("rice", kcal: 130)),
                NutritionPlanFoodSlot(id: "f3", foodId: "chicken", grams: .number(150), slotTime: "17:30:00", position: 2,
                                      food: food("chicken", kcal: 110, protein: 23)),
                NutritionPlanFoodSlot(id: "f4", foodId: "skyr", grams: .number(170), slotTime: "21:00:00", position: 3,
                                      food: food("skyr", kcal: 60))
            ]
        )
    }

    func testNextPlannedSlotSkipsPastAndLoggedSlots() {
        let day = NutritionDay(
            id: "d1", logDate: "2026-11-12", nutritionPlanId: "p1", nutritionPlan: plan(),
            nutritionLogEntries: [
                entry("breakfast", time: "07:00:00", grams: 100, kcal: 380),
                // Logged at the planned dinner time, ahead of the clock.
                entry("dinner", time: "17:30:00", grams: 150, kcal: 110)
            ]
        )
        let summary = TodayNutritionSummary(
            day: day, now: date("2026-11-12T11:00:00Z"), calendar: calendar, locale: Locale(identifier: "en_GB")
        )
        XCTAssertEqual(summary.planName, "Cut")
        XCTAssertEqual(summary.eaten.kcal, 380 + 165, accuracy: 0.001)
        XCTAssertEqual(summary.planned?.kcal ?? 0, 380 + 260 + 165 + 102, accuracy: 0.001)
        // 12:00 local: 13:00 is next; 17:30 is logged already.
        XCTAssertEqual(summary.nextSlot?.key, "13:00")
        XCTAssertEqual(summary.nextSlot?.countLabel, "1 food")
        XCTAssertEqual(summary.nextSlot?.kcal ?? 0, 260, accuracy: 0.001)

        let evening = TodayNutritionSummary(
            day: day, now: date("2026-11-12T17:00:00Z"), calendar: calendar, locale: Locale(identifier: "en_GB")
        )
        XCTAssertEqual(evening.nextSlot?.key, "21:00")
    }

    func testNutritionSummaryWithoutPlanHasNoTargetOrNextSlot() {
        let summary = TodayNutritionSummary(day: nil, now: date("2026-11-12T11:00:00Z"), calendar: calendar)
        XCTAssertFalse(summary.hasDay)
        XCTAssertNil(summary.planned)
        XCTAssertNil(summary.nextSlot)
        XCTAssertEqual(summary.eaten, .empty)
    }

    // MARK: - Balance

    func testBalanceUsesYesterdayAndSplitsEnergy() {
        let yesterday = NutritionDay(
            id: "d0", logDate: "2026-11-11",
            nutritionLogEntries: [entry("lunch", time: "12:00", grams: 1_000, kcal: 214)]
        )
        let payload = NutritionOverviewPayload(
            days: [yesterday],
            dailyEnergyEntries: [DailyEnergy(id: "e0", energyOn: "2026-11-11", activeKcal: 728, restingKcal: 1_842)]
        )
        let balance = TodayBalanceSummary(payload: payload, today: "2026-11-12", calendar: calendar)
        XCTAssertEqual(balance.yesterday, "2026-11-11")
        XCTAssertEqual(balance.caloriesIn, 2_140, accuracy: 0.001)
        XCTAssertEqual(balance.caloriesOut ?? 0, 2_570, accuracy: 0.001)
        XCTAssertEqual(balance.net ?? 0, -430, accuracy: 0.001)
        XCTAssertEqual(balance.activeKcal, 728)
        XCTAssertEqual(balance.restingKcal, 1_842)
        XCTAssertNil(balance.projection)
    }

    func testBalanceWithoutYesterdayEnergyHasNoNet() {
        let balance = TodayBalanceSummary(payload: NutritionOverviewPayload(days: []), today: "2026-11-12")
        XCTAssertNil(balance.caloriesOut)
        XCTAssertNil(balance.net)
    }

    // MARK: - Body

    func testBodyTrendComparesWeekAveragesAndKeepsLatestFat() {
        let points = [
            ("2026-10-31", 72.0, 13.0), ("2026-11-02", 71.6, nil), ("2026-11-04", 71.4, nil),
            ("2026-11-07", 71.0, 12.8), ("2026-11-10", 70.8, nil), ("2026-11-12", 70.6, nil)
        ].map { day, weight, fat in
            BodyMeasurementChartPoint(
                id: day, measuredOn: day,
                date: IntakeGrouping.localDateToDate(day, calendar: calendar)!,
                weightKg: weight, bodyFatPct: fat
            )
        }
        let body = TodayBodySummary(points: points, today: "2026-11-12", calendar: calendar)
        XCTAssertEqual(body.latestWeightKg, 70.6)
        XCTAssertEqual(body.latestWeightOn, "2026-11-12")
        XCTAssertEqual(body.latestBodyFatPct, 12.8)
        // This week: 6–12 Nov. Prior week: 30 Oct–5 Nov.
        XCTAssertEqual(body.weekAverageKg ?? 0, (71.0 + 70.8 + 70.6) / 3, accuracy: 0.0001)
        XCTAssertEqual(body.priorWeekAverageKg ?? 0, (72.0 + 71.6 + 71.4) / 3, accuracy: 0.0001)
        XCTAssertEqual(body.weekChangeKg ?? 0, -0.8667, accuracy: 0.001)
        XCTAssertEqual(body.rollingWeights.count, 6)
        XCTAssertEqual(body.rollingWeights.first, 72.0)
    }

    func testBodyTrendWithoutWeightsIsEmpty() {
        let body = TodayBodySummary(points: [], today: "2026-11-12")
        XCTAssertNil(body.latestWeightKg)
        XCTAssertNil(body.weekChangeKg)
        XCTAssertTrue(body.rollingWeights.isEmpty)
    }
}
