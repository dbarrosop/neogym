import Foundation
import XCTest
@testable import NeoGymKit

/// The one formatter behind the iPhone widgets, the watch app and its complication.
final class EnergyBalanceDisplayTests: XCTestCase {
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/London")!
        return calendar
    }()

    private static let locale = Locale(identifier: "en_GB")

    private static func date(_ day: String, _ hour: Int, _ minute: Int) -> Date {
        let start = DateOnly.parse(day, calendar: calendar)!
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: start)!
    }

    private static func input(
        burned: Double? = 1_210, active: Double? = 531, resting: Double? = 679, plan: Double? = 2_243,
        estimatedNet: Double? = -851, estimatedBurned: Double? = 2_312, average: Double? = -371
    ) -> EnergyBalanceDisplayInput {
        EnergyBalanceDisplayInput(
            localDate: "2026-11-15", updatedAt: date("2026-11-15", 13, 40), consumedKcal: 1_461,
            burnedKcal: burned, activeKcal: active, restingKcal: resting, sevenDayAverageNet: average,
            planKcal: plan, estimatedBurnedKcal: estimatedBurned, estimatedNetKcal: estimatedNet
        )
    }

    private static func display(_ input: EnergyBalanceDisplayInput, at date: Date) -> EnergyBalanceDisplay {
        EnergyBalanceDisplay(input, at: date, calendar: calendar, locale: locale)
    }

    func testKcalTextUsesGroupingTrueMinusAndNoNegativeZero() {
        let english = Locale(identifier: "en_US")
        XCTAssertEqual(KcalText.plain(1_461.4, locale: english), "1,461")
        XCTAssertEqual(KcalText.signed(251, locale: english), "+251")
        XCTAssertEqual(KcalText.signed(-851.2, locale: english), "−851")
        XCTAssertEqual(KcalText.signed(-0.4, locale: english), "0")
        XCTAssertEqual(KcalText.plain(.nan, locale: english), "—")
        XCTAssertEqual(KcalText.approximate(-851, signed: true, locale: english), "≈ −851")
        XCTAssertEqual(KcalText.approximate(2_312, signed: false, locale: english), "≈ 2,312")
        XCTAssertEqual(KcalText.signed(-1_250, locale: Locale(identifier: "de_DE")), "−1.250")
    }

    func testCompactKcalForTheWatchRing() {
        let english = Locale(identifier: "en_US")
        XCTAssertEqual(KcalText.compact(951, locale: english), "951")
        XCTAssertEqual(KcalText.compact(1_461, locale: english), "1.5k")
        XCTAssertEqual(KcalText.compact(1_000, locale: english), "1k")
        XCTAssertEqual(KcalText.compact(9_960, locale: english), "10k")
        XCTAssertEqual(KcalText.compact(12_850, locale: english), "13k")
    }

    func testTodayShowsTheDesignNumbers() {
        let display = Self.display(Self.input(), at: Self.date("2026-11-15", 13, 45))
        XCTAssertTrue(display.isCurrentDay)
        XCTAssertEqual(display.balance, "+251")
        XCTAssertEqual(display.balanceWithUnit, "+251 kcal")
        XCTAssertEqual(display.inOut, "In 1,461 · Out 1,210")
        XCTAssertEqual(display.resting, "679")
        XCTAssertEqual(display.active, "531")
        XCTAssertEqual(display.split, EnergyBalanceSplit(resting: 679, active: 531))
        XCTAssertEqual(display.endOfDayNet, "≈ −851")
        XCTAssertEqual(display.endOfDayBurned, "≈ 2,312")
        XCTAssertEqual(display.sevenDayAverage, "−371")
        XCTAssertEqual(display.planTarget, "2,243")
        XCTAssertEqual(display.planProgress ?? 0, 1_461.0 / 2_243.0, accuracy: 0.0001)
        XCTAssertEqual(display.compactConsumed, "1.5k")
        XCTAssertEqual(display.updatedTime, "13:40")
        XCTAssertEqual(display.periodCaption, "today so far")
        XCTAssertEqual(display.periodHeader, "Today so far · 13:40")
        XCTAssertEqual(display.inlineText, "+251 kcal so far")
        XCTAssertEqual(display.inlineAccessibility, display.balanceAccessibility)
        XCTAssertEqual(display.watchTitle(isStale: false), "Balance so far")
        XCTAssertEqual(display.watchTitle(isStale: true), "Balance at 13:40")
        XCTAssertEqual(display.splitAccessibility, "Out so far: resting 679 and active 531 kilocalories")
        XCTAssertEqual(display.planAccessibility, "Food in, 1,461 of 2,243 planned kilocalories")
    }

    func testMissingEnergyIsUnknownNotZero() {
        let display = Self.display(Self.input(burned: nil, active: nil, resting: nil, estimatedNet: nil,
                                              estimatedBurned: nil, average: nil),
                                   at: Self.date("2026-11-15", 13, 45))
        XCTAssertFalse(display.hasEnergy)
        XCTAssertEqual(display.balance, "—")
        XCTAssertEqual(display.inOut, "In 1,461 · Out —")
        XCTAssertNil(display.split)
        XCTAssertNil(display.endOfDayNet)
        XCTAssertEqual(display.sevenDayAverage, "—")
        XCTAssertEqual(display.inlineText, "In 1,461 kcal")
        XCTAssertEqual(display.inlineAccessibility, "In 1,461 kilocalories today so far, no energy recorded")
        XCTAssertEqual(display.inOutAccessibility, "In 1,461 kilocalories, out unavailable")
    }

    func testPlanProgressClampsAndNeedsAPositivePlan() {
        let over = EnergyBalanceDisplayInput(localDate: "2026-11-15", updatedAt: .now, consumedKcal: 3_000,
                                             burnedKcal: nil, planKcal: 2_000)
        XCTAssertEqual(Self.display(over, at: Self.date("2026-11-15", 20, 0)).planProgress, 1)
        XCTAssertNil(Self.display(Self.input(plan: 0), at: Self.date("2026-11-15", 20, 0)).planProgress)
        XCTAssertNil(Self.display(Self.input(plan: nil), at: Self.date("2026-11-15", 20, 0)).planTarget)
    }

    func testAfterMidnightTheSnapshotNamesItsDayAndDropsEstimates() {
        let display = Self.display(Self.input(), at: Self.date("2026-11-16", 0, 5))
        XCTAssertFalse(display.isCurrentDay)
        XCTAssertNil(display.endOfDayNet)
        XCTAssertNil(display.endOfDayBurned)
        XCTAssertEqual(display.balance, "+251", "Recorded values stay")
        XCTAssertEqual(display.periodCaption, "Sunday so far")
        XCTAssertEqual(display.periodHeader, "Sunday so far · 13:40")
        XCTAssertEqual(display.inlineText, "+251 kcal Sunday")
        XCTAssertEqual(display.inlineAccessibility, display.balanceAccessibility)
    }

    func testMissingEnergyStillNamesItsDayAtMidnightAndOnALaterFallback() {
        let input = Self.input(burned: nil, active: nil, resting: nil, estimatedNet: nil,
                               estimatedBurned: nil, average: nil)
        for hour in [0, 7] {
            let display = Self.display(input, at: Self.date("2026-11-16", hour, 0))
            XCTAssertFalse(display.isCurrentDay)
            XCTAssertFalse(display.hasEnergy)
            XCTAssertEqual(display.balance, "—", "Missing energy must not become a zero-burn balance")
            XCTAssertEqual(display.inlineText, "In 1,461 kcal Sunday")
            XCTAssertEqual(display.inlineAccessibility, "In 1,461 kilocalories Sunday so far, no energy recorded")
        }
    }

    func testCircularIntakeNamesItsSnapshotDayWithAndWithoutAPlan() {
        for plan: Double? in [2_243, nil] {
            let input = Self.input(plan: plan)
            let today = Self.display(input, at: Self.date("2026-11-15", 13, 45))
            XCTAssertEqual(today.circularIntakeCaption, plan == nil ? "kcal in" : "of 2,243")
            XCTAssertEqual(today.circularIntakeAccessibility, today.planAccessibility)

            for hour in [0, 7] {
                let historical = Self.display(input, at: Self.date("2026-11-16", hour, 0))
                XCTAssertEqual(historical.circularIntakeCaption, "Sunday")
                XCTAssertEqual(historical.circularIntakeAccessibility, plan == nil
                    ? "Food in, 1,461 kilocalories, Sunday"
                    : "Food in, 1,461 of 2,243 planned kilocalories, Sunday")
                XCTAssertEqual(historical.consumed, today.consumed, "Values describe the labeled snapshot day")
                XCTAssertEqual(historical.planProgress, today.planProgress)
            }
        }
    }

    func testWidgetSnapshotCarriesThePlanAndSevenDayAverage() {
        let today = "2026-11-15"
        let plan = NutritionPlan(id: "plan", name: "Plan", nutritionPlanFoods: [
            NutritionPlanFoodSlot(id: "slot", foodId: "food", grams: .number(150), slotTime: "08:00:00", position: 0,
                                  food: Food(id: "food", name: "Oats", isPublic: true, kcalPer100g: .number(200),
                                             fatPer100g: .number(0), carbsPer100g: .number(0),
                                             proteinPer100g: .number(0), fiberPer100g: .number(0),
                                             sugarPer100g: .number(0)))
        ])
        let payload = NutritionOverviewPayload(
            days: [NutritionDay(id: "day", logDate: today, nutritionPlanId: "plan", nutritionPlan: plan)],
            dailyEnergyEntries: [DailyEnergy(id: "energy", energyOn: today, activeKcal: 100, restingKcal: 900)]
        )
        let summary = EnergyBalanceOverviewSummary(payload: payload, today: today, calendar: Self.calendar)
        let snapshot = EnergyBalanceWidgetSnapshot(summary: summary, userMarker: "owner", generatedAt: .now)
        XCTAssertEqual(snapshot.planKcal, 300)
        XCTAssertEqual(snapshot.burnedKcal, 1_000)
        XCTAssertEqual(snapshot.sevenDayAverageNet, -1_000)
        XCTAssertEqual(snapshot.netKcal, -1_000)
    }

    func testRollingAverageCountsOnlyDatesWithIntakeAndEnergy() throws {
        let energy = [
            "2026-11-15": DailyEnergy(id: "a", energyOn: "2026-11-15", activeKcal: 0, restingKcal: 2_000),
            "2026-11-14": DailyEnergy(id: "b", energyOn: "2026-11-14", restingKcal: 1_500),
            "2026-11-08": DailyEnergy(id: "c", energyOn: "2026-11-08", restingKcal: 1_000)
        ]
        let intake = ["2026-11-15": 1_500.0, "2026-11-14": 1_700, "2026-11-13": 2_000, "2026-11-08": 3_000]
        let average = try XCTUnwrap(RollingCalorieNetAverage(
            endingOn: "2026-11-15", intakeByDate: intake, energyByDate: energy, calendar: Self.calendar
        ))
        XCTAssertEqual(average.averageNet, -150)
        XCTAssertEqual(average.includedDayCount, 2, "Nov 13 lacks energy; Nov 8 is outside the window")
        XCTAssertNil(RollingCalorieNetAverage(endingOn: "2026-11-15", intakeByDate: [:], energyByDate: energy))
    }

    func testSnapshotStoreUsesVersionTwoAndRemovesTheLegacyKey() throws {
        let suite = "neogym.tests.widget.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(Data("{}".utf8), forKey: "energyBalanceWidgetSnapshot.v1")
        let store = EnergyBalanceWidgetSnapshotStore(suiteName: suite)
        let snapshot = EnergyBalanceWidgetSnapshot(localDate: "2026-11-15", userMarker: "owner",
                                                   generatedAt: Self.date("2026-11-15", 13, 40),
                                                   consumedKcal: 1_461, burnedKcal: 1_210)
        XCTAssertTrue(store.save(snapshot))
        XCTAssertEqual(store.load(), snapshot)
        XCTAssertNil(defaults.data(forKey: "energyBalanceWidgetSnapshot.v1"))
        XCTAssertTrue(store.clear())
        XCTAssertNil(store.load())
    }
}

