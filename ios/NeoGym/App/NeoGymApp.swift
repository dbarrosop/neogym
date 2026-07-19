import NeoGymKit
import SwiftUI
import UserNotifications
import WidgetKit

@main
struct NeoGymApp: App {
    private let appEnvironment: AppEnvironment
    private let runtimeConfiguration: NeoGymRuntimeConfiguration
    private let notificationDelegate: NeoGymNotificationDelegate
    @StateObject private var authStore: AuthStore
    @StateObject private var authCallbackURLRouter = AuthCallbackURLRouter()

    init() {
        do {
            let runtimeConfiguration = try NeoGymRuntimeConfiguration(bundle: .main)
            let appEnvironment = try NhostClientFactory.makeEnvironment(
                configuration: runtimeConfiguration
            )
            let snapshotStore = EnergyBalanceWidgetSnapshotStore(
                suiteName: runtimeConfiguration.appGroupIdentifier
            )
            let notificationDelegate = NeoGymNotificationDelegate()
            self.appEnvironment = appEnvironment
            self.runtimeConfiguration = runtimeConfiguration
            self.notificationDelegate = notificationDelegate
            _authStore = StateObject(wrappedValue: AuthStore(
                authService: appEnvironment.authService,
                snapshotClearHandler: { _ in
                    snapshotStore.clear()
                    WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
                }
            ))
            UNUserNotificationCenter.current().delegate = notificationDelegate
        } catch {
            fatalError(
                "NeoGym runtime provisioning is invalid. Check the required bundle keys and signed entitlements."
            )
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(
                appEnvironment: appEnvironment,
                runtimeConfiguration: runtimeConfiguration
            )
                .environmentObject(authStore)
                .environmentObject(authCallbackURLRouter)
                .onOpenURL { url in
                    authCallbackURLRouter.open(url)
                }
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
