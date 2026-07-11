import NeoGymKit
import SwiftUI
import UserNotifications
import WidgetKit

@main
struct NeoGymApp: App {
    private let appEnvironment: AppEnvironment
    private let notificationDelegate: NeoGymNotificationDelegate
    @StateObject private var authStore: AuthStore
    @StateObject private var authCallbackURLRouter = AuthCallbackURLRouter()

    init() {
        let appEnvironment = NhostClientFactory.makeEnvironment(
            config: NhostConfig(
                subdomain: "spmqtxqkdoxvtrkrfnnl",
                region: "eu-central-1"
            )
        )
        let notificationDelegate = NeoGymNotificationDelegate()
        self.appEnvironment = appEnvironment
        self.notificationDelegate = notificationDelegate
        _authStore = StateObject(wrappedValue: AuthStore(
            authService: appEnvironment.authService,
            snapshotClearHandler: { _ in Self.clearEnergyBalanceWidgetSnapshot() }
        ))
        UNUserNotificationCenter.current().delegate = notificationDelegate
    }

    private static func clearEnergyBalanceWidgetSnapshot() {
        EnergyBalanceWidgetSnapshotStore.shared.clear()
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
    }

    var body: some Scene {
        WindowGroup {
            RootView(appEnvironment: appEnvironment)
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
