import Foundation

/// Fixed, non-sensitive diagnostics. Never record account IDs, tokens, response bodies,
/// URLs, user-entered values, or raw error descriptions in the watch event history.
public enum WatchEventAction: String, Codable, Sendable {
    case backgroundScheduling
    case backgroundTask
    case energyRefresh
    case healthPermission
    case healthObservation
    case healthBackgroundDelivery
    case healthSync
    case snapshotSave
    case complicationReload

    public var title: String {
        switch self {
        case .backgroundScheduling: "Background refresh request"
        case .backgroundTask: "Background wake"
        case .energyRefresh: "Energy refresh"
        case .healthPermission: "Apple Health permission"
        case .healthObservation: "Health observer"
        case .healthBackgroundDelivery: "Health background delivery"
        case .healthSync: "Apple Health sync"
        case .snapshotSave: "Complication snapshot save"
        case .complicationReload: "Complication reload request"
        }
    }
}

public enum WatchEventOutcome: String, Codable, Sendable {
    case started
    case accepted
    case succeeded
    case failed
    case requested
    case finished
    case acknowledged
    case timedOut
    case joined
    case skipped

    public var title: String {
        switch self {
        case .started: "Started"
        case .accepted: "Accepted by watchOS"
        case .succeeded: "Succeeded"
        case .failed: "Failed"
        case .requested: "Requested"
        case .finished: "Finished"
        case .acknowledged: "HealthKit acknowledged"
        case .timedOut: "Timed out; HealthKit acknowledged"
        case .joined: "Joined ongoing refresh"
        case .skipped: "Skipped"
        }
    }
}

public enum WatchEventTrigger: String, Codable, Sendable {
    case automatic
    case manual
    case background
    case retry
    case healthObserver
    case healthAuthorization
    case pendingHealth

    public var title: String {
        switch self {
        case .automatic: "on open"
        case .manual: "manual"
        case .background: "background"
        case .retry: "retry after failure"
        case .healthObserver: "Health event"
        case .healthAuthorization: "Health permission"
        case .pendingHealth: "pending Health event"
        }
    }
}

public enum WatchEventStage: String, Codable, Sendable {
    case activeHealthQuery
    case restingHealthQuery
    case healthRead
    case observerQuery
    case backgroundDelivery
    case backendRead
    case backendWrite
    case authorization
    case scheduling
    case localHandoff

    public var title: String {
        switch self {
        case .activeHealthQuery: "Active energy HealthKit query"
        case .restingHealthQuery: "Resting energy HealthKit query"
        case .healthRead: "HealthKit import"
        case .observerQuery: "HealthKit observer query"
        case .backgroundDelivery: "HealthKit background delivery registration"
        case .backendRead: "Backend read"
        case .backendWrite: "Backend write"
        case .authorization: "Health permission request"
        case .scheduling: "Background scheduling"
        case .localHandoff: "Local Health handoff"
        }
    }
}

public enum WatchEventErrorSource: String, Codable, Sendable {
    case healthKit
    case network
    case backend
    case transport
    case other

    public var title: String {
        switch self {
        case .healthKit: "HealthKit"
        case .network: "Network"
        case .backend: "Backend"
        case .transport: "GraphQL transport"
        case .other: "Other"
        }
    }

    /// A GraphQL transport failure can represent an HTTP, network, or service
    /// problem. Do not mistake its Swift NSError code for a HealthKit code.
    public static func graphQL(_ error: GraphQLDomainError) -> Self {
        if case .transport = error { return .transport }
        return .backend
    }
}

public enum WatchEventMetric: String, Codable, Sendable {
    case activeEnergy
    case restingEnergy

    public var title: String {
        switch self {
        case .activeEnergy: "active energy"
        case .restingEnergy: "resting energy"
        }
    }
}

public enum WatchEventRuntimeState: String, Codable, Sendable {
    case active
    case inactive
    case background
    case unknown
}

public enum WatchEventBackendOperation: String, Codable, Sendable {
    case healthReconciliationRead
    case todayEnergyRead
    case createEnergy
    case updateEnergy

    public var title: String {
        switch self {
        case .healthReconciliationRead: "Health reconciliation read"
        case .todayEnergyRead: "Today energy read"
        case .createEnergy: "Create energy row"
        case .updateEnergy: "Update energy row"
        }
    }
}

public enum WatchEventSkipReason: String, Codable, Sendable {
    case accountUnavailable
    case contextUnavailable
    case accountValidationFailed
    case accountChanged
    case cancelled
    case staleRefresh

    public var title: String {
        switch self {
        case .accountUnavailable: "account unavailable"
        case .contextUnavailable: "local context unavailable"
        case .accountValidationFailed: "account validation failed"
        case .accountChanged: "account changed"
        case .cancelled: "cancelled"
        case .staleRefresh: "stale in-flight refresh replaced"
        }
    }
}

