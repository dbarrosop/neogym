import Foundation

public enum EnergyBalanceWidgetConstants {
    public static let appGroupIdentifier = NhostSessionConfig.appGroupIdentifier
    public static let widgetKind = "EnergyBalanceWidget"
    public static let snapshotDefaultsKey = "energyBalanceWidgetSnapshot.v2"
    /// Pre-redesign preformatted string snapshots. Never read; removed on save and clear.
    public static let legacySnapshotDefaultsKeys = ["energyBalanceWidgetSnapshot.v1"]
}

/// Token-free aggregate numbers for one local date. The widget formats them with
/// `EnergyBalanceDisplay` at each timeline entry's date, so a snapshot carried past
/// local midnight is labelled with its own day instead of "today so far".
public struct EnergyBalanceWidgetSnapshot: Codable, Equatable, Sendable {
    public static let currentSchemaVersion = 2

    public let schemaVersion: Int
    public let localDate: String
    public let userMarker: String?
    public let generatedAt: Date
    public let consumedKcal: Double
    /// Nil when the date has no `daily_energy` row: unknown, not zero.
    public let burnedKcal: Double?
    public let activeKcal: Double?
    public let restingKcal: Double?
    public let sevenDayAverageNet: Double?
    /// The selected nutrition plan's kcal for this date, when the day has one.
    public let planKcal: Double?
    public let estimatedBurnedKcal: Double?
    public let estimatedNetKcal: Double?

    public init(
        localDate: String,
        userMarker: String?,
        generatedAt: Date,
        consumedKcal: Double,
        burnedKcal: Double?,
        activeKcal: Double? = nil,
        restingKcal: Double? = nil,
        sevenDayAverageNet: Double? = nil,
        planKcal: Double? = nil,
        estimatedBurnedKcal: Double? = nil,
        estimatedNetKcal: Double? = nil
    ) {
        schemaVersion = Self.currentSchemaVersion
        self.localDate = localDate
        self.userMarker = userMarker
        self.generatedAt = generatedAt
        self.consumedKcal = consumedKcal
        self.burnedKcal = burnedKcal
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
        self.sevenDayAverageNet = sevenDayAverageNet
        self.planKcal = planKcal
        self.estimatedBurnedKcal = estimatedBurnedKcal
        self.estimatedNetKcal = estimatedNetKcal
    }

    public init(summary: EnergyBalanceOverviewSummary, userMarker: String?, generatedAt: Date) {
        self.init(
            localDate: summary.date,
            userMarker: userMarker,
            generatedAt: generatedAt,
            consumedKcal: summary.caloriesIn,
            burnedKcal: summary.caloriesOut,
            activeKcal: summary.activeKcal,
            restingKcal: summary.restingKcal,
            sevenDayAverageNet: summary.sevenDayAverageNet,
            planKcal: summary.planKcal,
            estimatedBurnedKcal: summary.projection?.estimatedBurnedKcal,
            estimatedNetKcal: summary.projection?.estimatedNetKcal
        )
    }

    public var netKcal: Double? { burnedKcal.map { consumedKcal - $0 } }

    public var displayInput: EnergyBalanceDisplayInput {
        EnergyBalanceDisplayInput(
            localDate: localDate, updatedAt: generatedAt, consumedKcal: consumedKcal,
            burnedKcal: burnedKcal, activeKcal: activeKcal, restingKcal: restingKcal,
            sevenDayAverageNet: sevenDayAverageNet, planKcal: planKcal,
            estimatedBurnedKcal: estimatedBurnedKcal, estimatedNetKcal: estimatedNetKcal
        )
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
        guard let data = userDefaults?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(EnergyBalanceWidgetSnapshot.self, from: data),
              snapshot.schemaVersion == EnergyBalanceWidgetSnapshot.currentSchemaVersion
        else { return nil }
        return snapshot
    }

    @discardableResult
    public func save(_ snapshot: EnergyBalanceWidgetSnapshot) -> Bool {
        guard let userDefaults else { return false }

        if let existing = load(), existing.userMarker != snapshot.userMarker {
            clear()
        }

        guard let data = try? JSONEncoder().encode(snapshot) else { return false }
        removeLegacySnapshots(from: userDefaults)
        userDefaults.set(data, forKey: key)
        return true
    }

    @discardableResult
    public func clear() -> Bool {
        guard let userDefaults else { return false }
        userDefaults.removeObject(forKey: key)
        removeLegacySnapshots(from: userDefaults)
        return true
    }

    private func removeLegacySnapshots(from defaults: UserDefaults) {
        for legacyKey in EnergyBalanceWidgetConstants.legacySnapshotDefaultsKeys where legacyKey != key {
            defaults.removeObject(forKey: legacyKey)
        }
    }

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }
}
