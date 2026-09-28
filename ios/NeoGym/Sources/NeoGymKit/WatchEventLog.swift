import Foundation

/// Fixed, non-sensitive diagnostics. Never record account IDs, tokens, response bodies,
/// URLs, user-entered values, or raw error descriptions in the watch event history.
public enum WatchEventAction: String, Codable, Sendable {
    case backgroundScheduling
    case backgroundTask
    case energyRefresh
    case healthPermission
    case healthSync
    case snapshotSave
    case complicationReload

    public var title: String {
        switch self {
        case .backgroundScheduling: "Background refresh request"
        case .backgroundTask: "Background wake"
        case .energyRefresh: "Energy refresh"
        case .healthPermission: "Apple Health permission"
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

public struct WatchEvent: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let occurredAt: Date
    public let action: WatchEventAction
    public let outcome: WatchEventOutcome
    public let trigger: WatchEventTrigger?
    /// Numeric system error codes only; no raw descriptions or domains are persisted.
    public let errorCode: Int?

    public init(
        action: WatchEventAction, outcome: WatchEventOutcome,
        trigger: WatchEventTrigger? = nil, errorCode: Int? = nil,
        occurredAt: Date = Date(), id: UUID = UUID()
    ) {
        self.id = id
        self.occurredAt = occurredAt
        self.action = action
        self.outcome = outcome
        self.trigger = trigger
        self.errorCode = errorCode
    }
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