public struct WatchEvent: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let occurredAt: Date
    public let action: WatchEventAction
    public let outcome: WatchEventOutcome
    public let trigger: WatchEventTrigger?
    /// Numeric code and allowlisted category/stage only; never persist raw error
    /// descriptions, domains, URLs, or response bodies. Optional for v1 log compatibility.
    public let errorCode: Int?
    public let errorSource: WatchEventErrorSource?
    public let stage: WatchEventStage?
    /// Random per-attempt ID, never a user/session/HealthKit identifier.
    public let attemptID: UUID?
    public let metric: WatchEventMetric?
    public let runtimeState: WatchEventRuntimeState?
    public let backendOperation: WatchEventBackendOperation?
    public let skipReason: WatchEventSkipReason?
    public let durationSeconds: Int?
    /// Wall-clock age of a durable pending delivery when a refresh starts.
    /// Unlike system uptime, this includes time the watch was asleep.
    public let pendingWallSeconds: Int?

    public var diagnosticDetails: String? {
        var parts: [String] = []
        if let attemptID { parts.append("attempt \(attemptID.uuidString.prefix(8))") }
        if let metric { parts.append(metric.title) }
        if let runtimeState { parts.append("app \(runtimeState.rawValue)") }
        if let backendOperation { parts.append(backendOperation.title) }
        if let skipReason { parts.append(skipReason.title) }
        if let failureDetails { parts.append(failureDetails) }
        if let durationSeconds { parts.append("\(durationSeconds)s") }
        if let pendingWallSeconds { parts.append("pending \(pendingWallSeconds)s wall") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public var failureDetails: String? {
        guard outcome == .failed else { return nil }
        var parts = [stage?.title, errorSource?.title, errorCode.map { "code \($0)" }].compactMap { $0 }
        if errorSource == .healthKit, errorCode == 3 {
            parts.append("Invalid HealthKit argument")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public init(
        action: WatchEventAction, outcome: WatchEventOutcome,
        trigger: WatchEventTrigger? = nil, errorCode: Int? = nil,
        errorSource: WatchEventErrorSource? = nil, stage: WatchEventStage? = nil,
        attemptID: UUID? = nil, metric: WatchEventMetric? = nil,
        runtimeState: WatchEventRuntimeState? = nil, backendOperation: WatchEventBackendOperation? = nil,
        skipReason: WatchEventSkipReason? = nil, durationSeconds: Int? = nil,
        pendingWallSeconds: Int? = nil, occurredAt: Date = Date(), id: UUID = UUID()
    ) {
        self.id = id
        self.occurredAt = occurredAt
        self.action = action
        self.outcome = outcome
        self.trigger = trigger
        self.errorCode = errorCode
        self.errorSource = errorSource
        self.stage = stage
        self.attemptID = attemptID
        self.metric = metric
        self.runtimeState = runtimeState
        self.backendOperation = backendOperation
        self.skipReason = skipReason
        self.durationSeconds = durationSeconds
        self.pendingWallSeconds = pendingWallSeconds
    }
}

/// Carries a sync failure's precise phase across the host-testable repository
/// boundary. The original description is only used for the ephemeral watch UI,
/// not stored in WatchEventStore or included in a shared log.
public struct WatchHealthSyncFailure: LocalizedError, Sendable {
    public let stage: WatchEventStage
    public let underlyingDomain: String
    public let underlyingCode: Int
    public let diagnosticSource: WatchEventErrorSource?
    public let backendOperation: WatchEventBackendOperation?
    private let reason: String

    public init(stage: WatchEventStage, cause: any Error,
                backendOperation: WatchEventBackendOperation? = nil) {
        let error = cause as NSError
        self.stage = stage
        underlyingDomain = error.domain
        underlyingCode = error.code
        diagnosticSource = (cause as? GraphQLDomainError).map(WatchEventErrorSource.graphQL)
        self.backendOperation = backendOperation
        reason = error.localizedDescription
    }

    public var errorDescription: String? { "\(stage.title): \(reason)" }
}

/// Bounded, watch-app-only history. The complication never reads or writes this store.
public struct WatchEventStore: Sendable {
    private let suite: String?
    private let maximumCount: Int
    private let key = "watchEvents.v1"

    public init(suite: String? = nil, maximumCount: Int = 300) {
        self.suite = suite
        self.maximumCount = max(1, min(maximumCount, 300))
    }

    public func load() -> [WatchEvent] {
        guard let data = defaults.data(forKey: key),
              let events = try? JSONDecoder().decode([WatchEvent].self, from: data) else { return [] }
        return Array(events.prefix(maximumCount))
    }

    @discardableResult
    public func record(_ event: WatchEvent) -> [WatchEvent] {
        let events = Array(([event] + load()).prefix(maximumCount))
        if let data = try? JSONEncoder().encode(events) { defaults.set(data, forKey: key) }
        return events
    }

    public func clear() { defaults.removeObject(forKey: key) }

    private var defaults: UserDefaults {
        suite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    }
}
