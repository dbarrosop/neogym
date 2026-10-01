import Foundation

/// Fixed, non-sensitive diagnostics. Never record account IDs, tokens, response bodies,
/// URLs, user-entered values, or raw error descriptions in the watch event history.
public enum WatchEventAction: String, Codable, Sendable {
    case backgroundScheduling
    case backgroundTask
    case appLifecycle
    case accountValidation
    case energyRefresh
    case healthPermission
    case healthObservation
    case healthBackgroundDelivery
    case healthSync
    case refreshStage
    case snapshotSave
    case complicationReload

    public var title: String {
        switch self {
        case .backgroundScheduling: "Background refresh request"
        case .backgroundTask: "Background wake"
        case .appLifecycle: "App state"
        case .accountValidation: "Account validation"
        case .energyRefresh: "Energy refresh"
        case .healthPermission: "Apple Health permission"
        case .healthObservation: "Health observer"
        case .healthBackgroundDelivery: "Health background delivery"
        case .healthSync: "Apple Health sync"
        case .refreshStage: "Refresh stage"
        case .snapshotSave: "Complication snapshot save"
        case .complicationReload: "Complication reload request"
        }
    }
}

public enum WatchEventOutcome: String, Codable, Sendable {
    case started
    case entered
    case accepted
    case succeeded
    case failed
    case requested
    case finished
    case expired
    case acknowledged
    case timedOut
    case joined
    case skipped

