import Foundation

/// Only the watch app writes these token-free values. The complication never opens an auth session.
public struct WatchEnergySnapshot: Codable, Equatable, Sendable {
    public let userID: String
    public let localDate: String
    public let consumedKcal: Double
    public let burnedKcal: Double?
    public let activeKcal: Double?
    public let restingKcal: Double?
    public let updatedAt: Date

    /// Calories in minus calories out. A missing energy row is unknown, not zero.
    public var netKcal: Double? { burnedKcal.map { consumedKcal - $0 } }

    public init(
        userID: String, localDate: String, consumedKcal: Double, burnedKcal: Double?,
        activeKcal: Double? = nil, restingKcal: Double? = nil, updatedAt: Date
    ) {
        self.userID = userID
        self.localDate = localDate
        self.consumedKcal = consumedKcal
        self.burnedKcal = burnedKcal
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
        self.updatedAt = updatedAt
    }
}

/// A transient read failure can retain only today's snapshot for the currently
/// known session owner. A blocking/terminal account state must clear it.
public enum WatchEnergySnapshotPolicy {
    public static func keepsStoredSnapshot(
        in state: WatchAccountState, snapshotUserID: String?, sessionUserID: String?
    ) -> Bool {
        switch state {
        case .awaitingLocalContext, .loading:
            // During bootstrap the SDK may not have restored a session yet.
            return sessionUserID == nil || snapshotUserID == sessionUserID
        case .networkError:
            return sessionUserID != nil && snapshotUserID == sessionUserID
        default:
            return false
        }
    }
}

public struct WatchEnergySnapshotStore: Sendable {
    public static let shared = WatchEnergySnapshotStore()
    public static let widgetKind = "WatchEnergyComplication"
    private let suite: String
    private let key = "watchEnergySnapshot.v1"

    public init(suite: String = NhostSessionConfig.appGroupIdentifier) { self.suite = suite }

    public func load(for date: String) -> WatchEnergySnapshot? {
        guard let data = UserDefaults(suiteName: suite)?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(WatchEnergySnapshot.self, from: data),
              snapshot.localDate == date else { return nil }
        return snapshot
    }

    @discardableResult
    public func save(_ snapshot: WatchEnergySnapshot) -> Bool {
        guard let defaults = UserDefaults(suiteName: suite),
              let data = try? JSONEncoder().encode(snapshot) else { return false }
        defaults.set(data, forKey: key)
        return true
    }

    public func clear() { UserDefaults(suiteName: suite)?.removeObject(forKey: key) }
}

/// Synchronizes only the last seven local days, never overwriting manual or edited energy rows.
/// An absent/zero HealthKit metric is not written as a fabricated zero. The response is always
/// fetched from the backend after writes so intake and expenditure share one source of truth.
public struct WatchEnergyService: Sendable {
    private let graphQL: any GraphQLServicing
    private let energy: any DailyEnergyRepositoryProtocol
    private let importer: any DailyEnergyHealthImporting
    private let calendar: Calendar

    public init(graphQL: any GraphQLServicing, energy: any DailyEnergyRepositoryProtocol,
                importer: any DailyEnergyHealthImporting, calendar: Calendar = .current) {
        self.graphQL = graphQL
        self.energy = energy
        self.importer = importer
        self.calendar = calendar
    }

    public func refresh(userID: String, syncHealth: Bool, now: Date = Date()) async throws -> WatchEnergySnapshot {
        let today = DateOnly.formatLocalISO(now, calendar: calendar)
        if syncHealth { try await sync(today: now) }
        try Task.checkCancellation()
        let data: WatchTodayData = try await graphQL.execute(
            query: Self.todayQuery,
            variables: ["date": GraphQLScalars.date(today)],
            operationName: "WatchTodayEnergy"
        )
        let consumed = data.nutritionDays.first?.calories ?? 0
        let energyEntry = data.dailyEnergyEntries.first
        let burned = energyEntry.map { ($0.activeKcal ?? 0) + ($0.restingKcal ?? 0) }
        return WatchEnergySnapshot(
            userID: userID, localDate: today, consumedKcal: consumed, burnedKcal: burned,
            activeKcal: energyEntry?.activeKcal, restingKcal: energyEntry?.restingKcal, updatedAt: now
        )
    }

    private func sync(today: Date) async throws {
        let start = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: today)) ?? today
        let since = DateOnly.formatLocalISO(start, calendar: calendar)
        async let samples = importer.dailyEnergyEntries()
        async let rows = energy.listEntriesForHealthRefresh(since: since)
        let imported = try await samples
        let existing = Dictionary(uniqueKeysWithValues: try await rows.map { ($0.energyOn, $0) })
        let todayString = DateOnly.formatLocalISO(today, calendar: calendar)
        for sample in imported where sample.energyOn >= since && sample.energyOn <= todayString {
            try Task.checkCancellation()
            guard let values = sample.formValues(notes: "Imported from Apple Health") else { continue }
            if let row = existing[sample.energyOn] {
                guard row.notes == "Imported from Apple Health" else { continue }
                // Avoid needless mutation/reload for unchanged statistics.
                guard row.activeKcal != Double(values.activeKcal) || row.restingKcal != Double(values.restingKcal) else {
                    continue
                }
                try await energy.updateEntry(id: row.id, values: values)
            } else {
                do {
                    _ = try await energy.createEntry(values)
                } catch where DailyEnergyErrorMapper.isDuplicateEnergyOnError(error) {
                    // Another writer (including the phone) won the unique date race.
                }
            }
        }
    }

    public static let todayQuery = """
    query WatchTodayEnergy($date: date!) {
      nutritionDays(where: { logDate: { _eq: $date } }, limit: 1) {
        logDate
        nutritionLogEntries(where: { nutritionLogMealId: { _is_null: true } }) {
          grams
          snapshotKcalPer100g
        }
        nutritionLogMeals {
          nutritionLogEntries { grams snapshotKcalPer100g }
        }
      }
      dailyEnergyEntries(where: { energyOn: { _eq: $date } }, limit: 1) {
        id
        energyOn
        activeKcal
        restingKcal
      }
    }
    """
}

private struct WatchTodayData: Decodable, Sendable {
    let nutritionDays: [NutritionCalorieHistoryDay]
    let dailyEnergyEntries: [DailyEnergy]
}
