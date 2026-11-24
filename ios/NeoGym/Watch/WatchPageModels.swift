import NeoGymKit
import SwiftUI

/// Read-only presentation inputs and explicit actions. Production keeps its existing
/// runtime; the separate gallery apps supply inert fixtures without constructing it.
@MainActor
protocol WatchPageRuntime: ObservableObject {
    var snapshot: WatchEnergySnapshot? { get }
    var displayDate: Date { get }
    var errorMessage: String? { get }
    var isRefreshing: Bool { get }
    var healthEnabled: Bool { get }
    var contextReady: Bool { get }
    var events: [WatchEvent] { get }
    func refreshFromPage() async
    func enableHealth() async
    func currentPhoneContext() -> [String: Any]?
}

@MainActor
protocol WatchPageAccount: ObservableObject {
    var state: WatchAccountState { get }
    var currentUser: CurrentWatchUser? { get }
    var profileError: String? { get }
    var isReadingProfile: Bool { get }
    var hasRestorablePAT: Bool { get }
    var isRecovering: Bool { get }
    var assistedSignInUserID: String? { get }
    func refresh()
    func bootstrap() async
    func receiveContext(_ context: [String: Any])
}

extension WatchAccountModel: WatchPageAccount {}

@MainActor
protocol WatchPageAssistedSignIn: ObservableObject {
    var status: String? { get }
    var isConnecting: Bool { get }
    func start()
}

extension WatchAssistedSignInModel: WatchPageAssistedSignIn {}

/// Account actions that need the production home view's watchOS activity assertion.
struct WatchAccountActions {
    let restoreSavedSignIn: @MainActor () -> Void
    let signOut: @MainActor () -> Void
}
