import NeoGymKit
import SwiftUI
import WidgetKit

/// Platform effects are selected alongside repositories, never inferred from a fake session.
struct AppShellEnvironment {
    let repositories: AppRepositories
    let storageBaseURL: URL
    var bodyHealthImporter: (any BodyMeasurementsHealthImporting)?
    var workoutHealthImporter: (any HealthWorkoutImporting)?
    var healthWorkoutRepository: (any HealthWorkoutStoring)?
    var isDemo = false
    var initialScreen: DemoScreen = .today

    static func live(_ environment: AppEnvironment, ownerId: String?) -> AppShellEnvironment {
        AppShellEnvironment(
            repositories: .live(graphQL: environment.graphQLService), storageBaseURL: environment.client.serviceURLs.storage,
            bodyHealthImporter: bodyImporter(), workoutHealthImporter: workoutImporter(),
            healthWorkoutRepository: HealthWorkoutRepository(client: environment.client, ownerUserId: ownerId ?? "")
        )
    }

    static func demo(store: DemoStore, screen: DemoScreen) -> AppShellEnvironment {
        AppShellEnvironment(
            repositories: .demo(store: store), storageBaseURL: URL(fileURLWithPath: "/neogym-demo-artwork"),
            isDemo: true, initialScreen: screen
        )
    }

    private static func bodyImporter() -> (any BodyMeasurementsHealthImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitBodyMeasurementImporter()
        #else
        nil
        #endif
    }

    private static func workoutImporter() -> (any HealthWorkoutImporting)? {
        #if canImport(HealthKit) && !os(macOS)
        HealthKitWorkoutImporter()
        #else
        nil
        #endif
    }
}

struct DemoActions {
    let reset: @MainActor () -> Void
    let exit: @MainActor () -> Void
}

struct EnergyWidgetUpdates {
    let enabled: Bool
    static let live = EnergyWidgetUpdates(enabled: true)
    static let disabled = EnergyWidgetUpdates(enabled: false)

    func reload() {
        guard enabled else { return }
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
    }

    func save(_ snapshot: EnergyBalanceWidgetSnapshot) {
        guard enabled else { return }
        EnergyBalanceWidgetSnapshotStore.shared.save(snapshot)
        reload()
    }
}

extension EnvironmentValues {
    @Entry var demoActions: DemoActions?
    @Entry var energyWidgetUpdates = EnergyWidgetUpdates.live
}
