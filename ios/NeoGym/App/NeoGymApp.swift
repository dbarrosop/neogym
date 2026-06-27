import NeoGymKit
import SwiftUI

@main
struct NeoGymApp: App {
    private let appEnvironment: AppEnvironment
    @StateObject private var authStore: AuthStore
    @StateObject private var authCallbackURLRouter = AuthCallbackURLRouter()

    init() {
        let appEnvironment = NhostClientFactory.makeEnvironment(
            config: NhostConfig(
                subdomain: "spmqtxqkdoxvtrkrfnnl",
                region: "eu-central-1"
            )
        )
        self.appEnvironment = appEnvironment
        _authStore = StateObject(wrappedValue: AuthStore(authService: appEnvironment.authService))
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
