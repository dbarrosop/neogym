import Foundation
import Nhost

public struct EnergyBalanceWidgetLiveRefreshPayload: Sendable, Equatable {
    public let overview: NutritionOverviewPayload
    public let userMarker: String?

    public init(overview: NutritionOverviewPayload, userMarker: String?) {
        self.overview = overview
        self.userMarker = userMarker
    }
}

public enum EnergyBalanceWidgetLiveRefreshError: Error, Sendable, Equatable {
    case noSession
}

public enum EnergyBalanceWidgetLiveRefreshDecision: Sendable, Equatable {
    case liveSnapshot
    case cachedFallback
    case emptyState
}

public struct EnergyBalanceWidgetLiveRefreshResult: Sendable, Equatable {
    public let snapshot: EnergyBalanceWidgetSnapshot?
    public let decision: EnergyBalanceWidgetLiveRefreshDecision

    public init(
        snapshot: EnergyBalanceWidgetSnapshot?,
        decision: EnergyBalanceWidgetLiveRefreshDecision
    ) {
        self.snapshot = snapshot
        self.decision = decision
    }
}

public struct EnergyBalanceWidgetLiveRefreshClient: Sendable {
    private let sessionProvider: @Sendable () async throws -> StoredSession?
    private let overviewProvider: @Sendable () async throws -> NutritionOverviewPayload

    public init(
        sessionProvider: @escaping @Sendable () async throws -> StoredSession?,
        overviewProvider: @escaping @Sendable () async throws -> NutritionOverviewPayload
    ) {
        self.sessionProvider = sessionProvider
        self.overviewProvider = overviewProvider
    }

    public init(
        authService: any AuthServicing,
        repository: any NutritionFoodMealRepositoryProtocol
    ) {
        self.init(
            sessionProvider: { try await authService.getUserSession() },
            overviewProvider: { try await repository.nutritionOverview() }
        )
    }

    public func fetchOverview() async throws -> EnergyBalanceWidgetLiveRefreshPayload {
        guard let session = try await sessionProvider() else {
            throw EnergyBalanceWidgetLiveRefreshError.noSession
        }

        return EnergyBalanceWidgetLiveRefreshPayload(
            overview: try await overviewProvider(),
            userMarker: session.user?.id
        )
    }
}

/// Owns the widget's best-effort live fetch, snapshot write, and fallback choice.
/// Any provisioning, coordination, cancellation, Auth, or network error is a
/// supported fallback outcome. A failed live attempt never writes a snapshot.
public struct EnergyBalanceWidgetLiveRefreshOrchestrator: Sendable {
    private let cachedSnapshotProvider: @Sendable () -> EnergyBalanceWidgetSnapshot?
    private let liveRefreshClientFactory: @Sendable () throws -> EnergyBalanceWidgetLiveRefreshClient
    private let snapshotWriter: @Sendable (EnergyBalanceWidgetSnapshot) -> Void

    public init(
        cachedSnapshotProvider: @escaping @Sendable () -> EnergyBalanceWidgetSnapshot?,
        liveRefreshClientFactory: @escaping @Sendable () throws -> EnergyBalanceWidgetLiveRefreshClient,
        snapshotWriter: @escaping @Sendable (EnergyBalanceWidgetSnapshot) -> Void
    ) {
        self.cachedSnapshotProvider = cachedSnapshotProvider
        self.liveRefreshClientFactory = liveRefreshClientFactory
        self.snapshotWriter = snapshotWriter
    }

    public init(
        snapshotStore: EnergyBalanceWidgetSnapshotStore,
        liveRefreshClientFactory: @escaping @Sendable () throws -> EnergyBalanceWidgetLiveRefreshClient
    ) {
        self.init(
            cachedSnapshotProvider: { snapshotStore.load() },
            liveRefreshClientFactory: liveRefreshClientFactory,
            snapshotWriter: { snapshot in
                _ = snapshotStore.save(snapshot)
            }
        )
    }

    public func refresh(
        date: Date,
        locale: Locale = .current
    ) async -> EnergyBalanceWidgetLiveRefreshResult {
        let cachedSnapshot = cachedSnapshotProvider()

        do {
            let payload = try await liveRefreshClientFactory().fetchOverview()
            let summary = EnergyBalanceOverviewSummary(
                payload: payload.overview,
                todayDate: date
            )
            let liveSnapshot = EnergyBalanceWidgetSnapshot(
                summary: summary,
                userMarker: payload.userMarker,
                generatedAt: date,
                locale: locale
            )
            snapshotWriter(liveSnapshot)
            return EnergyBalanceWidgetLiveRefreshResult(
                snapshot: liveSnapshot,
                decision: .liveSnapshot
            )
        } catch {
            return EnergyBalanceWidgetLiveRefreshResult(
                snapshot: cachedSnapshot,
                decision: cachedSnapshot == nil ? .emptyState : .cachedFallback
            )
        }
    }
}

public extension NhostClientFactory {
    static func makeProductionWidgetLiveRefreshClient() throws -> EnergyBalanceWidgetLiveRefreshClient {
        let client = try makeProductionWidgetClient()
        return EnergyBalanceWidgetLiveRefreshClient(
            authService: NhostAuthService(client: client),
            repository: NutritionFoodMealRepository(graphQL: NhostGraphQLService(client: client))
        )
    }
}
