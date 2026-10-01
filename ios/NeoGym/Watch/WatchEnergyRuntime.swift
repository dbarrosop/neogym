import Combine
import Foundation
import HealthKit
import NeoGymKit
import Nhost
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
    private let uploadClient: NhostClient
    let backgroundUploader = WatchEnergyBackgroundUploader()
    private let store = WatchEnergySnapshotStore.shared
    private let eventStore = WatchEventStore()
    private let pendingHealth = WatchPendingHealthSyncStore()
    private var refreshSchedule = WatchRefreshSchedule()
    private var foregroundGate = WatchForegroundRefreshGate()
    private let widgetReloadLastKey = "watchWidgetReloadLast.v1"
    private let widgetReloadDeferredKey = "watchWidgetReloadDeferred.v1"
    private var widgetReloadGate = WatchWidgetReloadGate(
        lastRequestedAt: UserDefaults.standard.object(forKey: "watchWidgetReloadLast.v1") as? Date
    )
    private var refreshTask: Task<Void, Never>?
    private var activeRefreshID: UUID?
    private var refreshStartedAt: Date?
    private var refreshingUserID: String?
    private var refreshingWithHealth = false
    private var refreshingPendingGeneration: UUID?
    private var observedUserID: String?
    private var lastSceneState: WatchEventRuntimeState?
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
        uploadClient = client
        let graphQL = NhostGraphQLService(client: client)
        service = WatchEnergyService(graphQL: graphQL, energy: DailyEnergyRepository(graphQL: graphQL),
                                     importer: health)
        events = eventStore.load()
        backgroundUploader.onResult = { [weak self] ownerID, success, status in
            guard let self else { return }
            // Background URLSession can relaunch the watch before its Keychain
            // account has been restored. Never attribute a result to that
            // account (or discard it as unknown) before bootstrap finishes.
            await self.bootstrap()
            guard !Task.isCancelled else { return }
            guard case .name = self.account.state, let ownerID,
                  self.account.currentUser?.id == ownerID else {
                self.record(.healthSync, .skipped, trigger: .background,
                            stage: .backendWrite, backendOperation: .updateEnergy,
                            skipReason: .accountChanged)
                return
            }
            self.record(.healthSync, success ? .succeeded : .failed,
                        trigger: .background, errorCode: success ? nil : status,
                        errorSource: success ? nil : .backend, stage: .backendWrite,
                        backendOperation: .updateEnergy)
            if success {
                await self.refreshWhenEligible(trigger: .background, attemptID: UUID())
            } else {
                self.scheduleRefresh(retry: true)
            }
            self.flushDeferredWidgetReload()
        }
        account.onReadFailure = { [weak self] diagnostic in
            guard let self else { return }
            let source: WatchEventErrorSource = switch diagnostic.kind {
            case .unknown, .sessionRefresh: .other
            default: .transport
            }
            self.record(.accountValidation, .failed,
                        errorCode: diagnostic.code, errorSource: source,
                        transportKind: diagnostic.kind, stage: .profileRead,
                        runtimeState: self.runtimeState)
        }
        accountSubscription = account.$state.sink { [weak self] state in
            // @Published emits before account.state changes; use the emitted state.
            MainActor.assumeIsolated { self?.accountChanged(state) }
        }
    }

    func bootstrap() async {
        if bootstrapped { return }
        if let bootstrapTask { await bootstrapTask.value; return }
        // HealthKit can launch us in the background without constructing a view.
        if runtimeState == .background { foregroundGate.enteredBackground() }
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
                backgroundUploader.cancel(ownerID: observedUserID)
                observedUserID = nil
                pendingHealth.clear()
                store.clear()
                requestComplicationReload(urgent: true)
            }
            return
        }
        if observedUserID != nil, observedUserID != user.id {
            health.stopObserving()
            backgroundUploader.cancel(ownerID: observedUserID)
            observedUserID = nil
        }
        pendingHealth.clearIfDifferentOwner(user.id)
        let date = DateOnly.todayLocalISO()
        let saved = store.load(for: date)
        if let saved, saved.userID != user.id {
            store.clear()
            requestComplicationReload(urgent: true)
        }
        snapshot = saved.flatMap { $0.userID == user.id ? $0 : nil }
        if snapshot != nil, runtimeState == .active { flushDeferredWidgetReload() }
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
        let stageReporter = makeStageReporter(trigger: trigger, attemptID: runID)
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
                    try await service.syncHealth(now: now, onStage: stageReporter)
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
                let result = try await service.refresh(userID: id, syncHealth: false,
                                                       now: now, onStage: stageReporter)
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

}

