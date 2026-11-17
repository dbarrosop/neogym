import NeoGymKit
import Nhost
import SwiftUI

@MainActor
final class AppModeController: ObservableObject {
    static let defaultsSuite = "io.nhost.neogym.demo"
    private static let activeKey = "demo.active"
    @Published private(set) var isDemo = false
    @Published private(set) var configurationError: String?
    let options: DemoLaunchOptions?
    let captureProfile: DemoCaptureProfile?
    let defaults: UserDefaults?
    private var pendingLaunchReset = false

    init(arguments: [String] = ProcessInfo.processInfo.arguments) {
        defaults = UserDefaults(suiteName: Self.defaultsSuite)
        do {
            captureProfile = try DemoCaptureProfile.requested()
        } catch {
            captureProfile = nil
            options = nil
            AppClock.useDemoCapture(nil)
            configurationError = error.localizedDescription
            return
        }
        do {
            let options = try DemoLaunchOptions(arguments: arguments)
            self.options = options
            pendingLaunchReset = options.reset
            isDemo = options.enabled || defaults?.bool(forKey: Self.activeKey) == true
            AppClock.useDemoCapture(isDemo ? captureProfile : nil)
            if options.enabled { defaults?.set(true, forKey: Self.activeKey) }
            if isDemo, defaults == nil { configurationError = "Demo preferences are unavailable." }
        } catch {
            options = nil
            AppClock.useDemoCapture(nil)
            configurationError = error.localizedDescription
        }
    }

    func takeLaunchReset() -> Bool {
        defer { pendingLaunchReset = false }
        return pendingLaunchReset
    }

    func enterDemo() {
        guard defaults != nil else { configurationError = "Demo preferences are unavailable."; return }
        defaults?.set(true, forKey: Self.activeKey)
        AppClock.useDemoCapture(captureProfile)
        isDemo = true
    }

    func exitDemo() {
        defaults?.set(false, forKey: Self.activeKey)
        configurationError = nil
        AppClock.useDemoCapture(nil)
        isDemo = false
    }
}

struct AppModeView: View {
    @ObservedObject var mode: AppModeController

    var body: some View {
        if let error = mode.configurationError {
            AppErrorStateView(title: "Couldn't configure demo", message: error, retryTitle: "Open normal sign-in", retry: mode.exitDemo)
                .padding()
        } else if mode.isDemo, let defaults = mode.defaults {
            DemoModeView(defaults: defaults, options: mode.options, takeLaunchReset: mode.takeLaunchReset, exit: mode.exitDemo)
        } else {
            LiveAppView(enterDemo: mode.enterDemo)
        }
    }
}

@MainActor
private final class DemoRuntime: ObservableObject {
    @Published private(set) var environment: AppShellEnvironment?
    @Published private(set) var session: StoredSession?
    @Published private(set) var timer: RestTimerController?
    @Published private(set) var error: String?
    @Published private(set) var generation = UUID()
    private var store: DemoStore?
    private var isLoading = false
    private var isStopped = false
    private let defaults: UserDefaults
    private let screen: DemoScreen

    init(defaults: UserDefaults, screen: DemoScreen) {
        self.defaults = defaults
        self.screen = screen
    }

    func load(reset: Bool) async {
        guard !isLoading, !isStopped else { return }
        isLoading = true
        defer { isLoading = false }
        await store?.invalidate()
        guard !isStopped else { return }
        timer?.invalidate()
        environment = nil
        error = nil
        do {
            guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
                throw DemoError.incompatibleData
            }
            let url = support.appendingPathComponent("NeoGymDemo", isDirectory: true).appendingPathComponent("state-v1.json")
            let store = try DemoStore(fileURL: url, reset: reset, now: AppClock.now(), calendar: AppClock.calendar)
            self.store = store
            session = try DemoIdentity.session()
            environment = .demo(store: store, screen: screen)
            if reset {
                defaults.removeObject(forKey: AppAppearance.storageKey)
                defaults.removeObject(forKey: RestTimerPreference.storageKey)
            }
            let timer = RestTimerController(ownerId: DemoStore.userId, defaults: defaults, effects: DemoRestEffects())
            if reset { timer.cancel() }
            self.timer = timer
            generation = UUID()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stop() async {
        isStopped = true
        await store?.invalidate()
        timer?.invalidate()
        environment = nil
    }
}

private struct DemoModeView: View {
    let defaults: UserDefaults
    let takeLaunchReset: () -> Bool
    let exit: () -> Void
    @StateObject private var runtime: DemoRuntime
    @StateObject private var connectivity = PhoneAccountConnectivity(patService: DisabledDemoPATService(), enabled: false)
    @AppStorage private var appearance: String
    @State private var isExiting = false

