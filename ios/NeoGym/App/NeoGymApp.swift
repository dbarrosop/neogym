import NeoGymKit
import SwiftUI

@main
struct NeoGymApp: App {
    @StateObject private var authStore = AuthStore()
    @StateObject private var authCallbackURLRouter = AuthCallbackURLRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authStore)
                .environmentObject(authCallbackURLRouter)
                .onOpenURL { url in
                    authCallbackURLRouter.open(url)
                }
        }
    }
}
