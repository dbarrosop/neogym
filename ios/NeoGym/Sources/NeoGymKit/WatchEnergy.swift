import Foundation

/// Only the watch app writes these token-free values. The complication never opens an auth session.
public enum WatchEnergyRowSource: String, Codable, Sendable {
    case missing, imported, manual
}

public struct WatchEnergySnapshot: Codable, Equatable, Sendable {
    public let userID: String
    public let localDate: String
    public let consumedKcal: Double
    public let burnedKcal: Double?
    public let activeKcal: Double?
    public let restingKcal: Double?
    public let updatedAt: Date
    /// Nil for older snapshots: never overlay HealthKit without a known server row policy.
    public let rowSource: WatchEnergyRowSource?
    /// A locally read estimate awaiting authoritative backend reconciliation.
    public let pendingBackend: Bool?
    /// Optional for backwards-compatible snapshots. The complication ignores this baseline.
    public let restingBaseline: DailyRestingEnergyBaseline?
    /// Today's selected nutrition plan kcal, for the circular complication's ring.
    public let planKcal: Double?
    /// The phone's 7-day net rule from the last backend read (watch app only).
    public let sevenDayAverageNet: Double?

    public var projection: DailyEnergyProjection? {
        guard burnedKcal != nil, let restingBaseline else { return nil }
        return DailyEnergyProjection(caloriesIn: consumedKcal, activeKcal: activeKcal,
                                     restingKcal: restingKcal, baseline: restingBaseline)
    }

    /// Calories in minus calories out. A missing energy row is unknown, not zero.
    public var netKcal: Double? { burnedKcal.map { consumedKcal - $0 } }

    public var displayInput: EnergyBalanceDisplayInput {
        let projection = projection
        return EnergyBalanceDisplayInput(
            localDate: localDate, updatedAt: updatedAt, consumedKcal: consumedKcal,
            burnedKcal: burnedKcal, activeKcal: activeKcal, restingKcal: restingKcal,
            sevenDayAverageNet: sevenDayAverageNet, planKcal: planKcal,
            estimatedBurnedKcal: projection?.estimatedBurnedKcal,
            estimatedNetKcal: projection?.estimatedNetKcal
        )
    }

    /// Ignore the fetch timestamp when deciding whether the widget's values
    /// changed; an unchanged read does not need another WidgetKit reload.
    public func hasSameDisplayValues(as other: Self) -> Bool {
        userID == other.userID && localDate == other.localDate
            && consumedKcal == other.consumedKcal && burnedKcal == other.burnedKcal
            && activeKcal == other.activeKcal && restingKcal == other.restingKcal
            && pendingBackend == other.pendingBackend && planKcal == other.planKcal
    }

    public init(
        userID: String, localDate: String, consumedKcal: Double, burnedKcal: Double?,
        activeKcal: Double? = nil, restingKcal: Double? = nil, updatedAt: Date,
        rowSource: WatchEnergyRowSource? = nil, pendingBackend: Bool? = nil,
        restingBaseline: DailyRestingEnergyBaseline? = nil, planKcal: Double? = nil,
        sevenDayAverageNet: Double? = nil
    ) {
        self.userID = userID
        self.localDate = localDate
        self.consumedKcal = consumedKcal
        self.burnedKcal = burnedKcal
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
        self.updatedAt = updatedAt
        self.rowSource = rowSource
        self.pendingBackend = pendingBackend
        self.restingBaseline = restingBaseline
        self.planKcal = planKcal
        self.sevenDayAverageNet = sevenDayAverageNet
    }
}

/// Optimistic display only for a known imported/missing server row. A manual
/// row (or old snapshot with unknown provenance) always keeps server values.
public enum WatchLocalEnergyPolicy {
    public static func estimate(
        from snapshot: WatchEnergySnapshot?, imported: [HealthDailyEnergy],
        ownerID: String, today: String, now: Date
    ) -> WatchEnergySnapshot? {
        guard let snapshot, snapshot.userID == ownerID, snapshot.localDate == today,
              snapshot.rowSource == .missing || snapshot.rowSource == .imported,
              let day = imported.first(where: { $0.energyOn == today }),
              let form = day.formValues() else { return nil }
        let active = Double(form.activeKcal)
        let resting = Double(form.restingKcal)
        return WatchEnergySnapshot(
            userID: ownerID, localDate: today, consumedKcal: snapshot.consumedKcal,
            burnedKcal: (active ?? 0) + (resting ?? 0), activeKcal: active,
            restingKcal: resting, updatedAt: now, rowSource: snapshot.rowSource,
            pendingBackend: true, restingBaseline: snapshot.restingBaseline,
            planKcal: snapshot.planKcal, sevenDayAverageNet: snapshot.sevenDayAverageNet
        )
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
        guard let snapshot = loadLatest(), snapshot.localDate == date else { return nil }
        return snapshot
    }

    /// Any day's snapshot. Sign-out and blocking states clear it, so its presence
    /// is what lets the complication tell "connected" from "not connected".
    public func loadLatest() -> WatchEnergySnapshot? {
        guard let data = UserDefaults(suiteName: suite)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WatchEnergySnapshot.self, from: data)
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
    public func syncHealth(now: Date = Date(), onStage: WatchEnergyStageReporter? = nil) async throws {
        try await sync(today: now, onStage: onStage)
    }

