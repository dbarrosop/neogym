import Nhost
import XCTest
@testable import NeoGymKit

final class EnergyBalanceWidgetLiveRefreshTests: XCTestCase {
    func testLiveFetchSuccessReturnsOverviewAndRequestsSnapshotWriteDecision() async throws {
        let payload = NutritionOverviewPayload(days: [Self.day()], dailyEnergyEntries: [Self.energy()])
        let client = EnergyBalanceWidgetLiveRefreshClient(
            sessionProvider: { try Self.session(userId: "user-live") },
            overviewProvider: { payload }
        )

        let result = try await client.fetchOverview()
        let decision = EnergyBalanceWidgetLiveRefreshDecision.decide(
            liveFetchSucceeded: true,
            cachedSnapshotExists: false
        )

        XCTAssertEqual(result.userMarker, "user-live")
        XCTAssertEqual(result.overview, payload)
        XCTAssertEqual(decision, .liveSnapshot)
        XCTAssertTrue(decision.shouldWriteLiveSnapshot)
    }

    func testNoSessionFallsBackToCacheDecision() async throws {
        let client = EnergyBalanceWidgetLiveRefreshClient(
            sessionProvider: { nil },
            overviewProvider: { NutritionOverviewPayload(days: []) }
        )

        do {
            _ = try await client.fetchOverview()
            XCTFail("Expected no-session error")
        } catch let error as EnergyBalanceWidgetLiveRefreshError {
            XCTAssertEqual(error, .noSession)
        }

        let decision = EnergyBalanceWidgetLiveRefreshDecision.decide(
            liveFetchSucceeded: false,
            cachedSnapshotExists: true
        )
        XCTAssertEqual(decision, .cachedFallback)
        XCTAssertFalse(decision.shouldWriteLiveSnapshot)
    }

    func testNetworkFailureWithoutCacheProducesEmptyDecision() {
        let decision = EnergyBalanceWidgetLiveRefreshDecision.decide(
            liveFetchSucceeded: false,
            cachedSnapshotExists: false
        )

        XCTAssertEqual(decision, .emptyState)
        XCTAssertFalse(decision.shouldWriteLiveSnapshot)
    }

    private static func session(userId: String) throws -> StoredSession {
        try StoredSession(
            accessToken: "header.payload.signature",
            accessTokenExpiresIn: 900,
            refreshTokenId: "refresh-token-id",
            refreshToken: "refresh-token",
            user: AuthUser(
                avatarUrl: "",
                createdAt: Date(timeIntervalSince1970: 1_700_000_000),
                defaultRole: "user",
                displayName: "Neo Athlete",
                email: "athlete@example.com",
                emailVerified: true,
                id: userId,
                isAnonymous: false,
                locale: "en",
                metadata: [:],
                phoneNumberVerified: false,
                roles: ["user"]
            ),
            decodedToken: DecodedToken(claims: [:])
        )
    }

    private static func day() -> NutritionDay {
        NutritionDay(
            id: "day-1",
            userId: "user-live",
            logDate: "2026-07-11",
            nutritionLogEntries: [
                NutritionLogEntry(
                    id: "entry-1",
                    nutritionDayId: "day-1",
                    grams: .number(100),
                    position: 0,
                    slotTime: "12:00:00",
                    snapshotFoodName: "Oats",
                    snapshotKcalPer100g: .number(250),
                    snapshotFatPer100g: .number(5),
                    snapshotCarbsPer100g: .number(35),
                    snapshotProteinPer100g: .number(10),
                    snapshotFiberPer100g: .number(6),
                    snapshotSugarPer100g: .number(1)
                )
            ]
        )
    }

    private static func energy() -> DailyEnergy {
        DailyEnergy(
            id: "energy-1",
            energyOn: "2026-07-11",
            activeKcal: 300,
            restingKcal: 1_500
        )
    }
}
