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

    public static func decide(liveFetchSucceeded: Bool, cachedSnapshotExists: Bool) -> Self {
        if liveFetchSucceeded {
            return .liveSnapshot
        }

        return cachedSnapshotExists ? .cachedFallback : .emptyState
    }

    public var shouldWriteLiveSnapshot: Bool {
        self == .liveSnapshot
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

public extension NhostClientFactory {
    static func makeProductionWidgetLiveRefreshClient() -> EnergyBalanceWidgetLiveRefreshClient {
        let client = makeProductionWidgetClient()
        return EnergyBalanceWidgetLiveRefreshClient(
            authService: NhostAuthService(client: client),
            repository: NutritionFoodMealRepository(graphQL: NhostGraphQLService(client: client))
        )
    }
}