    public var title: String {
        switch self {
        case .started: "Started"
        case .entered: "Entered"
        case .accepted: "Accepted by watchOS"
        case .succeeded: "Succeeded"
        case .failed: "Failed"
        case .requested: "Requested"
        case .finished: "Finished"
        case .expired: "Expired by watchOS"
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
    case profileRead
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
        case .profileRead: "Auth profile read"
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

    /// Safe provenance is carried separately; never use a Swift NSError enum
    /// index as a network or HTTP code.
    public static func graphQL(_ error: GraphQLDomainError) -> Self {
        switch error {
        case .transport, .transportDetailed: .transport
        case .graphQLErrors, .missingData, .decoding: .backend
        }
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
    case coalesced

    public var title: String {
        switch self {
        case .accountUnavailable: "account unavailable"
        case .contextUnavailable: "local context unavailable"
        case .accountValidationFailed: "account validation failed"
        case .accountChanged: "account changed"
        case .cancelled: "cancelled"
        case .staleRefresh: "stale in-flight refresh replaced"
        case .coalesced: "background widget reload coalesced"
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
    public let transportKind: WatchTransportKind?
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
    /// Elapsed wall-clock time for stage/background-task terminal events.
    public let wallSeconds: Int?

    public var diagnosticDetails: String? {
        var parts: [String] = []
        if let attemptID { parts.append("attempt \(attemptID.uuidString.prefix(8))") }
        if let metric { parts.append(metric.title) }
        if let runtimeState { parts.append("app \(runtimeState.rawValue)") }
        if let backendOperation { parts.append(backendOperation.title) }
        if outcome != .failed, let stage { parts.append(stage.title) }
        if let skipReason { parts.append(skipReason.title) }
        if outcome != .failed, let transportKind { parts.append(transportKind.title) }
        if outcome != .failed, let errorCode, transportKind != nil { parts.append("code \(errorCode)") }
        if let failureDetails { parts.append(failureDetails) }
        if let durationSeconds { parts.append("\(durationSeconds)s") }
        if let wallSeconds { parts.append("elapsed \(wallSeconds)s wall") }
        if let pendingWallSeconds { parts.append("pending \(pendingWallSeconds)s wall") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public var failureDetails: String? {
        guard outcome == .failed else { return nil }
        var parts = [stage?.title, errorSource?.title, transportKind?.title,
                     errorCode.map { "code \($0)" }].compactMap { $0 }
        if errorSource == .healthKit, errorCode == 3 {
            parts.append("Invalid HealthKit argument")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public init(
        action: WatchEventAction, outcome: WatchEventOutcome,
        trigger: WatchEventTrigger? = nil, errorCode: Int? = nil,
        errorSource: WatchEventErrorSource? = nil, transportKind: WatchTransportKind? = nil,
        stage: WatchEventStage? = nil,
        attemptID: UUID? = nil, metric: WatchEventMetric? = nil,
        runtimeState: WatchEventRuntimeState? = nil, backendOperation: WatchEventBackendOperation? = nil,
        skipReason: WatchEventSkipReason? = nil, durationSeconds: Int? = nil,
        pendingWallSeconds: Int? = nil, wallSeconds: Int? = nil,
        occurredAt: Date = Date(), id: UUID = UUID()
    ) {
        self.id = id
        self.occurredAt = occurredAt
        self.action = action
        self.outcome = outcome
        self.trigger = trigger
        self.errorCode = errorCode
        self.errorSource = errorSource
        self.transportKind = transportKind
        self.stage = stage
        self.attemptID = attemptID
        self.metric = metric
        self.runtimeState = runtimeState
        self.backendOperation = backendOperation
        self.skipReason = skipReason
        self.durationSeconds = durationSeconds
        self.pendingWallSeconds = pendingWallSeconds
        self.wallSeconds = wallSeconds
    }
}

/// Only trusted OS codes and allowlisted SDK transport diagnostics may reach events.
/// Swift Error-to-NSError bridging otherwise exposes enum case indexes, not codes.
public struct WatchEventFailureClassification: Equatable, Sendable {
    // HealthKit is unavailable to the host-testable package. This is the value
    // of HealthKit's HKErrorDomain constant, not its Swift symbol name.
    private static let healthKitErrorDomain = "com.apple.healthkit"

    public let source: WatchEventErrorSource
    public let code: Int?
    public let transportKind: WatchTransportKind?

    public init(error: any Error, stage: WatchEventStage) {
        if let wrapped = error as? WatchHealthSyncFailure {
            self = wrapped.classification
            return
        }
        let nsError = error as NSError
        if nsError.domain == Self.healthKitErrorDomain {
            self.init(source: .healthKit, code: nsError.code)
        } else if nsError.domain == NSURLErrorDomain {
            self.init(source: .network, code: nsError.code)
        } else if let graphQL = error as? GraphQLDomainError {
            let diagnostic = graphQL.transportDiagnostic
            self.init(source: .graphQL(graphQL), code: diagnostic?.code, transportKind: diagnostic?.kind)
        } else {
            let diagnostic = WatchTransportDiagnostic.classify(error)
            if diagnostic.kind != .unknown {
                self.init(source: .network, code: diagnostic.code, transportKind: diagnostic.kind)
            } else {
                self.init(source: stage == .backendRead || stage == .backendWrite ? .backend : .other)
            }
        }
    }

    private init(source: WatchEventErrorSource, code: Int? = nil, transportKind: WatchTransportKind? = nil) {
        self.source = source
        self.code = code
        self.transportKind = transportKind
    }
}

/// Carries a sync failure's precise phase across the host-testable repository
/// boundary. The original description is only used for the ephemeral watch UI,
/// not stored in WatchEventStore or included in a shared log.
public struct WatchHealthSyncFailure: LocalizedError, Sendable {
    public let classification: WatchEventFailureClassification
    public let stage: WatchEventStage
    public let underlyingDomain: String
    public let underlyingCode: Int
    public let diagnosticSource: WatchEventErrorSource?
    public let transportDiagnostic: WatchTransportDiagnostic?
    public let backendOperation: WatchEventBackendOperation?
    private let reason: String

    public init(stage: WatchEventStage, cause: any Error,
                backendOperation: WatchEventBackendOperation? = nil) {
        let error = cause as NSError
        self.stage = stage
        underlyingDomain = error.domain
        underlyingCode = error.code
        let classified = WatchEventFailureClassification(error: cause, stage: stage)
        classification = classified
        diagnosticSource = classified.source
        transportDiagnostic = classified.transportKind.map {
            WatchTransportDiagnostic(kind: $0, code: classified.code)
        }
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
        // A callback may capture its timestamp before MainActor can persist
        // it. Keep exports truly newest-first even after a delayed write.
        let events = Array(([event] + load()).sorted { $0.occurredAt > $1.occurredAt }.prefix(maximumCount))
        if let data = try? JSONEncoder().encode(events) { defaults.set(data, forKey: key) }
        return events
    }

    public func clear() { defaults.removeObject(forKey: key) }

    private var defaults: UserDefaults {
        suite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    }
}