final class WatchComplicationContentTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func snapshot(updatedAt: Date, localDate: String = "2026-06-25") -> WatchEnergySnapshot {
        WatchEnergySnapshot(userID: "owner", localDate: localDate, consumedKcal: 1_461, burnedKcal: 1_210,
                            activeKcal: 531, restingKcal: 679, updatedAt: updatedAt, rowSource: .imported,
                            pendingBackend: false, planKcal: 2_243)
    }

    private let noon = ISO8601DateFormatter().date(from: "2026-06-25T12:00:00Z")!

    func testNoSnapshotMeansNotConnected() {
        XCTAssertEqual(WatchComplicationContent(latest: nil, at: noon, calendar: calendar), .notConnected)
        XCTAssertTrue(WatchComplicationContent.transitionDates(for: nil, after: noon, calendar: calendar).isEmpty)
    }

    func testAnEarlierDaysSnapshotWaitsForToday() {
        let yesterday = snapshot(updatedAt: noon.addingTimeInterval(-86_400), localDate: "2026-06-24")
        XCTAssertEqual(WatchComplicationContent(latest: yesterday, at: noon, calendar: calendar), .waitingForToday)
    }

    func testFreshThenStaleThenMidnight() throws {
        let latest = snapshot(updatedAt: noon)
        guard case let .balance(display, isStale) = WatchComplicationContent(
            latest: latest, at: noon.addingTimeInterval(10 * 60), calendar: calendar, locale: Locale(identifier: "en_US")
        ) else { return XCTFail("Expected today's balance") }
        XCTAssertFalse(isStale)
        XCTAssertEqual(display.planTarget, "2,243")
        guard case let .balance(_, stale) = WatchComplicationContent(
            latest: latest, at: noon.addingTimeInterval(WatchComplicationContent.staleAfter), calendar: calendar
        ) else { return XCTFail("Expected today's balance") }
        XCTAssertTrue(stale)

        let dates = WatchComplicationContent.transitionDates(for: latest, after: noon, calendar: calendar)
        let midnight = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-26T00:00:00Z"))
        XCTAssertEqual(dates, [noon.addingTimeInterval(WatchComplicationContent.staleAfter), midnight])
        XCTAssertEqual(WatchComplicationContent(latest: latest, at: midnight, calendar: calendar), .waitingForToday)
    }

    func testLatestSnapshotLoadsAnyDayButDatedLoadStaysToday() throws {
        let suite = "neogym.tests.watch.\(UUID().uuidString)"
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let store = WatchEnergySnapshotStore(suite: suite)
        XCTAssertNil(store.loadLatest())
        XCTAssertTrue(store.save(snapshot(updatedAt: noon, localDate: "2026-06-24")))
        XCTAssertEqual(store.loadLatest()?.localDate, "2026-06-24")
        XCTAssertNil(store.load(for: "2026-06-25"))
        store.clear()
        XCTAssertNil(store.loadLatest())
    }

    func testPlanChangesRequestAReloadButTheSevenDayAverageDoesNot() {
        let base = snapshot(updatedAt: noon)
        let replan = WatchEnergySnapshot(userID: "owner", localDate: "2026-06-25", consumedKcal: 1_461,
                                         burnedKcal: 1_210, activeKcal: 531, restingKcal: 679, updatedAt: noon,
                                         rowSource: .imported, pendingBackend: false, planKcal: 1_800)
        let average = WatchEnergySnapshot(userID: "owner", localDate: "2026-06-25", consumedKcal: 1_461,
                                          burnedKcal: 1_210, activeKcal: 531, restingKcal: 679, updatedAt: noon,
                                          rowSource: .imported, pendingBackend: false, planKcal: 2_243,
                                          sevenDayAverageNet: -300)
        XCTAssertFalse(base.hasSameDisplayValues(as: replan))
        XCTAssertTrue(base.hasSameDisplayValues(as: average))
    }

    func testLocalHealthEstimateKeepsThePlanAndAverage() throws {
        let server = WatchEnergySnapshot(userID: "owner", localDate: "2026-06-25", consumedKcal: 1_461,
                                         burnedKcal: 1_000, updatedAt: noon, rowSource: .imported,
                                         pendingBackend: false, planKcal: 2_243, sevenDayAverageNet: -371)
        let local = try XCTUnwrap(WatchLocalEnergyPolicy.estimate(
            from: server, imported: [HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 600, restingKcal: 900)],
            ownerID: "owner", today: "2026-06-25", now: noon
        ))
        XCTAssertEqual(local.planKcal, 2_243)
        XCTAssertEqual(local.sevenDayAverageNet, -371)
        XCTAssertEqual(local.pendingBackend, true)
    }
}

