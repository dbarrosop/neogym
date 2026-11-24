import NeoGymKit
import SwiftUI
import WidgetKit

@main
struct GalleryWatchApp: App {
    private let scene = GalleryFixtures.scene

    var body: some Scene {
        WindowGroup {
            WatchFixtureView(scene: scene)
                .preferredColorScheme(.dark)
                .environment(\.locale, Locale(identifier: "en_US"))
                .environment(\.calendar, GalleryFixtures.calendar)
                .environment(\.timeZone, GalleryFixtures.calendar.timeZone)
                .environment(\.dynamicTypeSize, .large)
                .task { await GalleryFixtures.markReady(scene) }
        }
    }
}

private struct WatchFixtureView: View {
    let scene: GalleryScene
    @StateObject private var runtime: GalleryWatchRuntime
    @StateObject private var account: GalleryWatchAccount
    @StateObject private var assisted = GalleryWatchAssistedSignIn()
    private let actions = WatchAccountActions(restoreSavedSignIn: {}, signOut: {})

    init(scene: GalleryScene) {
        self.scene = scene
        _runtime = StateObject(wrappedValue: GalleryWatchRuntime(scene: scene))
        _account = StateObject(wrappedValue: GalleryWatchAccount(scene: scene))
        // Standard defaults here belong to the separate gallery bundle, not NeoGym.
        UserDefaults.standard.set(scene.page == "account-debug", forKey: "watchDebugMode.v1")
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(title)
        }
        .tint(WatchPalette.accentText)
        .allowsHitTesting(false)
    }

    @ViewBuilder private var content: some View {
        if scene.kind == "complication" {
            VStack(spacing: 18) {
                ComplicationGalleryView(
                    content: WatchComplicationContent(latest: runtime.snapshot, at: GalleryFixtures.now,
                                                      calendar: GalleryFixtures.calendar, locale: Locale(identifier: "en_US")),
                    circular: scene.family == "circular"
                )
                .frame(width: scene.width.map { CGFloat($0) }, height: scene.height.map { CGFloat($0) })
                Text("Visual fixture\nNot a watch face")
                    .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
        } else {
            page
        }
    }

    @ViewBuilder private var page: some View {
        switch scene.page {
        case "today", "today-empty": WatchTodayPage(runtime: runtime)
        case "end-of-day", "end-of-day-pending", "end-of-day-error":
            WatchEndOfDayPage(runtime: runtime, account: account)
        case "account", "account-debug":
            WatchAccountPage(runtime: runtime, account: account, actions: actions)
                .defaultScrollAnchor(scene.page == "account-debug" ? .bottom : .top)
        case "health": WatchHealthAccessPage(runtime: runtime, account: account)
        case "diagnostics":
            WatchDiagnosticsPage(runtime: runtime, receiptStore: WatchWidgetProviderReceiptStore(
                directory: FileManager.default.temporaryDirectory
            ))
            .defaultScrollAnchor(.bottom)
        default: WatchConnectionView(runtime: runtime, account: account, assisted: assisted, actions: actions)
        }
    }

    private var title: String {
        if scene.kind == "complication" { return "Fixture" }
        switch scene.page {
        case "account", "account-debug": return "Account"
        case "diagnostics": return "Diagnostics"
        case "today", "today-empty", "end-of-day", "end-of-day-pending", "end-of-day-error": return "Today"
        default: return "NeoGym"
        }
    }
}
