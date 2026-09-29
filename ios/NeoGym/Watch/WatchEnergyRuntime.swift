import Combine
import Foundation
import HealthKit
import NeoGymKit
import SwiftUI
import WatchKit
import WidgetKit

@MainActor
final class WatchEnergyRuntime: ObservableObject {
    @Published private(set) var snapshot: WatchEnergySnapshot?
    @Published private(set) var errorMessage: String?
    @Published private(set) var isRefreshing = false
    @Published private(set) var healthEnabled = false
    @Published private(set) var contextReady = false
    @Published private(set) var events: [WatchEvent] = []

    let account: WatchAccountModel
    let connectivity = WatchAccountConnectivity()
    let health = WatchHealthEnergy()
    private let service: WatchEnergyService
    private let store = WatchEnergySnapshotStore.shared
    private let eventStore = WatchEventStore()
    private let pendingHealth = WatchPendingHealthSyncStore()
    private var refreshSchedule = WatchRefreshSchedule()
    private var refreshTask: Task<Void, Never>?
    private var activeRefreshID: UUID?
    private var refreshStartedAt: Date?
    private var refreshingUserID: String?
    private var refreshingWithHealth = false
    private var refreshingPendingGeneration: UUID?
    private var observedUserID: String?
    private var bootstrapTask: Task<Void, Never>?
    private var bootstrapped = false
    private var accountSubscription: AnyCancellable?
    private let authorizationKey = "watchHealthEnergyAuthorizedUser.v1"