    public func refresh(userID: String, syncHealth: Bool, now: Date = Date(),
                        onStage: WatchEnergyStageReporter? = nil) async throws -> WatchEnergySnapshot {
        let today = DateOnly.formatLocalISO(now, calendar: calendar)
        if syncHealth { try await self.syncHealth(now: now, onStage: onStage) }
        try Task.checkCancellation()
        let data: WatchTodayData = try await WatchEnergyStageTrace(onStage).run(
            .backendRead, operation: .todayEnergyRead
        ) {
            try await graphQL.execute(
                query: Self.todayQuery,
                variables: [
                    "date": GraphQLScalars.date(today),
                    "since": GraphQLScalars.date(IntakeGrouping.addLocalDateDays(today, days: -7, calendar: calendar))
                ],
                operationName: "WatchTodayEnergy"
            )
        }
        var intakeByDate: [String: Double] = [:]
        for day in data.nutritionDays { intakeByDate[day.logDate] = day.calories }
        let energyByDate = Dictionary(data.dailyEnergyEntries.map { ($0.energyOn, $0) },
                                      uniquingKeysWith: { first, _ in first })
        let consumed = intakeByDate[today] ?? 0
        let energyEntry = energyByDate[today]
        let burned = energyEntry.map { ($0.activeKcal ?? 0) + ($0.restingKcal ?? 0) }
        let average = RollingCalorieNetAverage(endingOn: today, intakeByDate: intakeByDate,
                                               energyByDate: energyByDate, calendar: calendar)
        let plan = data.todayPlan?.first { $0.logDate == today }?.nutritionPlan
        return WatchEnergySnapshot(
            userID: userID, localDate: today, consumedKcal: consumed, burnedKcal: burned,
            activeKcal: energyEntry?.activeKcal, restingKcal: energyEntry?.restingKcal, updatedAt: now,
            rowSource: energyEntry.map { $0.notes == "Imported from Apple Health" ? .imported : .manual }
                ?? .missing, pendingBackend: false,
            restingBaseline: DailyRestingEnergyBaseline(today: today, history: data.dailyEnergyEntries, calendar: calendar),
            planKcal: plan?.macroTotals.kcal, sevenDayAverageNet: average?.averageNet
        )
    }

    private func sync(today: Date, onStage: WatchEnergyStageReporter?) async throws {
        let start = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: today)) ?? today
        let since = DateOnly.formatLocalISO(start, calendar: calendar)
        let trace = WatchEnergyStageTrace(onStage)
        async let samples = trace.run(.healthRead) {
            if let reporting = importer as? any WatchEnergyHealthStageReporting {
                return try await reporting.dailyEnergyEntries(report: onStage)
            }
            return try await importer.dailyEnergyEntries()
        }
        async let rows = trace.run(.backendRead, operation: .healthReconciliationRead) {
            try await energy.listEntriesForHealthRefresh(since: since)
        }
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
                    try await trace.run(.backendWrite, operation: .updateEnergy) {
                        try await energy.updateEntry(id: row.id, values: values)
                    }
                } catch {
                    if error is CancellationError { throw error }
                    throw WatchHealthSyncFailure(stage: .backendWrite, cause: error,
                                                 backendOperation: .updateEnergy)
                }
            } else {
                do {
                    try await trace.run(.backendWrite, operation: .createEnergy) {
                        do {
                            _ = try await energy.createEntry(values)
                        } catch where DailyEnergyErrorMapper.isDuplicateEnergyOnError(error) {
                            // Another writer (including the phone) won the unique date race.
                        }
                    }
                } catch {
                    if error is CancellationError { throw error }
                    throw WatchHealthSyncFailure(stage: .backendWrite, cause: error,
                                                 backendOperation: .createEnergy)
                }
            }
        }
    }

    /// Intake and energy for the previous seven dates feed the resting baseline and
    /// the 7-day net average; only today's selected plan is read, for its kcal.
    public static let todayQuery = """
    query WatchTodayEnergy($date: date!, $since: date!) {
      nutritionDays(where: { logDate: { _gte: $since, _lte: $date } }, order_by: { logDate: desc }) {
        logDate
        nutritionLogEntries(where: { nutritionLogMealId: { _is_null: true } }) {
          grams
          snapshotKcalPer100g
        }
        nutritionLogMeals {
          nutritionLogEntries { grams snapshotKcalPer100g }
        }
      }
      todayPlan: nutritionDays(where: { logDate: { _eq: $date } }, limit: 1) {
        logDate
        nutritionPlan {
          id
          name
          description
          nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
            id
            slotTime
            label
            position
            mealId
            meal {
              id
              name
              description
              mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
                id
                foodId
                grams
                position
                food { \(planFoodFields) }
              }
            }
          }
          nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
            id
            slotTime
            label
            position
            foodId
            grams
            food { \(planFoodFields) }
          }
        }
      }
      dailyEnergyEntries(where: { energyOn: { _gte: $since, _lte: $date } }, order_by: { energyOn: desc }) {
        id
        energyOn
        activeKcal
        restingKcal
        notes
      }
    }
    """

    private static let planFoodFields = """
    id name userId isPublic kcalPer100g fatPer100g carbsPer100g proteinPer100g fiberPer100g sugarPer100g
    """
}

private struct WatchTodayData: Decodable, Sendable {
    let nutritionDays: [NutritionCalorieHistoryDay]
    /// Optional so a response without the plan root still renders intake and energy.
    let todayPlan: [WatchPlanDay]?
    let dailyEnergyEntries: [DailyEnergy]
}

private struct WatchPlanDay: Decodable, Sendable {
    let logDate: String
    let nutritionPlan: NutritionPlan?
}
