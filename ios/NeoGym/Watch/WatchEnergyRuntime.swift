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
    private var refreshTask: Task<Void, Never>?
    private var refreshingUserID: String?
    private var refreshingWithHealth = false
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
                store.clear()
                requestComplicationReload()
            }
            return
        }
        let date = DateOnly.todayLocalISO()
        let saved = store.load(for: date)
        if let saved, saved.userID != user.id {
            store.clear()
            requestComplicationReload()
        }
        snapshot = saved.flatMap { $0.userID == user.id ? $0 : nil }
        healthEnabled = UserDefaults.standard.string(forKey: authorizationKey) == user.id
        if healthEnabled { startObservers() }
        scheduleRefresh()
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
            startObservers()
            await refresh(trigger: .healthAuthorization)
        } catch {
            recordFailure(.healthPermission, error: error, stage: .authorization)
            errorMessage = error.localizedDescription
        }
    }

    func refresh(trigger: WatchEventTrigger = .automatic) async {
        if trigger == .manual {
            await revalidateAccountIfNeeded()
        }
        guard contextReady, !account.isReadingProfile, account.profileError == nil else { return }
        if let refreshTask {
            let previousID = refreshingUserID
            let hadHealth = refreshingWithHealth
            await refreshTask.value
            if previousID != account.currentUser?.id || (healthEnabled && !hadHealth) {
                await refresh(trigger: trigger)
            }
            return
        }
        guard case .name = account.state, let user = account.currentUser else { return }
        let id = user.id
        let syncHealth = healthEnabled
        let now = Date()
        refreshingUserID = id
        refreshingWithHealth = syncHealth
        record(.energyRefresh, .started, trigger: trigger)
        let task = Task { [self] in
            isRefreshing = true
            defer {
                isRefreshing = false
                refreshTask = nil
                refreshingUserID = nil
                refreshingWithHealth = false
            }
            var syncError: String?
            if syncHealth {
                do {
                    try await service.syncHealth(now: now)
                    record(.healthSync, .succeeded, trigger: trigger)
                } catch {
                    if error is CancellationError { return }
                    recordFailure(.healthSync, trigger: trigger, error: error, stage: .healthRead)
                    syncError = "Apple Health sync failed: \(error.localizedDescription)"
                }
            }
            do {
                // Still read the backend after a Health failure; this is a separate outcome.
                let result = try await service.refresh(userID: id, syncHealth: false, now: now)
                guard case .name = account.state, account.currentUser?.id == id else {
                    record(.energyRefresh, .skipped, trigger: trigger)
                    return
                }
                snapshot = result
                let saved = store.save(result)
                record(.snapshotSave, saved ? .succeeded : .failed, trigger: trigger)
                if saved { requestComplicationReload() }
                errorMessage = [syncError, saved ? nil : "Complication snapshot could not be saved."]
                    .compactMap { $0 }.joined(separator: "\n")
                if errorMessage?.isEmpty == true { errorMessage = nil }
                record(.energyRefresh, .succeeded, trigger: trigger)
            } catch {
                if error is CancellationError { return }
                recordFailure(.energyRefresh, trigger: trigger, error: error, stage: .backendRead)
                if case .name = account.state, account.currentUser?.id == id {
                    errorMessage = error.localizedDescription
                }
            }
        }
        refreshTask = task
        await task.value
    }

    func signOut() async {
        store.clear()
        snapshot = nil
        requestComplicationReload()
        await account.signOut()
        accountChanged(account.state)
    }

    func backgroundRefresh() async {
        await refreshWhenEligible(trigger: .background)
        scheduleRefresh()
    }

    private func refreshWhenEligible(trigger: WatchEventTrigger) async {
        // Background tasks and HealthKit deliveries must hold their completion
        // until local context and the uncached account read have settled.
        await bootstrap()
        await revalidateAccountIfNeeded()
        if case .name = account.state, contextReady, !account.isReadingProfile,
           account.profileError == nil {
            await refresh(trigger: trigger)
        } else {
            record(.energyRefresh, .skipped, trigger: trigger)
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
                errorSource: WatchEventErrorSource? = nil, stage: WatchEventStage? = nil) {
        events = eventStore.record(WatchEvent(
            action: action, outcome: outcome, trigger: trigger, errorCode: errorCode,
            errorSource: errorSource, stage: stage
        ))
    }

    private func recordFailure(_ action: WatchEventAction, trigger: WatchEventTrigger? = nil,
                               error: any Error, stage fallback: WatchEventStage) {
        let wrapped = error as? WatchHealthSyncFailure
        let actualStage = wrapped?.stage ?? fallback
        let domain = wrapped?.underlyingDomain ?? (error as NSError).domain
        let code = wrapped?.underlyingCode ?? (error as NSError).code
        let source = WatchEventErrorSource.classify(domain: domain, stage: actualStage)
        record(action, .failed, trigger: trigger, errorCode: code, errorSource: source, stage: actualStage)
    }

    func clearEvents() {
        eventStore.clear()
        events = []
    }

    private func requestComplicationReload() {
        record(.complicationReload, .requested)
        WidgetCenter.shared.reloadTimelines(ofKind: WatchEnergySnapshotStore.widgetKind)
    }

    private func startObservers() {
        health.startObserving { [weak self] in
            await self?.refreshWhenEligible(trigger: .healthObserver)
        } onFailure: { [weak self] action, stage, code, source in
            Task { @MainActor [weak self] in
                self?.record(action, .failed, trigger: .healthObserver,
                             errorCode: code, errorSource: source, stage: stage)
            }
        }
    }

    private func scheduleRefresh() {
        record(.backgroundScheduling, .requested)
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: Date().addingTimeInterval(60 * 60), userInfo: nil
        ) { [weak self] error in
            let code = error.map { ($0 as NSError).code }
            let isNetworkError = error.map { ($0 as NSError).domain == NSURLErrorDomain } ?? false
            Task { @MainActor [weak self] in
                self?.record(.backgroundScheduling, code == nil ? .accepted : .failed,
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
            runtime.record(.backgroundTask, .started)
            Task {
                await runtime.backgroundRefresh()
                runtime.record(.backgroundTask, .finished)
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
}
