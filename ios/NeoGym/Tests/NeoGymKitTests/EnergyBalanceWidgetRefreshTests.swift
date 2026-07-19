import Nhost
import XCTest
@testable import NeoGymKit

final class EnergyBalanceWidgetLiveRefreshTests: XCTestCase {
    func testLiveSuccessWritesAndReturnsFreshSnapshot() async throws {
        let payload = NutritionOverviewPayload(days: [Self.day()], dailyEnergyEntries: [Self.energy()])
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: nil,
            recorder: recorder,
            clientFactory: {
                EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { try Self.session(userId: "user-live") },
                    overviewProvider: { payload }
                )
            }
        )

        let result = await orchestrator.refresh(date: Self.now, locale: Locale(identifier: "en_US_POSIX"))

        XCTAssertEqual(result.decision, .liveSnapshot)
        XCTAssertEqual(result.snapshot?.userMarker, "user-live")
        XCTAssertEqual(recorder.snapshots.count, 1)
        XCTAssertEqual(recorder.snapshots.first, result.snapshot)
    }

    func testAppHeldLockTimeoutUsesCachedFallbackWithoutWrite() async {
        let cached = Self.cachedSnapshot()
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: cached,
            recorder: recorder,
            clientFactory: {
                EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { throw SessionCoordinationError.timedOut },
                    overviewProvider: { NutritionOverviewPayload(days: []) }
                )
            }
        )

        let result = await orchestrator.refresh(date: Self.now)

        XCTAssertEqual(result, EnergyBalanceWidgetLiveRefreshResult(
            snapshot: cached,
            decision: .cachedFallback
        ))
        XCTAssertTrue(recorder.snapshots.isEmpty)
    }

    func testCancellationUsesCachedFallbackWithoutWrite() async {
        let cached = Self.cachedSnapshot()
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: cached,
            recorder: recorder,
            clientFactory: {
                EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { throw CancellationError() },
                    overviewProvider: { NutritionOverviewPayload(days: []) }
                )
            }
        )

        let result = await orchestrator.refresh(date: Self.now)

        XCTAssertEqual(result.decision, .cachedFallback)
        XCTAssertEqual(result.snapshot, cached)
        XCTAssertTrue(recorder.snapshots.isEmpty)
    }

    func testWidgetFactoryFailureUsesCachedFallbackWithoutWrite() async {
        let cached = Self.cachedSnapshot()
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: cached,
            recorder: recorder,
            clientFactory: { throw TestFailure.configuration }
        )

        let result = await orchestrator.refresh(date: Self.now)

        XCTAssertEqual(result.decision, .cachedFallback)
        XCTAssertEqual(result.snapshot, cached)
        XCTAssertTrue(recorder.snapshots.isEmpty)
    }

    func testAuthFailureUsesCachedFallbackWithoutWrite() async {
        let cached = Self.cachedSnapshot()
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: cached,
            recorder: recorder,
            clientFactory: {
                EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { throw TestFailure.auth },
                    overviewProvider: { NutritionOverviewPayload(days: []) }
                )
            }
        )

        let result = await orchestrator.refresh(date: Self.now)

        XCTAssertEqual(result.decision, .cachedFallback)
        XCTAssertEqual(result.snapshot, cached)
        XCTAssertTrue(recorder.snapshots.isEmpty)
    }

    func testNetworkFailureWithoutCacheUsesEmptyFallbackWithoutWrite() async {
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: nil,
            recorder: recorder,
            clientFactory: {
                EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { try Self.session(userId: "user-network") },
                    overviewProvider: { throw TestFailure.network }
                )
            }
        )

        let result = await orchestrator.refresh(date: Self.now)

        XCTAssertEqual(result.decision, .emptyState)
        XCTAssertNil(result.snapshot)
        XCTAssertTrue(recorder.snapshots.isEmpty)
    }

    func testNoSessionUsesEmptyFallbackWithoutWrite() async {
        let recorder = SnapshotWriteRecorder()
        let orchestrator = makeOrchestrator(
            cachedSnapshot: nil,
            recorder: recorder,
            clientFactory: {
                EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { nil },
                    overviewProvider: { NutritionOverviewPayload(days: []) }
                )
            }
        )

        let result = await orchestrator.refresh(date: Self.now)

        XCTAssertEqual(result.decision, .emptyState)
        XCTAssertNil(result.snapshot)
        XCTAssertTrue(recorder.snapshots.isEmpty)
    }

    private func makeOrchestrator(
        cachedSnapshot: EnergyBalanceWidgetSnapshot?,
        recorder: SnapshotWriteRecorder,
        clientFactory: @escaping @Sendable () throws -> EnergyBalanceWidgetLiveRefreshClient
    ) -> EnergyBalanceWidgetLiveRefreshOrchestrator {
        EnergyBalanceWidgetLiveRefreshOrchestrator(
            cachedSnapshotProvider: { cachedSnapshot },
            liveRefreshClientFactory: clientFactory,
            snapshotWriter: { recorder.record($0) }
        )
    }

    private static let now = Date(timeIntervalSince1970: 1_783_771_200)

    private static func cachedSnapshot() -> EnergyBalanceWidgetSnapshot {
        EnergyBalanceWidgetSnapshot(
            localDate: "2026-07-11",
            userMarker: "cached-user",
            generatedAtISO8601: "2026-07-11T12:00:00Z",
            generatedAtText: "Jul 11, 2026 at 12:00 PM",
            lastSyncedText: "Last synced 12:00 PM",
            consumedValue: "1,200 kcal",
            consumedCaption: "As of 12:00 PM",
            burnedValue: "1,800 kcal",
            burnedCaption: "300 + 1,500 kcal",
            netValue: "−600 kcal",
            netCaption: "Deficit",
            netState: "deficit",
            sevenDayValue: "−200 kcal",
            sevenDayCaption: "Deficit",
            sevenDayState: "deficit"
        )
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

private enum TestFailure: Error {
    case auth
    case configuration
    case network
}

private final class SnapshotWriteRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var recordedSnapshots: [EnergyBalanceWidgetSnapshot] = []

    var snapshots: [EnergyBalanceWidgetSnapshot] {
        lock.withLock { recordedSnapshots }
    }

    func record(_ snapshot: EnergyBalanceWidgetSnapshot) {
        lock.withLock {
            recordedSnapshots.append(snapshot)
        }
    }
}
