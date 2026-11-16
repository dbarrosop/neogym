import NeoGymKit
import SwiftUI
import UserNotifications
import WidgetKit

@main
struct NeoGymApp: App {
    @StateObject private var mode = AppModeController()
    private let notificationDelegate = NeoGymNotificationDelegate()

    init() {
        // Live Activity buttons can launch the app in the background before any scene.
        LiveRestTimerIntents.install()
    }

    var body: some Scene {
        WindowGroup {
            AppModeView(mode: mode)
                .onAppear { UNUserNotificationCenter.current().delegate = notificationDelegate }
        }
    }
}

/// Created only in the live branch. A --demo launch never constructs this runtime.
@MainActor
final class LiveAppRuntime: ObservableObject {
    let environment: AppEnvironment
    let authStore: AuthStore
    let restTimers: RestTimerAccountScope
    let phoneConnectivity: PhoneAccountConnectivity
    private let effectsGate: LiveEffectsGate

    init() {
        let environment = NhostClientFactory.makeProductionEnvironment()
        let restEffects = RestTimerSystemEffects()
        let restTimers = RestTimerAccountScope(effects: restEffects)
        LiveRestTimerIntents.attach(scope: restTimers, effects: restEffects)
        let gate = LiveEffectsGate()
        self.effectsGate = gate
        self.environment = environment
        self.restTimers = restTimers
        let authStore = AuthStore(
            authService: environment.authService,
            snapshotClearHandler: { _ in
                guard gate.enabled else { return }
                restTimers.endSession()
                EnergyBalanceWidgetSnapshotStore.shared.clear()
                WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
            }
        )
        self.authStore = authStore
        restTimers.bind(to: authStore)
        let connectivity = PhoneAccountConnectivity(patService: NhostWatchPATService(client: environment.client))
        phoneConnectivity = connectivity
        connectivity.bind(to: authStore)
        connectivity.start()
    }

    func suspendForDemo() {
        effectsGate.enabled = false
        LiveRestTimerIntents.detach(scope: restTimers)
        phoneConnectivity.suspend()
        authStore.retire()
    }
}

@MainActor
private final class LiveEffectsGate { var enabled = true }

struct LiveAppView: View {
    let enterDemo: () -> Void
    @StateObject private var runtime = LiveAppRuntime()
    @StateObject private var authCallbackURLRouter = AuthCallbackURLRouter()
    @StateObject private var deepLinks = AppDeepLinkRouter()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        RootView(appEnvironment: runtime.environment, restTimers: runtime.restTimers, onTryDemo: {
            runtime.suspendForDemo()
            enterDemo()
        })
        .environmentObject(runtime.authStore)
        .environmentObject(authCallbackURLRouter)
        .environmentObject(runtime.phoneConnectivity)
        .environment(\.appDeepLinks, deepLinks)
        .onOpenURL { url in
            // Navigation links never reach the auth callback handler.
            if let link = AppDeepLink(url: url) {
                deepLinks.open(link)
            } else {
                authCallbackURLRouter.open(url)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { runtime.phoneConnectivity.foreground() }
        }
    }
}

final class NeoGymNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }
}