final class WatchTodayEnergyQueryTests: XCTestCase {
    func testReadsTodaysPlanKcalAndTheSevenDayNetAverage() async throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-25T12:00:00Z"))
        func day(_ date: String, grams: String) -> JSONValue {
            .object([
                "logDate": .string(date),
                "nutritionLogEntries": .array([.object(["grams": .string(grams), "snapshotKcalPer100g": .string("100")])]),
                "nutritionLogMeals": .array([])
            ])
        }
        func energy(_ date: String, resting: Int) -> JSONValue {
            .object(["id": .string(date), "energyOn": .string(date), "activeKcal": .null,
                     "restingKcal": .number(Double(resting)), "notes": .string("Manual")])
        }
        let food: JSONValue = .object([
            "id": .string("food"), "name": .string("Oats"), "userId": .null, "isPublic": .bool(true),
            "kcalPer100g": .string("200"), "fatPer100g": .string("0"), "carbsPer100g": .string("0"),
            "proteinPer100g": .string("0"), "fiberPer100g": .string("0"), "sugarPer100g": .string("0")
        ])
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([day("2026-06-25", grams: "1500"), day("2026-06-24", grams: "2000")]),
            "todayPlan": .array([.object(["logDate": .string("2026-06-25"), "nutritionPlan": .object([
                "id": .string("plan"), "name": .string("Plan"), "description": .null,
                "nutritionPlanMeals": .array([]),
                "nutritionPlanFoods": .array([.object([
                    "id": .string("slot"), "foodId": .string("food"), "grams": .string("150"),
                    "slotTime": .string("08:00:00"), "label": .null, "position": .number(0), "food": food
                ])])
            ])])]),
            "dailyEnergyEntries": .array([energy("2026-06-25", resting: 1_000), energy("2026-06-24", resting: 1_800)])
        ]))])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: EmptyEnergyImporter(), calendar: calendar)

        let snapshot = try await service.refresh(userID: "owner", syncHealth: false, now: now)

        XCTAssertEqual(snapshot.consumedKcal, 1_500)
        XCTAssertEqual(snapshot.planKcal, 300)
        XCTAssertEqual(snapshot.sevenDayAverageNet, 350, "(500 + 200) / 2 over dates with intake and energy")
        XCTAssertTrue(WatchEnergyService.todayQuery.contains("todayPlan: nutritionDays"))
        XCTAssertTrue(WatchEnergyService.todayQuery.contains("logDate: { _gte: $since, _lte: $date }"))
    }
}

