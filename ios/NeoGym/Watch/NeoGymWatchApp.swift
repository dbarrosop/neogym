import NeoGymKit
import SwiftUI

@main
struct NeoGymWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchEnergyBackgroundDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup { WatchHomeView(runtime: delegate.runtime) }
    }
}

/// Signed in: vertical pages Today (balance so far), End of day and Account, with an
/// Allow Health access page first until the watch has asked for read access. Other
/// account states use the message layout (icon, title, one line, a button).
private struct WatchHomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var runtime: WatchEnergyRuntime
    @ObservedObject private var account: WatchAccountModel
    @State private var activity = WatchActivity()
    @StateObject private var assisted: WatchAssistedSignInModel

    init(runtime: WatchEnergyRuntime) {
        self.runtime = runtime
        _account = ObservedObject(wrappedValue: runtime.account)
        _assisted = StateObject(wrappedValue: WatchAssistedSignInModel(account: runtime.account) { message, onFailure in
            runtime.connectivity.send(message, onFailure: onFailure)
        })
    }

    var body: some View {
        Group {
            if case .name = account.state {
                NavigationStack {
                    TabView {
                        if !runtime.healthEnabled {
                            WatchHealthAccessPage(runtime: runtime, account: account)
                        }
                        WatchTodayPage(runtime: runtime)
                            .navigationTitle("Today")
                        WatchEndOfDayPage(runtime: runtime, account: account)
                            .navigationTitle("Today")
                        WatchAccountPage(runtime: runtime, account: account, actions: actions)
                            .navigationTitle("Account")
                    }
                    .tabViewStyle(.verticalPage)
                }
            } else {
                WatchConnectionView(runtime: runtime, account: account, assisted: assisted, actions: actions)
            }
        }
        .tint(WatchPalette.accentText)
        .task {
            runtime.connectivity.onAssistedMessage = { message in
                if assisted.receive(message) {
                    activity.perform("auth") { _ = await assisted.connect() }
                }
            }
            await runtime.bootstrap()
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            if runtime.scenePhaseChanged(phase) {
                if let context = runtime.connectivity.currentContext() { account.receiveContext(context) }
                Task { await runtime.foregroundRefresh() }
            }
        }
        .onChange(of: account.isReadingProfile, initial: true) { _, reading in
            if reading { activity.begin("read", onExpire: { account.cancelPendingRead() }) }
            else { activity.end("read") }
        }
        .onChange(of: account.state) { _, state in
            if state == .clearing { activity.begin("clear") }
            else { activity.end("clear") }
        }
    }

    private var actions: WatchAccountActions {
        WatchAccountActions(
            restoreSavedSignIn: {
                activity.perform("auth") { _ = await account.recoverUsingPAT() }
            },
            signOut: {
                assisted.cancel()
                activity.perform("signOut", cancelOnExpire: false) {
                    await runtime.signOut()
                }
            }
        )
    }
}