    init() {
        let client = NhostClientFactory.makeProductionWatchClient()
        account = WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: NhostCurrentUserService(client: client),
            currentUserStore: WatchCurrentUserStore()
        )
        let graphQL = NhostGraphQLService(client: client)
        service = WatchEnergyService(graphQL: graphQL, energy: DailyEnergyRepository(graphQL: graphQL),
                                     importer: health)
        events = eventStore.load()
        accountSubscription = account.$state.sink { [weak self] state in
            // @Published emits before account.state changes; use the emitted state.
            MainActor.assumeIsolated { self?.accountChanged(state) }
        }
    }

    func bootstrap() async {
        if bootstrapped { return }
        if let bootstrapTask { await bootstrapTask.value; return }
        let task = Task { [self] in
            connectivity.onContext = { [weak self] in self?.account.receiveContext($0) }
            // Restore the local Keychain session and render its cached profile/energy
            // without waiting for WCSession activation or a network name read.
            account.localContextReady(connectivity.currentContext())
            let activation = Task { [self] in
                account.localContextReady(await connectivity.activate())
            }
            await account.bootstrap()
            await activation.value
            contextReady = true
            if case .name = account.state, !account.isReadingProfile,
               account.profileError == nil { Task { await refresh() } }
            await account.waitForCurrentRead()
        }
        bootstrapTask = task
        await task.value
        bootstrapped = true
        bootstrapTask = nil
    }

    func accountChanged(_ state: WatchAccountState) {
        guard case .name = state, let user = account.currentUser else {
            snapshot = nil
            healthEnabled = false
            errorMessage = nil
            // Signed-in reads (including failures) stay on the `.name` path above,
            // which retains today's same-owner snapshot. Blocking states clear it.
            let savedUserID = store.load(for: DateOnly.todayLocalISO())?.userID
            let sessionUserID = account.authStore.state.session?.user?.id
            if !WatchEnergySnapshotPolicy.keepsStoredSnapshot(
                in: state, snapshotUserID: savedUserID, sessionUserID: sessionUserID
            ) {
                health.stopObserving()
                observedUserID = nil
                pendingHealth.clear()
                store.clear()
                requestComplicationReload()
            }
            return
        }
        if observedUserID != nil, observedUserID != user.id {
            health.stopObserving()
            observedUserID = nil
        }
        pendingHealth.clearIfDifferentOwner(user.id)
        let date = DateOnly.todayLocalISO()
        let saved = store.load(for: date)
        if let saved, saved.userID != user.id {
            store.clear()
            requestComplicationReload()
        }
        snapshot = saved.flatMap { $0.userID == user.id ? $0 : nil }
        healthEnabled = UserDefaults.standard.string(forKey: authorizationKey) == user.id
        if healthEnabled { startObservers(for: user.id) }
        scheduleRefresh(pending: healthEnabled && pendingHealth.pending(for: user.id) != nil)
        if contextReady, !account.isReadingProfile, account.profileError == nil {
            Task { await refresh() }
        }
    }

    func enableHealth() async {
        guard contextReady, !account.isReadingProfile, account.profileError == nil,
              case .name = account.state, let id = account.currentUser?.id else { return }
        do {
            try await health.authorize()
            guard account.currentUser?.id == id, case .name = account.state else { return }
            record(.healthPermission, .succeeded)
            UserDefaults.standard.set(id, forKey: authorizationKey)
            healthEnabled = true
            startObservers(for: id)
            await refresh(trigger: .healthAuthorization)
        } catch {
            recordFailure(.healthPermission, error: error, stage: .authorization)
            errorMessage = error.localizedDescription
        }
    }

    func refresh(trigger: WatchEventTrigger = .automatic, attemptID: UUID? = nil) async {
        if trigger == .manual { await revalidateAccountIfNeeded() }
        if Task.isCancelled {
            record(.energyRefresh, .skipped, trigger: trigger, attemptID: attemptID, skipReason: .cancelled)
            return
        }
        guard contextReady, !account.isReadingProfile, account.profileError == nil,
              case .name = account.state, let user = account.currentUser else {
            if trigger == .manual {
                record(.energyRefresh, .skipped, trigger: trigger, attemptID: attemptID,
                       skipReason: account.profileError == nil ? .accountUnavailable : .accountValidationFailed)
            }
            return
        }
        abandonStaleRefresh()
        if let refreshTask {
            await joinRefresh(refreshTask, trigger: trigger, attemptID: attemptID)
            return
        }
        let id = user.id
        let runID = attemptID ?? UUID()
        let syncHealth = healthEnabled
        let pending = syncHealth ? pendingHealth.pending(for: id) : nil
        let now = Date()
        let started = ProcessInfo.processInfo.systemUptime
        activeRefreshID = runID
        refreshStartedAt = now
        refreshingUserID = id
        refreshingWithHealth = syncHealth
        refreshingPendingGeneration = pending?.generation
        let pendingAge = pending.map { max(0, Int(now.timeIntervalSince($0.firstObservedAt).rounded(.up))) }
        record(.energyRefresh, .started, trigger: trigger, attemptID: runID,
               pendingWallSeconds: pendingAge)
        let task = Task { [self] in
            isRefreshing = true
            defer {
                // A resumed stale task must not reset a newer refresh's state.
                if activeRefreshID == runID {
                    isRefreshing = false
                    refreshTask = nil
                    activeRefreshID = nil
                    refreshStartedAt = nil
                    refreshingUserID = nil
                    refreshingWithHealth = false
                    refreshingPendingGeneration = nil
                }
            }
            var syncError: String?
            if syncHealth {
                let healthStarted = ProcessInfo.processInfo.systemUptime
                do {
                    try await service.syncHealth(now: now)
                    record(.healthSync, .succeeded, trigger: trigger, attemptID: runID,
                           durationSeconds: elapsed(since: healthStarted))
                } catch {
                    if Task.isCancelled || error is CancellationError {
                        record(.energyRefresh, .skipped, trigger: trigger, attemptID: runID,
                               skipReason: .cancelled, durationSeconds: elapsed(since: started))
                        return
                    }
                    recordFailure(.healthSync, trigger: trigger, error: error, stage: .healthRead,
                                  attemptID: runID, durationSeconds: elapsed(since: healthStarted))
                    if let failure = error as? WatchHealthSyncFailure,
                       failure.stage == .backendRead || failure.stage == .backendWrite
                        || failure.diagnosticSource == .transport || failure.diagnosticSource == .network {
                        scheduleRefresh(retry: true)
                    }
                    syncError = "Apple Health sync failed: \(error.localizedDescription)"
                }
            }
            do {
                // Still read the backend after a Health failure; this is a separate outcome.
                let result = try await service.refresh(userID: id, syncHealth: false, now: now)
                guard case .name = account.state, account.currentUser?.id == id else {
                    record(.energyRefresh, .skipped, trigger: trigger, attemptID: runID,
                           skipReason: .accountChanged, durationSeconds: elapsed(since: started))
                    return
                }
                try Task.checkCancellation()
                finishRefresh(result, userID: id, pending: pending, syncError: syncError,
                              trigger: trigger, attemptID: runID, started: started)
            } catch {
                if Task.isCancelled || error is CancellationError {
                    record(.energyRefresh, .skipped, trigger: trigger, attemptID: runID,
                           skipReason: .cancelled, durationSeconds: elapsed(since: started))
                    return
                }
                recordFailure(.energyRefresh, trigger: trigger, error: error, stage: .backendRead,
                              attemptID: runID, backendOperation: .todayEnergyRead,
                              durationSeconds: elapsed(since: started))
                scheduleRefresh(retry: true)
                if case .name = account.state, account.currentUser?.id == id {
                    errorMessage = error.localizedDescription
                }
            }
        }
        refreshTask = task
        await task.value
    }

    private func finishRefresh(_ result: WatchEnergySnapshot, userID: String,
                               pending: WatchPendingHealthSync?, syncError: String?,
                               trigger: WatchEventTrigger, attemptID: UUID, started: TimeInterval) {
        snapshot = result
        let save = store.saveReportingDisplayChange(result)
        record(.snapshotSave, save.saved ? .succeeded : .failed, trigger: trigger, attemptID: attemptID)
        if save.displayValuesChanged { requestComplicationReload(attemptID: attemptID) }
        if save.saved, syncError == nil {
            if let pending { _ = pendingHealth.clearIfUnchanged(pending) }
            refreshSchedule.didRefreshSuccessfully()
            if pendingHealth.pending(for: userID) != nil { scheduleRefresh(pending: true) }
        }
        errorMessage = [syncError, save.saved ? nil : "Complication snapshot could not be saved."]
            .compactMap { $0 }.joined(separator: "\n")
        if errorMessage?.isEmpty == true { errorMessage = nil }
        record(.energyRefresh, .succeeded, trigger: trigger, attemptID: attemptID,
               durationSeconds: elapsed(since: started))
    }

    private func abandonStaleRefresh() {
        guard let startedAt = refreshStartedAt,
              WatchRefreshSchedule.isStaleRefresh(startedAt: startedAt, now: Date()),
              let task = refreshTask else { return }
        task.cancel()
        record(.energyRefresh, .skipped, attemptID: activeRefreshID, skipReason: .staleRefresh)
        refreshTask = nil
        activeRefreshID = nil
        refreshStartedAt = nil
        refreshingUserID = nil
        refreshingWithHealth = false
        refreshingPendingGeneration = nil
    }

    private func joinRefresh(_ task: Task<Void, Never>, trigger: WatchEventTrigger,
                             attemptID: UUID?) async {
        record(.energyRefresh, .joined, trigger: trigger, attemptID: attemptID)
        let previousID = refreshingUserID
        let hadHealth = refreshingWithHealth
        let handledGeneration = refreshingPendingGeneration
        await task.value
        let pendingGeneration = previousID.flatMap { pendingHealth.pending(for: $0)?.generation }
        let unhandledDelivery = trigger == .healthObserver && pendingGeneration != nil
            && pendingGeneration != handledGeneration
        if previousID != account.currentUser?.id || (healthEnabled && !hadHealth) || unhandledDelivery {
            await refresh(trigger: trigger, attemptID: attemptID)
        }
    }

    func signOut() async {
        health.stopObserving()
        observedUserID = nil
        pendingHealth.clear()
        store.clear()
        snapshot = nil
        requestComplicationReload()
        await account.signOut()
        accountChanged(account.state)
    }

    /// Explicitly refresh energy after a foreground account revalidation, even
    /// when the account model republishes an unchanged name/state.
    func foregroundRefresh() async {
        await bootstrap()
        await account.waitForCurrentRead()
        if !Task.isCancelled { await refresh() }
    }

    func backgroundRefresh(attemptID: UUID) async {
        refreshSchedule.didWake()
        await bootstrap()
        // Re-arm before network/HealthKit work; if it is interrupted, the next
        // preferred wake has still been requested. Signed-out watches stop.
        if case .name = account.state, let id = account.currentUser?.id {
            scheduleRefresh(pending: healthEnabled && pendingHealth.pending(for: id) != nil)
        }
        await refreshWhenEligible(trigger: .background, attemptID: attemptID)
    }

    private func refreshWhenEligible(trigger: WatchEventTrigger, attemptID: UUID) async {
        // The observer callback was already acknowledged after its durable
        // handoff. Private reads still wait for a valid local account.
        await bootstrap()
        if Task.isCancelled {
            record(.energyRefresh, .skipped, trigger: trigger, attemptID: attemptID, skipReason: .cancelled)
            return
        }
        await revalidateAccountIfNeeded()
        if Task.isCancelled {
            record(.energyRefresh, .skipped, trigger: trigger, attemptID: attemptID, skipReason: .cancelled)
            return
        }
        if case .name = account.state, contextReady, !account.isReadingProfile,
           account.profileError == nil {
            await refresh(trigger: trigger, attemptID: attemptID)
        } else {
            let reason: WatchEventSkipReason = !contextReady ? .contextUnavailable
                : (account.profileError == nil ? .accountUnavailable : .accountValidationFailed)
            record(.energyRefresh, .skipped, trigger: trigger, attemptID: attemptID, skipReason: reason)
            if reason == .accountValidationFailed { scheduleRefresh(retry: true) }
        }
    }

    private func revalidateAccountIfNeeded() async {
        // A transient /user failure keeps the same owner's cached profile, but
        // cannot authorize a private energy read until a fresh check succeeds.
        if case .name = account.state, account.profileError != nil, !account.isReadingProfile {
            account.refresh()
        }
        await account.waitForCurrentRead()
    }

    func record(_ action: WatchEventAction, _ outcome: WatchEventOutcome,
                trigger: WatchEventTrigger? = nil, errorCode: Int? = nil,
                errorSource: WatchEventErrorSource? = nil, stage: WatchEventStage? = nil,
                attemptID: UUID? = nil, metric: WatchEventMetric? = nil,
                runtimeState: WatchEventRuntimeState? = nil,
                backendOperation: WatchEventBackendOperation? = nil,
                skipReason: WatchEventSkipReason? = nil, durationSeconds: Int? = nil,
                pendingWallSeconds: Int? = nil) {
        events = eventStore.record(WatchEvent(
            action: action, outcome: outcome, trigger: trigger, errorCode: errorCode,
            errorSource: errorSource, stage: stage, attemptID: attemptID, metric: metric,
            runtimeState: runtimeState, backendOperation: backendOperation,
            skipReason: skipReason, durationSeconds: durationSeconds,
            pendingWallSeconds: pendingWallSeconds
        ))
    }

    private func recordFailure(_ action: WatchEventAction, trigger: WatchEventTrigger? = nil,
                               error: any Error, stage fallback: WatchEventStage,
                               attemptID: UUID? = nil, backendOperation: WatchEventBackendOperation? = nil,
                               durationSeconds: Int? = nil) {
        let wrapped = error as? WatchHealthSyncFailure
        let actualStage = wrapped?.stage ?? fallback
        let domain = wrapped?.underlyingDomain ?? (error as NSError).domain
        let code = wrapped?.underlyingCode ?? (error as NSError).code
        let graphQLSource = wrapped?.diagnosticSource ?? (error as? GraphQLDomainError).map(WatchEventErrorSource.graphQL)
        let source = graphQLSource ?? WatchEventErrorSource.classify(domain: domain, stage: actualStage)
        record(action, .failed, trigger: trigger, errorCode: code, errorSource: source, stage: actualStage,
               attemptID: attemptID, backendOperation: wrapped?.backendOperation ?? backendOperation,
               durationSeconds: durationSeconds)
    }

    private func elapsed(since start: TimeInterval) -> Int {
        max(0, Int((ProcessInfo.processInfo.systemUptime - start).rounded(.up)))
    }

    func clearEvents() {
        eventStore.clear()
        events = []
    }

    private func requestComplicationReload(attemptID: UUID? = nil) {
        record(.complicationReload, .requested, attemptID: attemptID)
        WidgetCenter.shared.reloadTimelines(ofKind: WatchEnergySnapshotStore.widgetKind)
    }

    private func startObservers(for ownerID: String) {
        guard observedUserID != ownerID else { return }
        observedUserID = ownerID
        let pendingHealth = pendingHealth
        health.startObserving { [weak self] metric, id in
            // This runs on HealthKit's callback executor, before completion().
            // Capture the authorized owner, not mutable account state.
            let saved = pendingHealth.markPending(for: ownerID)
            Task { @MainActor [weak self] in
                if !saved {
                    self?.record(.healthObservation, .failed, trigger: .healthObserver,
                                 stage: .localHandoff, attemptID: id, metric: metric)
                }
                await self?.handleObserver(metric: metric, id: id, ownerID: ownerID)
            }
        } onCompletion: { [weak self] metric, id, outcome, seconds in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.record(.healthObservation, outcome, trigger: .healthObserver,
                            attemptID: id, metric: metric, runtimeState: self.runtimeState,
                            durationSeconds: seconds)
            }
        } onFailure: { [weak self] metric, action, stage, code, source in
            Task { @MainActor [weak self] in
                self?.record(action, .failed, trigger: .healthObserver,
                             errorCode: code, errorSource: source, stage: stage, metric: metric)
            }
        }
    }

    private func handleObserver(metric: WatchEventMetric, id: UUID, ownerID: String) async {
        record(.healthObservation, .started, trigger: .healthObserver,
               attemptID: id, metric: metric, runtimeState: runtimeState)
        guard case .name = account.state, account.currentUser?.id == ownerID, healthEnabled else {
            record(.energyRefresh, .skipped, trigger: .healthObserver, attemptID: id,
                   skipReason: .accountChanged)
            return
        }
        scheduleRefresh(pending: true)
        await refreshWhenEligible(trigger: .healthObserver, attemptID: id)
    }

    private var runtimeState: WatchEventRuntimeState {
        switch WKApplication.shared().applicationState {
        case .active: .active
        case .inactive: .inactive
        case .background: .background
        @unknown default: .unknown
        }
    }

    private func scheduleRefresh(retry: Bool = false, pending: Bool = false) {
        if retry || pending {
            guard case .name = account.state else { return }
        }
        let now = Date()
        let preferredDate = retry ? refreshSchedule.requestRetry(now: now)
            : (pending ? refreshSchedule.requestPendingHealth(now: now) : refreshSchedule.requestHourly(now: now))
        guard let preferredDate else { return }
        let trigger: WatchEventTrigger? = retry ? .retry : (pending ? .pendingHealth : nil)
        record(.backgroundScheduling, .requested, trigger: trigger)
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: preferredDate, userInfo: nil
        ) { [weak self] error in
            let code = error.map { ($0 as NSError).code }
            let isNetworkError = error.map { ($0 as NSError).domain == NSURLErrorDomain } ?? false
            Task { @MainActor [weak self] in
                guard let self else { return }
                if code != nil { self.refreshSchedule.didFailToSchedule(preferredDate) }
                self.record(.backgroundScheduling, code == nil ? .accepted : .failed, trigger: trigger,
                            errorCode: code, errorSource: code == nil ? nil : (isNetworkError ? .network : .other),
                            stage: code == nil ? nil : .scheduling)
            }
        }
    }
}

// Keep HealthKit and network classification consistent for asynchronous observer
// callbacks and regular refresh failures without carrying raw errors into events.
extension WatchEventErrorSource {
    static func classify(domain: String, stage: WatchEventStage) -> Self {
        if domain == HKErrorDomain { return .healthKit }
        if domain == NSURLErrorDomain { return .network }
        if stage == .backendRead || stage == .backendWrite { return .backend }
        return .other
    }
}

@MainActor
final class WatchEnergyBackgroundDelegate: NSObject, WKApplicationDelegate {
    let runtime = WatchEnergyRuntime()

    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for backgroundTask in backgroundTasks {
            guard let task = backgroundTask as? WKApplicationRefreshBackgroundTask else {
                backgroundTask.setTaskCompletedWithSnapshot(false)
                continue
            }
            let id = UUID()
            let started = ProcessInfo.processInfo.systemUptime
            runtime.record(.backgroundTask, .started, attemptID: id, runtimeState: .background)
            Task {
                await runtime.backgroundRefresh(attemptID: id)
                let seconds = max(0, Int((ProcessInfo.processInfo.systemUptime - started).rounded(.up)))
                runtime.record(.backgroundTask, .finished, attemptID: id, durationSeconds: seconds)
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
}
