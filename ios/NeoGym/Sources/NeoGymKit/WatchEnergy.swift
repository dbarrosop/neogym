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

    /// Ignore the fetch timestamp when deciding whether the widget's values
    /// changed; an unchanged read does not need another WidgetKit reload.
    public func hasSameDisplayValues(as other: Self) -> Bool {
        userID == other.userID && localDate == other.localDate
            && consumedKcal == other.consumedKcal && burnedKcal == other.burnedKcal
            && activeKcal == other.activeKcal && restingKcal == other.restingKcal
    }

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

public struct WatchEnergySnapshotSaveResult: Equatable, Sendable {
    public let saved: Bool
    public let displayValuesChanged: Bool

    public init(saved: Bool, displayValuesChanged: Bool) {
        self.saved = saved
        self.displayValuesChanged = displayValuesChanged
    }
}

/// Bootstrap may retain today's snapshot until the session owner is known.
/// Once signed in, the watch keeps a same-owner snapshot via the `.name` path;
/// blocking/terminal states clear it.
public enum WatchEnergySnapshotPolicy {
    public static func keepsStoredSnapshot(
        in state: WatchAccountState, snapshotUserID: String?, sessionUserID: String?
    ) -> Bool {
        switch state {
        case .awaitingLocalContext, .loading:
            // During bootstrap the SDK may not have restored a session yet.
            return sessionUserID == nil || snapshotUserID == sessionUserID
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
        saveReportingDisplayChange(snapshot).saved
    }

    public func saveReportingDisplayChange(_ snapshot: WatchEnergySnapshot) -> WatchEnergySnapshotSaveResult {
        let previous = load(for: snapshot.localDate)
        guard let defaults = UserDefaults(suiteName: suite),
              let data = try? JSONEncoder().encode(snapshot) else {
            return .init(saved: false, displayValuesChanged: false)
        }
        defaults.set(data, forKey: key)
        // Only confirm a local suite read-back. WidgetKit may still defer a
        // timeline reload or be unable to read the shared container.
        let saved = defaults.data(forKey: key) == data
        return .init(saved: saved,
                     displayValuesChanged: saved && previous?.hasSameDisplayValues(as: snapshot) != true)
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

    /// Kept separate from the fresh backend read so callers can report HealthKit
    /// reconciliation failures without mistaking a later GraphQL failure for one.
    public func syncHealth(now: Date = Date()) async throws {
        try await sync(today: now)
    }

    public func refresh(userID: String, syncHealth: Bool, now: Date = Date()) async throws -> WatchEnergySnapshot {
        let today = DateOnly.formatLocalISO(now, calendar: calendar)
        if syncHealth { try await self.syncHealth(now: now) }
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
        let imported: [HealthDailyEnergy]
        do {
            imported = try await samples
        } catch {
            if error is CancellationError { throw error }
            if let failure = error as? WatchHealthSyncFailure { throw failure }
            throw WatchHealthSyncFailure(stage: .healthRead, cause: error)
        }
        let backendRows: [DailyEnergy]
        do {
            backendRows = try await rows
        } catch {
            if error is CancellationError { throw error }
            throw WatchHealthSyncFailure(stage: .backendRead, cause: error,
                                         backendOperation: .healthReconciliationRead)
        }
        let existing = Dictionary(uniqueKeysWithValues: backendRows.map { ($0.energyOn, $0) })
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
                do {
                    try await energy.updateEntry(id: row.id, values: values)
                } catch {
                    if error is CancellationError { throw error }
                    throw WatchHealthSyncFailure(stage: .backendWrite, cause: error,
                                                 backendOperation: .updateEnergy)
                }
            } else {
                do {
                    _ = try await energy.createEntry(values)
                } catch where DailyEnergyErrorMapper.isDuplicateEnergyOnError(error) {
                    // Another writer (including the phone) won the unique date race.
                } catch {
                    if error is CancellationError { throw error }
                    throw WatchHealthSyncFailure(stage: .backendWrite, cause: error,
                                                 backendOperation: .createEnergy)
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
