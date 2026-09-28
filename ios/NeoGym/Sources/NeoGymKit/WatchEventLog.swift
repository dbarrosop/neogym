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
    case skipped

    public var title: String {
        switch self {
        case .started: "Started"
        case .accepted: "Accepted by watchOS"
        case .succeeded: "Succeeded"
        case .failed: "Failed"
        case .requested: "Requested"
        case .finished: "Finished"
        case .skipped: "Skipped"
        }
    }
}

public enum WatchEventTrigger: String, Codable, Sendable {
    case automatic
    case manual
    case background
    case healthObserver
    case healthAuthorization

    public var title: String {
        switch self {
        case .automatic: "on open"
        case .manual: "manual"
        case .background: "background"
        case .healthObserver: "Health event"
        case .healthAuthorization: "Health permission"
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
        }
    }
}

public enum WatchEventErrorSource: String, Codable, Sendable {
    case healthKit
    case network
    case backend
    case other

    public var title: String {
        switch self {
        case .healthKit: "HealthKit"
        case .network: "Network"
        case .backend: "Backend"
        case .other: "Other"
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
        occurredAt: Date = Date(), id: UUID = UUID()
    ) {
        self.id = id
        self.occurredAt = occurredAt
        self.action = action
        self.outcome = outcome
        self.trigger = trigger
        self.errorCode = errorCode
        self.errorSource = errorSource
        self.stage = stage
    }
}

/// Carries a sync failure's precise phase across the host-testable repository
/// boundary. The original description is only used for the ephemeral watch UI,
/// not stored in WatchEventStore or included in a shared log.
public struct WatchHealthSyncFailure: LocalizedError, Sendable {
    public let stage: WatchEventStage
    public let underlyingDomain: String
    public let underlyingCode: Int
    private let reason: String

    public init(stage: WatchEventStage, cause: any Error) {
        let error = cause as NSError
        self.stage = stage
        underlyingDomain = error.domain
        underlyingCode = error.code
        reason = error.localizedDescription
    }

    public var errorDescription: String? { "\(stage.title): \(reason)" }
}

/// Bounded, watch-app-only history. The complication never reads or writes this store.
public struct WatchEventStore: Sendable {
    private let suite: String?
    private let maximumCount: Int
    private let key = "watchEvents.v1"

    public init(suite: String? = nil, maximumCount: Int = 100) {
        self.suite = suite
        self.maximumCount = max(1, min(maximumCount, 100))
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