private struct EmptyEnergyImporter: DailyEnergyHealthImporting {
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] { [] }
}

final class AppDeepLinkTests: XCTestCase {
    func testParsesWidgetAndLiveActivityLinks() throws {
        XCTAssertEqual(AppDeepLink(url: AppDeepLink.todayURL), .today)
        let sessionURL = try XCTUnwrap(AppDeepLink.sessionURL("5f0c-41"))
        XCTAssertEqual(sessionURL.absoluteString, "neogym://session/5f0c-41")
        XCTAssertEqual(AppDeepLink(url: sessionURL), .session("5f0c-41"))
    }

    func testRejectsAuthCallbacksAndMalformedLinks() throws {
        for raw in ["neogym://verify?code=abc", "neogym://session", "neogym://session/a/b", "neogym://today/x",
                    "https://today", "neogym://"] {
            XCTAssertNil(AppDeepLink(url: try XCTUnwrap(URL(string: raw))), raw)
        }
        XCTAssertNil(AppDeepLink.sessionURL(""))
        XCTAssertNil(AppDeepLink.sessionURL("a/b"))
    }
}

@MainActor
final class RestTimerSetContextTests: XCTestCase {
    private final class NoEffects: RestTimerEffects {
        var scheduled: [RestTimerSchedule] = []
        func schedule(_ schedule: RestTimerSchedule) { scheduled.append(schedule) }
        func cancel() {}
        func finish() {}
    }

