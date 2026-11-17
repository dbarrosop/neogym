import NeoGymKit
import SwiftUI

/// In-memory, inert page adapters. No live WatchEnergyRuntime, AuthStore, client,
/// Keychain, WCSession, HealthKit, URLSession or snapshot store is constructed.
@MainActor
final class GalleryWatchRuntime: WatchPageRuntime {
    @Published var snapshot: WatchEnergySnapshot?
    @Published var errorMessage: String?
    let displayDate = GalleryFixtures.now
    let isRefreshing = false
    let healthEnabled = true
    let contextReady = true
    let events: [WatchEvent] = [
        WatchEvent(action: .energyRefresh, outcome: .succeeded, trigger: .manual,
                   occurredAt: GalleryFixtures.now, id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!),
        WatchEvent(action: .complicationReload, outcome: .requested,
                   occurredAt: GalleryFixtures.now, id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!)
    ]

    init(scene: GalleryScene) {
        snapshot = GalleryFixtures.snapshot(scene.variant)
        errorMessage = scene.variant == "error" ? "Fictional refresh failure. Last values retained." : nil
    }
    func refreshFromPage() async {}
    func enableHealth() async {}
    func currentPhoneContext() -> [String: Any]? { nil }
}

@MainActor
final class GalleryWatchAccount: WatchPageAccount {
    @Published var state: WatchAccountState
    let currentUser: CurrentWatchUser? = CurrentWatchUser(id: "fictional-gallery-user", displayName: "Alex Morgan · Demo")
    let profileError: String? = nil
    let isReadingProfile = false
    let hasRestorablePAT = true // Presentation flag, not a stored credential.
    let isRecovering = false
    let assistedSignInUserID: String? = "fictional-gallery-user"

    init(scene: GalleryScene) {
        switch scene.page {
        case "connect": state = .matchPhone
        case "reauthenticate": state = .reauthenticate
        case "auth-error": state = .authError
        case "phone-signed-out": state = .phoneSignedOut
        case "clearing": state = .clearing
        case "error": state = .error("Fictional local credential error")
        default: state = .name("Alex Morgan · Demo")
        }
    }
    func refresh() {}
    func bootstrap() async {}
    func receiveContext(_ context: [String: Any]) {}
}

@MainActor
final class GalleryWatchAssistedSignIn: WatchPageAssistedSignIn {
    let status: String? = nil
    let isConnecting = false
    func start() {}
}