    init(defaults: UserDefaults, options: DemoLaunchOptions?, takeLaunchReset: @escaping () -> Bool, exit: @escaping () -> Void) {
        self.defaults = defaults
        self.takeLaunchReset = takeLaunchReset
        self.exit = exit
        _runtime = StateObject(wrappedValue: DemoRuntime(defaults: defaults, screen: options?.screen ?? .today))
        _appearance = AppStorage(wrappedValue: AppAppearance.defaultValue.rawValue, AppAppearance.storageKey, store: defaults)
    }

    var body: some View {
        Group {
            if let environment = runtime.environment, let session = runtime.session, let timer = runtime.timer {
                // A real layout sibling, not a safe-area overlay on the UIKit tab/nav chrome.
                VStack(spacing: 0) {
                    DemoModeBanner()
                    AppShellView(
                        session: session, environment: environment, isSigningOut: false,
                        changeEmailModel: nil, signOut: exitDemo, restTimer: timer
                    )
                    .id(runtime.generation)
                }
            } else if let error = runtime.error {
                VStack(spacing: 16) {
                    AppErrorStateView(title: "Couldn't load demo", message: error, retryTitle: "Reset demo data") {
                        Task { await runtime.load(reset: true) }
                    }
                    Button("Exit demo", action: exitDemo).buttonStyle(NeoGymSecondaryButtonStyle())
                }
                .padding()
            } else {
                AppLoadingStateView(title: "Preparing sample data")
            }
        }
        .environmentObject(connectivity)
        .environment(\.demoActions, DemoActions(reset: { Task { await runtime.load(reset: true) } }, exit: exitDemo))
        .defaultAppStorage(defaults)
        .modifier(DemoCaptureEnvironment())
        .background(NeoGymTheme.background)
        .tint(NeoGymTheme.accentText)
        .preferredColorScheme(AppAppearance(storedValue: appearance).colorScheme)
        .task { await runtime.load(reset: takeLaunchReset()) }
    }

    private func exitDemo() {
        guard !isExiting else { return }
        isExiting = true
        Task {
            await runtime.stop()
            exit()
        }
    }
}

private struct DemoCaptureEnvironment: ViewModifier {
    func body(content: Content) -> some View {
        if let profile = AppClock.captureProfile {
            content
                .environment(\.calendar, profile.calendar)
                .environment(\.timeZone, profile.timeZone)
                .environment(\.locale, profile.locale)
                .transaction { $0.disablesAnimations = true }
        } else {
            content
        }
    }
}

struct DemoModeBanner: View {
    @Environment(\.demoActions) private var actions
    @State private var confirmingReset = false

    var body: some View {
        HStack(spacing: 12) {
            Label("Demo · fictional data", systemImage: "play.rectangle")
                .font(.caption.weight(.semibold))
                .accessibilityIdentifier("demo.banner")
            Spacer(minLength: 0)
            Menu {
                Button("Reset demo data", systemImage: "arrow.counterclockwise") { confirmingReset = true }
                Button("Exit demo", systemImage: "rectangle.portrait.and.arrow.right") { actions?.exit() }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Demo controls")
            .accessibilityIdentifier("demo.controls")
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .foregroundStyle(NeoGymTheme.textSecondary)
        .background(NeoGymTheme.surface)
        .confirmationDialog("Reset all demo changes?", isPresented: $confirmingReset, titleVisibility: .visible) {
            Button("Reset demo data", role: .destructive) { actions?.reset() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Only fictional demo data changes. Your real account is not affected.")
        }
    }
}

@MainActor
private final class DemoRestEffects: RestTimerEffects {
    func schedule(_ schedule: RestTimerSchedule) {}
    func cancel() {}
    func finish() {}
}

private struct DisabledDemoPATService: WatchPATServicing {
    func create(expiresAt: Date) async throws -> String { throw DemoError.invalidEntry }
    func signIn(token: String) async throws -> StoredSession? { throw DemoError.invalidEntry }
}
