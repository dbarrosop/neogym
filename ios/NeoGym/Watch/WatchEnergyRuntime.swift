import Combine
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

    let account: WatchAccountModel
    let connectivity = WatchAccountConnectivity()
    let health = WatchHealthEnergy()
    private let service: WatchEnergyService
    private let store = WatchEnergySnapshotStore.shared
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
            currentUser: NhostCurrentUserService(client: client)
        )
        let graphQL = NhostGraphQLService(client: client)
        service = WatchEnergyService(graphQL: graphQL, energy: DailyEnergyRepository(graphQL: graphQL),
                                     importer: health)
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
            account.localContextReady(await connectivity.activate())
            await account.bootstrap()
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
            // Keep today's last-good value through a transient offline read only
            // if the SDK still knows the same session owner. Blocking states clear.
            let savedUserID = store.load(for: DateOnly.todayLocalISO())?.userID
            let sessionUserID = account.authStore.state.session?.user?.id
            if !WatchEnergySnapshotPolicy.keepsStoredSnapshot(
                in: state, snapshotUserID: savedUserID, sessionUserID: sessionUserID
            ) {
                store.clear()
                WidgetCenter.shared.reloadTimelines(ofKind: WatchEnergySnapshotStore.widgetKind)
            }
            return
        }
        let date = DateOnly.todayLocalISO()
        let saved = store.load(for: date)
        if let saved, saved.userID != user.id { store.clear() }
        snapshot = saved.flatMap { $0.userID == user.id ? $0 : nil }
        healthEnabled = UserDefaults.standard.string(forKey: authorizationKey) == user.id
        if healthEnabled { startObservers() }
        scheduleRefresh()
        Task { await refresh() }
    }

    func enableHealth() async {
        guard case .name = account.state, let id = account.currentUser?.id else { return }
        do {
            try await health.authorize()
            guard account.currentUser?.id == id, case .name = account.state else { return }
            UserDefaults.standard.set(id, forKey: authorizationKey)
            healthEnabled = true
            startObservers()
            await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func refresh() async {
        if let refreshTask {
            let previousID = refreshingUserID
            let hadHealth = refreshingWithHealth
            await refreshTask.value
            if previousID != account.currentUser?.id || (healthEnabled && !hadHealth) { await refresh() }
            return
        }
        guard case .name = account.state, let user = account.currentUser else { return }
        let id = user.id
        let syncHealth = healthEnabled
        refreshingUserID = id
        refreshingWithHealth = syncHealth
        let task = Task { [self] in
            isRefreshing = true
            defer {
                isRefreshing = false
                refreshTask = nil
                refreshingUserID = nil
                refreshingWithHealth = false
            }
            do {
                // If HealthKit or the write fails, still attempt a backend read for the display.
                let result: WatchEnergySnapshot
                var syncError: String?
                do {
                    result = try await service.refresh(userID: id, syncHealth: syncHealth)
                } catch {
                    guard syncHealth else { throw error }
                    syncError = "Apple Health sync failed: \(error.localizedDescription)"
                    result = try await service.refresh(userID: id, syncHealth: false)
                }
                guard case .name = account.state, account.currentUser?.id == id else { return }
                snapshot = result
                errorMessage = syncError
                _ = store.save(result)
                WidgetCenter.shared.reloadTimelines(ofKind: WatchEnergySnapshotStore.widgetKind)
            } catch {
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
        WidgetCenter.shared.reloadTimelines(ofKind: WatchEnergySnapshotStore.widgetKind)
        await account.signOut()
        accountChanged(account.state)
    }

    func backgroundRefresh() async {
        // The phone hint and Auth session must be reconciled before touching private data.
        await bootstrap()
        await refresh()
        scheduleRefresh()
    }

    private func startObservers() {
        health.startObserving { [weak self] in await self?.refresh() }
    }

    private func scheduleRefresh() {
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: Date().addingTimeInterval(60 * 60), userInfo: nil
        ) { _ in }
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
            Task {
                await runtime.backgroundRefresh()
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
}