extension WatchEnergyRuntime {
    private func finishRefresh(_ result: WatchEnergySnapshot, userID: String,
                               pending: WatchPendingHealthSync?, syncError: String?,
                               trigger: WatchEventTrigger, attemptID: UUID, started: TimeInterval) {
        let displayed: WatchEnergySnapshot
        if let local = snapshot, local.pendingBackend == true,
           local.userID == userID, local.localDate == result.localDate,
           result.rowSource != .manual,
           syncError != nil || local.updatedAt > result.updatedAt {
            displayed = WatchEnergySnapshot(
                userID: userID, localDate: result.localDate, consumedKcal: result.consumedKcal,
                burnedKcal: local.burnedKcal, activeKcal: local.activeKcal,
                restingKcal: local.restingKcal, updatedAt: local.updatedAt,
                rowSource: result.rowSource, pendingBackend: true
            )
        } else {
            displayed = result
        }
        snapshot = displayed
        let save = store.saveReportingDisplayChange(displayed)
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

    /// Returns whether this active transition needs foreground revalidation.
    /// The delegate can record background work even when there is no view yet.
    func scenePhaseChanged(_ phase: ScenePhase) -> Bool {
        let state: WatchEventRuntimeState
        switch phase {
        case .active: state = .active
        case .inactive: state = .inactive
        case .background: state = .background
        @unknown default: state = .unknown
        }
        if state == .background { foregroundGate.enteredBackground() }
        let shouldRefresh = state == .active && foregroundGate.enteredActive()
        guard state != lastSceneState else { return shouldRefresh }
        lastSceneState = state
        record(.appLifecycle, .entered, attemptID: activeRefreshID, runtimeState: state)
        if state == .active, case .name = account.state, snapshot != nil {
            flushDeferredWidgetReload()
        }
        return shouldRefresh
    }

    func enteredBackground() {
        foregroundGate.enteredBackground()
    }

    func signOut() async {
        health.stopObserving()
        backgroundUploader.cancel(ownerID: observedUserID)
        observedUserID = nil
        pendingHealth.clear()
        store.clear()
        snapshot = nil
        requestComplicationReload(urgent: true)
        await account.signOut()
        accountChanged(account.state)
    }

    /// Explicitly refresh energy after a foreground account revalidation, even
    /// when the account model republishes an unchanged name/state.
    func foregroundRefresh() async {
        // Replace a background-started read before awaiting bootstrap, which
        // itself waits for the current read. Also retry /user from .authError;
        // refresh() is a no-op for other ineligible account states.
        account.cancelPendingRead()
        account.refresh()
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
        if healthEnabled, let ownerID = account.currentUser?.id,
           let imported = await saveLocalHealthEstimate(ownerID: ownerID, attemptID: attemptID),
           await enqueueBackgroundUpload(imported, ownerID: ownerID, attemptID: attemptID) {
            flushDeferredWidgetReload()
            return
        }
        await refreshWhenEligible(trigger: .background, attemptID: attemptID)
        flushDeferredWidgetReload()
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

}

extension WatchEnergyRuntime {
    private func makeStageReporter(trigger: WatchEventTrigger, attemptID: UUID) -> WatchEnergyStageReporter {
        { [weak self] stage in
            Task { @MainActor [weak self] in
                self?.record(.refreshStage, stage.outcome, trigger: trigger, stage: stage.stage,
                             attemptID: attemptID, backendOperation: stage.backendOperation,
                             wallSeconds: stage.wallSeconds, occurredAt: stage.occurredAt)
            }
        }
    }

    func record(_ action: WatchEventAction, _ outcome: WatchEventOutcome,
                trigger: WatchEventTrigger? = nil, errorCode: Int? = nil,
                errorSource: WatchEventErrorSource? = nil, transportKind: WatchTransportKind? = nil,
                stage: WatchEventStage? = nil,
                attemptID: UUID? = nil, metric: WatchEventMetric? = nil,
                runtimeState: WatchEventRuntimeState? = nil,
                backendOperation: WatchEventBackendOperation? = nil,
                skipReason: WatchEventSkipReason? = nil, durationSeconds: Int? = nil,
                pendingWallSeconds: Int? = nil, wallSeconds: Int? = nil,
                occurredAt: Date = Date()) {
        events = eventStore.record(WatchEvent(
            action: action, outcome: outcome, trigger: trigger, errorCode: errorCode,
            errorSource: errorSource, transportKind: transportKind, stage: stage,
            attemptID: attemptID, metric: metric,
            runtimeState: runtimeState, backendOperation: backendOperation,
            skipReason: skipReason, durationSeconds: durationSeconds,
            pendingWallSeconds: pendingWallSeconds, wallSeconds: wallSeconds,
            occurredAt: occurredAt
        ))
    }

    private func recordFailure(_ action: WatchEventAction, trigger: WatchEventTrigger? = nil,
                               error: any Error, stage fallback: WatchEventStage,
                               attemptID: UUID? = nil, backendOperation: WatchEventBackendOperation? = nil,
                               durationSeconds: Int? = nil) {
        let wrapped = error as? WatchHealthSyncFailure
        let actualStage = wrapped?.stage ?? fallback
        let classification = WatchEventFailureClassification(error: error, stage: actualStage)
        record(action, .failed, trigger: trigger, errorCode: classification.code,
               errorSource: classification.source, transportKind: classification.transportKind,
               stage: actualStage,
               attemptID: attemptID, runtimeState: runtimeState,
               backendOperation: wrapped?.backendOperation ?? backendOperation,
               durationSeconds: durationSeconds)
    }

    private func elapsed(since start: TimeInterval) -> Int {
        max(0, Int((ProcessInfo.processInfo.systemUptime - start).rounded(.up)))
    }

    func clearEvents() {
        eventStore.clear()
        events = []
    }

    private func requestComplicationReload(attemptID: UUID? = nil, urgent: Bool = false) {
        let now = Date()
        guard widgetReloadGate.shouldRequest(at: now, foregroundOrUrgent: urgent || runtimeState == .active) else {
            UserDefaults.standard.set(true, forKey: widgetReloadDeferredKey)
            record(.complicationReload, .skipped, attemptID: attemptID, skipReason: .coalesced)
            return
        }
        UserDefaults.standard.set(now, forKey: widgetReloadLastKey)
        UserDefaults.standard.set(false, forKey: widgetReloadDeferredKey)
        record(.complicationReload, .requested, attemptID: attemptID)
        WidgetCenter.shared.reloadTimelines(ofKind: WatchEnergySnapshotStore.widgetKind)
    }

    private func flushDeferredWidgetReload() {
        guard UserDefaults.standard.bool(forKey: widgetReloadDeferredKey) else { return }
        requestComplicationReload()
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
        } onCompletion: { [weak self] metric, id, outcome, seconds, acknowledgedAt in
            Task { @MainActor [weak self] in
                self?.record(.healthObservation, outcome, trigger: .healthObserver,
                             attemptID: id, metric: metric, durationSeconds: seconds,
                             occurredAt: acknowledgedAt)
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
        // No account-validation or backend request on this display path. An
        // imported/missing row can show the new HealthKit total immediately;
        // manual or unknown-provenance rows stay authoritative on the server.
        let imported = await saveLocalHealthEstimate(ownerID: ownerID, attemptID: id)
        scheduleRefresh(pending: true)
        if runtimeState != .active, let imported,
           await enqueueBackgroundUpload(imported, ownerID: ownerID, attemptID: id) {
            return
        }
        await refreshWhenEligible(trigger: .healthObserver, attemptID: id)
    }

    private func saveLocalHealthEstimate(ownerID: String, attemptID: UUID) async -> [HealthDailyEnergy]? {
        let today = DateOnly.todayLocalISO()
        do {
            let imported = try await health.dailyEnergyEntries(report: makeStageReporter(
                trigger: .healthObserver, attemptID: attemptID
            ))
            guard case .name = account.state, account.currentUser?.id == ownerID else { return nil }
            if let local = WatchLocalEnergyPolicy.estimate(
                from: store.load(for: today), imported: imported, ownerID: ownerID,
                today: today, now: Date()
            ) {
                let save = store.saveReportingDisplayChange(local)
                record(.snapshotSave, save.saved ? .succeeded : .failed,
                       trigger: .healthObserver, attemptID: attemptID)
                if save.saved {
                    snapshot = local
                    if save.displayValuesChanged { requestComplicationReload(attemptID: attemptID) }
                } else {
                    errorMessage = "Complication snapshot could not be saved."
                }
            }
            return imported
        } catch {
            recordFailure(.healthSync, trigger: .healthObserver, error: error,
                          stage: .healthRead, attemptID: attemptID)
            return nil
        }
    }

    private func enqueueBackgroundUpload(_ imported: [HealthDailyEnergy], ownerID: String,
                                         attemptID: UUID) async -> Bool {
        do {
            let queued = try await backgroundUploader.enqueue(
                entries: imported, ownerID: ownerID, client: uploadClient,
                isCurrentOwner: { [weak self] in
                    guard let self, case .name = self.account.state else { return false }
                    return self.account.currentUser?.id == ownerID
                }
            )
            guard case .name = account.state, account.currentUser?.id == ownerID else {
                backgroundUploader.cancel(ownerID: ownerID)
                return false
            }
            if queued {
                record(.healthSync, .started, trigger: .background,
                       stage: .backendWrite, attemptID: attemptID,
                       backendOperation: .updateEnergy)
            }
            return queued
        } catch {
            if !(error is CancellationError) {
                recordFailure(.healthSync, trigger: .background, error: error,
                              stage: .backendWrite, attemptID: attemptID)
            }
            scheduleRefresh(retry: true)
            return false
        }
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

@MainActor
final class WatchEnergyBackgroundDelegate: NSObject, WKApplicationDelegate {
    let runtime = WatchEnergyRuntime()

    func applicationDidFinishLaunching() {
        // Record a background-only launch before the scene can become active;
        // the asynchronous bootstrap may not have started yet.
        if WKApplication.shared().applicationState == .background { runtime.enteredBackground() }
        Task { await runtime.bootstrap() }
    }

    func applicationDidEnterBackground() {
        runtime.enteredBackground()
    }

    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        if !backgroundTasks.isEmpty { runtime.enteredBackground() }
        for backgroundTask in backgroundTasks {
            if let urlTask = backgroundTask as? WKURLSessionRefreshBackgroundTask {
                runtime.backgroundUploader.handle(urlTask)
                continue
            }
            guard let task = backgroundTask as? WKApplicationRefreshBackgroundTask else {
                backgroundTask.setTaskCompletedWithSnapshot(false)
                continue
            }
            let id = UUID()
            let startedAt = Date()
            runtime.record(.backgroundTask, .started, attemptID: id, runtimeState: .background,
                           occurredAt: startedAt)
            let completion = WatchCompletionGate {
                task.expirationHandler = nil
                task.setTaskCompletedWithSnapshot(false)
            }
            let work = Task {
                await runtime.backgroundRefresh(attemptID: id)
                let finishedAt = Date()
                if completion.complete() {
                    runtime.record(.backgroundTask, .finished, attemptID: id,
                                   wallSeconds: Self.wallSeconds(from: startedAt, to: finishedAt),
                                   occurredAt: finishedAt)
                }
            }
            task.expirationHandler = { [weak self] in
                let expiredAt = Date()
                work.cancel()
                // Complete promptly on watchOS's callback executor. The log
                // task may itself be deferred if the app is about to suspend.
                if completion.complete() {
                    Task { @MainActor [weak self] in
                        self?.runtime.record(.backgroundTask, .expired, attemptID: id,
                                             wallSeconds: Self.wallSeconds(from: startedAt, to: expiredAt),
                                             occurredAt: expiredAt)
                    }
                }
            }
        }
    }

    private static func wallSeconds(from start: Date, to end: Date) -> Int {
        max(0, Int(end.timeIntervalSince(start).rounded(.up)))
    }
}
