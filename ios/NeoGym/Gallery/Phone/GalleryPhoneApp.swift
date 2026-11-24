import AppIntents
import NeoGymKit
import SwiftUI
import WidgetKit

@main
struct GalleryPhoneApp: App {
    private let scene = GalleryFixtures.scene

    var body: some Scene {
        WindowGroup {
            PhoneFixtureView(scene: scene)
                .preferredColorScheme(scene.appearance == "light" ? .light : .dark)
                .environment(\.locale, Locale(identifier: "en_US"))
                .environment(\.calendar, GalleryFixtures.calendar)
                .environment(\.timeZone, GalleryFixtures.calendar.timeZone)
                .environment(\.dynamicTypeSize, .large)
                .task { await GalleryFixtures.markReady(scene) }
        }
    }
}

private struct PhoneFixtureView: View {
    let scene: GalleryScene
    private var accessory: Bool { !["small", "medium"].contains(scene.family ?? "") }

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Text("NEOGYM · VISUAL FIXTURE")
                    .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text(scene.title).font(.title2.bold()).multilineTextAlignment(.center)
            }
            Spacer()
            fixture
                .frame(width: scene.width.map { CGFloat($0) }, height: scene.height.map { CGFloat($0) })
                .background(scene.kind == "rest" ? Color.black : accessory ? Color.black : WidgetTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: scene.kind == "rest" ? 24 : 22))
                .overlay(RoundedRectangle(cornerRadius: scene.kind == "rest" ? 24 : 22).stroke(.secondary.opacity(0.25)))
                .environment(\.colorScheme, accessory ? .dark : scene.appearance == "light" ? .light : .dark)
                .allowsHitTesting(false)
            Spacer()
            VStack(spacing: 8) {
                Text("Fictional data · frozen display inputs").font(.footnote.weight(.semibold))
                Text(scene.kind == "rest"
                     ? "Production Live Activity regions in a fixture host. Not the Lock Screen or Dynamic Island. Timer fixed at 1:15. Buttons are inert."
                     : "Production widget views in a fixture host. Not a Home or Lock Screen widget. Refresh and links are inert.")
                    .font(.footnote).foregroundStyle(.secondary)
                Text("\(Int(scene.width ?? 0)) × \(Int(scene.height ?? 0)) pt content frame")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .multilineTextAlignment(.center)
        }
        .padding(16)
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(scene.appearance == "light" ? Color(white: 0.96) : Color(white: 0.035))
    }

    @ViewBuilder private var fixture: some View {
        if scene.kind == "balance" {
            BalanceGalleryView(display: GalleryFixtures.display(scene.variant), family: family)
                .foregroundStyle(accessory ? .white : WidgetTheme.text)
        } else {
            RestGalleryView(region: scene.region ?? "lock-screen", isOver: scene.variant == "over")
                .foregroundStyle(.white)
        }
    }

    private var family: WidgetFamily {
        switch scene.family {
        case "medium": .systemMedium
        case "inline": .accessoryInline
        case "rectangular": .accessoryRectangular
        case "circular": .accessoryCircular
        default: .systemSmall
        }
    }
}

// These names satisfy the shipping views without compiling the production intents
// into this app. Even an accessibility activation has no external effects.
struct RefreshEnergyBalanceIntent: AppIntent {
    static let title: LocalizedStringResource = "Inert gallery refresh"
    func perform() async throws -> some IntentResult { .result() }
}
struct ExtendRestTimerIntent: AppIntent {
    static let title: LocalizedStringResource = "Inert gallery extend"
    func perform() async throws -> some IntentResult { .result() }
}
struct SkipRestTimerIntent: AppIntent {
    static let title: LocalizedStringResource = "Inert gallery skip"
    func perform() async throws -> some IntentResult { .result() }
}
