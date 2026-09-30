import Foundation

/// Only timing and cache-read metadata. A provider call means WidgetKit asked
/// for an entry; it does not prove that the watch face displayed the entry.
public struct WatchWidgetProviderReceipt: Codable, Equatable, Sendable, Identifiable {
    public enum Request: String, Codable, Sendable {
        case timeline, snapshot
    }

    public let id: UUID
    public let requestedAt: Date
    public let request: Request
    public let localDate: String
    public let snapshotUpdatedAt: Date?

    public init(id: UUID = UUID(), requestedAt: Date, request: Request,
                localDate: String, snapshotUpdatedAt: Date?) {
        self.id = id
        self.requestedAt = requestedAt
        self.request = request
        self.localDate = localDate
        self.snapshotUpdatedAt = snapshotUpdatedAt
    }
}

/// The widget is the only writer; the watch app reads on demand for Events and
/// the explicit .txt export. An atomic App Group file avoids UserDefaults
/// cross-process cache ambiguity while testing whether the provider ran.
public struct WatchWidgetProviderReceiptStore: Sendable {
    public static let shared = WatchWidgetProviderReceiptStore()
    public static let capacity = 64
    private static let writeLock = NSLock()
    private let directory: URL?
    private let filename = "watch-widget-provider-receipts.v1.json"

    public init(directory: URL? = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: NhostSessionConfig.appGroupIdentifier
    )) {
        self.directory = directory
    }

    public var isAvailable: Bool { directory != nil }

    public func load() -> [WatchWidgetProviderReceipt] {
        guard let fileURL, let data = try? Data(contentsOf: fileURL),
              let receipts = try? JSONDecoder().decode([WatchWidgetProviderReceipt].self, from: data)
        else { return [] }
        return Array(receipts.suffix(Self.capacity))
    }

    @discardableResult
    public func append(_ receipt: WatchWidgetProviderReceipt) -> Bool {
        Self.writeLock.lock()
        defer { Self.writeLock.unlock() }
        guard let fileURL else { return false }
        do {
            let recent = Array((load() + [receipt]).suffix(Self.capacity))
            try JSONEncoder().encode(recent).write(to: fileURL, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    private var fileURL: URL? { directory?.appendingPathComponent(filename) }
}

/// Limit bursty background reload requests; still write every latest snapshot.
/// Foreground changes and clearing a session bypass the budget. The next
/// eligible Health delivery/background wake can retry a deferred reload.
public struct WatchWidgetReloadGate: Sendable {
    public static let minimumBackgroundInterval: TimeInterval = 15 * 60
    public private(set) var lastRequestedAt: Date?

    public init(lastRequestedAt: Date? = nil) { self.lastRequestedAt = lastRequestedAt }

    public mutating func shouldRequest(at now: Date, foregroundOrUrgent: Bool) -> Bool {
        if !foregroundOrUrgent, let lastRequestedAt,
           now.timeIntervalSince(lastRequestedAt) >= 0,
           now.timeIntervalSince(lastRequestedAt) < Self.minimumBackgroundInterval {
            return false
        }
        lastRequestedAt = now
        return true
    }
}
