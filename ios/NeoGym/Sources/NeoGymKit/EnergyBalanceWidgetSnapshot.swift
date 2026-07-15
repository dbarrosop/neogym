import Foundation

public enum EnergyBalanceWidgetConstants {
    public static let appGroupIdentifier = NhostSessionConfig.appGroupIdentifier
    public static let widgetKind = "EnergyBalanceWidget"
    public static let snapshotDefaultsKey = "energyBalanceWidgetSnapshot.v1"
}

public struct EnergyBalanceWidgetSnapshot: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let localDate: String
    public let userMarker: String?
    public let generatedAtISO8601: String
    public let generatedAtText: String
    public let lastSyncedText: String
    public let consumedValue: String
    public let consumedCaption: String
    public let burnedValue: String
    public let burnedCaption: String
    public let netValue: String
    public let netCaption: String
    public let netState: String?
    public let sevenDayValue: String
    public let sevenDayCaption: String
    public let sevenDayState: String?
    public let emptyTitle: String
    public let emptyMessage: String

    public init(
        schemaVersion: Int = 1,
        localDate: String,
        userMarker: String?,
        generatedAtISO8601: String,
        generatedAtText: String,
        lastSyncedText: String,
        consumedValue: String,
        consumedCaption: String,
        burnedValue: String,
        burnedCaption: String,
        netValue: String,
        netCaption: String,
        netState: String?,
        sevenDayValue: String,
        sevenDayCaption: String,
        sevenDayState: String?,
        emptyTitle: String = "Open NeoGym to sync",
        emptyMessage: String = "Load the Nutrition overview to refresh your energy balance."
    ) {
        self.schemaVersion = schemaVersion
        self.localDate = localDate
        self.userMarker = userMarker
        self.generatedAtISO8601 = generatedAtISO8601
        self.generatedAtText = generatedAtText
        self.lastSyncedText = lastSyncedText
        self.consumedValue = consumedValue
        self.consumedCaption = consumedCaption
        self.burnedValue = burnedValue
        self.burnedCaption = burnedCaption
        self.netValue = netValue
        self.netCaption = netCaption
        self.netState = netState
        self.sevenDayValue = sevenDayValue
        self.sevenDayCaption = sevenDayCaption
        self.sevenDayState = sevenDayState
        self.emptyTitle = emptyTitle
        self.emptyMessage = emptyMessage
    }

    public init(
        summary: EnergyBalanceOverviewSummary,
        userMarker: String?,
        generatedAt: Date,
        locale: Locale = .current
    ) {
        self.init(
            localDate: summary.date,
            userMarker: userMarker,
            generatedAtISO8601: Self.iso8601String(generatedAt),
            generatedAtText: Self.formattedGeneratedAt(generatedAt, locale: locale),
            lastSyncedText: Self.formattedLastSyncedText(generatedAt, locale: locale),
            consumedValue: summary.consumedValue,
            consumedCaption: summary.consumedCaption,
            burnedValue: summary.burnedValue,
            burnedCaption: summary.burnedCaption,
            netValue: summary.netTodayValue,
            netCaption: summary.netTodayCaption,
            netState: summary.net.map { _ in Self.widgetBalanceState(summary.netState) },
            sevenDayValue: summary.sevenDayAverageValue,
            sevenDayCaption: summary.sevenDayAverageCaption,
            sevenDayState: summary.sevenDayAverageState.map(Self.widgetBalanceState)
        )
    }

    public static func formattedGeneratedAt(_ date: Date, locale: Locale = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    public static func formattedLastSyncedText(_ date: Date, locale: Locale = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return "Last synced \(formatter.string(from: date))"
    }

    public static func iso8601String(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    private static func widgetBalanceState(_ state: DailyCalorieBalanceState) -> String {
        switch state {
        case .deficit: "deficit"
        case .surplus: "surplus"
        case .balanced: "balanced"
        case .intakeOnly: "unavailable"
        }
    }
}

public struct EnergyBalanceWidgetSnapshotStore: Sendable {
    public static let shared = EnergyBalanceWidgetSnapshotStore()

    private let suiteName: String
    private let key: String

    public init(
        suiteName: String = EnergyBalanceWidgetConstants.appGroupIdentifier,
        key: String = EnergyBalanceWidgetConstants.snapshotDefaultsKey
    ) {
        self.suiteName = suiteName
        self.key = key
    }

    public func load() -> EnergyBalanceWidgetSnapshot? {
        guard let data = userDefaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(EnergyBalanceWidgetSnapshot.self, from: data)
    }

    @discardableResult
    public func save(_ snapshot: EnergyBalanceWidgetSnapshot) -> Bool {
        guard let userDefaults else { return false }

        if let existing = load(), existing.userMarker != snapshot.userMarker {
            clear()
        }

        guard let data = try? JSONEncoder().encode(snapshot) else { return false }
        userDefaults.set(data, forKey: key)
        return true
    }

    @discardableResult
    public func clear() -> Bool {
        guard let userDefaults else { return false }
        userDefaults.removeObject(forKey: key)
        return true
    }

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }
}