    private func defaults() throws -> (UserDefaults, String) {
        let suite = "neogym.tests.rest.\(UUID().uuidString)"
        return (try XCTUnwrap(UserDefaults(suiteName: suite)), suite)
    }

    func testAfterLoggingDescribesTheNextSetFromTheOneJustLogged() {
        let context = RestTimerSetContext.afterLogging(exerciseName: "Leg Extensions", loggedSetNumber: 2,
                                                       weight: 95, reps: 10, doubleWeight: false)
        XCTAssertEqual(context.nextSetNumber, 3)
        XCTAssertEqual(context.target, "95 kg × 10")
        XCTAssertEqual(context.runningLabel, "Leg Extensions · set 3 next")
        XCTAssertEqual(context.finishedLabel, "Leg Extensions · set 3")
        XCTAssertEqual(RestTimerSetContext.afterLogging(exerciseName: "Curl", loggedSetNumber: 1, weight: 12.5,
                                                        reps: 8, doubleWeight: true).target, "12.5 kg × 8 /side")
        XCTAssertEqual(RestTimerSchedule(endDate: .now, duration: 90, context: context).label,
                       "Leg Extensions · set 3 next", "The pill and notification keep their wording")
    }

    func testContextSurvivesRestorationAndBackgroundIntentExtension() throws {
        let (store, suite) = try defaults()
        defer { store.removePersistentDomain(forName: suite) }
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let context = RestTimerSetContext(exerciseName: "Leg Extensions", nextSetNumber: 3, target: "95 kg × 10")
        let timer = RestTimerController(ownerId: "owner", defaults: store, effects: NoEffects(), now: { start })
        timer.start(seconds: 90, sessionId: "session-1", context: context)

        let restored = RestTimerController(ownerId: "owner", defaults: store, effects: NoEffects(),
                                           now: { start.addingTimeInterval(10) })
        XCTAssertEqual(restored.schedule?.context, context)
        XCTAssertEqual(restored.schedule?.sessionId, "session-1")

        let extended = try XCTUnwrap(RestTimerController.extendPersisted(defaults: store,
                                                                          now: start.addingTimeInterval(20)))
        XCTAssertEqual(extended.duration, 120)
        XCTAssertEqual(extended.context, context)
        XCTAssertEqual(extended.startDate, start)
        let afterIntent = RestTimerController(ownerId: "owner", defaults: store, effects: NoEffects(),
                                              now: { start.addingTimeInterval(30) })
        XCTAssertEqual(afterIntent.schedule?.endDate, start.addingTimeInterval(120))
        let otherOwner = RestTimerController(ownerId: "someone-else", defaults: store, effects: NoEffects(),
                                             now: { start.addingTimeInterval(30) })
        XCTAssertNil(otherOwner.schedule, "An intent never transfers a rest to another account")
    }

    func testBackgroundIntentsDoNothingOnceTheRestEnded() throws {
        let (store, suite) = try defaults()
        defer { store.removePersistentDomain(forName: suite) }
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let timer = RestTimerController(ownerId: "owner", defaults: store, effects: NoEffects(), now: { start })
        timer.start(seconds: 30)
        XCTAssertNil(RestTimerController.extendPersisted(defaults: store, now: start.addingTimeInterval(31)))
        XCTAssertNil(store.dictionary(forKey: RestTimerController.persistedKey))

        timer.start(seconds: 30)
        RestTimerController.cancelPersisted(defaults: store)
        XCTAssertNil(store.dictionary(forKey: RestTimerController.persistedKey))
    }
}
