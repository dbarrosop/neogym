import NeoGymKit
import Nhost
import SwiftUI

enum AuthScreen {
    case signIn
    case signUp
}

struct RootView: View {
    let appEnvironment: AppEnvironment

    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var authCallbackURLRouter: AuthCallbackURLRouter
    @State private var authScreen: AuthScreen = .signIn
    @State private var isSigningOut = false
    @State private var changeEmailModel: ChangeEmailModel?
    @AppStorage(AppAppearance.storageKey) private var appearanceRawValue = AppAppearance.defaultValue.rawValue

    var body: some View {
        ScreenScaffold {
            switch authStore.state {
            case .loading:
                LoadingView()
            case .signedOut:
                signedOutView
            case let .signedIn(session):
                AppShellView(
                    session: session,
                    environment: appEnvironment,
                    isSigningOut: isSigningOut,
                    changeEmailModel: changeEmailModel,
                    signOut: signOut
                )
                // A different account gets fresh tabs, sync models and paths.
                .id(session.user?.id)
            case let .error(message):
                ErrorCard(message: message) {
                    authStore.start()
                }
            }
        }
        .tint(NeoGymTheme.accentText)
        .preferredColorScheme(AppAppearance(storedValue: appearanceRawValue).colorScheme)
        .animation(.easeInOut(duration: 0.2), value: authStore.state.isLoading)
        .onAppear {
            configureChangeEmailModel()
            handlePendingAuthCallbackIfPossible()
        }
        .onChange(of: changeEmailModelKey) {
            configureChangeEmailModel()
            handlePendingAuthCallbackIfPossible()
        }
        .onReceive(authCallbackURLRouter.$pendingURL.compactMap { $0 }) { url in
            handleAuthCallback(url)
        }
    }

    @ViewBuilder
    private var signedOutView: some View {
        switch authScreen {
        case .signIn:
            SignInView(
                authService: authStore.authService,
                onSignUp: { authScreen = .signUp },
                onAuthenticated: { session in authStore.applyVerifiedSession(session) }
            )
        case .signUp:
            SignUpView(
                authService: authStore.authService,
                onSignIn: { authScreen = .signIn },
                onAuthenticated: { session in authStore.applyVerifiedSession(session) }
            )
        }
    }

    private var changeEmailModelKey: String {
        guard case let .signedIn(session) = authStore.state else {
            return "signed-out"
        }

        return "\(session.user?.id ?? "missing-user")|\(session.user?.email ?? "")"
    }

    private func configureChangeEmailModel() {
        guard case let .signedIn(session) = authStore.state else {
            changeEmailModel = nil
            return
        }

        let currentEmail = session.user?.email
        if changeEmailModel == nil || changeEmailModel?.currentEmail != currentEmail {
            changeEmailModel = ChangeEmailModel(
                authService: authStore.authService,
                currentEmail: currentEmail
            )
        }
    }

    private func handlePendingAuthCallbackIfPossible() {
        guard let pendingURL = authCallbackURLRouter.pendingURL else { return }
        handleAuthCallback(pendingURL)
    }

    private func handleAuthCallback(_ url: URL) {
        configureChangeEmailModel()

        guard let changeEmailModel else { return }
        authCallbackURLRouter.consume(url)

        Task { @MainActor in
            if let session = await changeEmailModel.handleCallback(url: url) {
                authStore.applyVerifiedSession(session)
                configureChangeEmailModel()
            }
        }
    }

    private func signOut() {
        guard !isSigningOut else { return }
        isSigningOut = true
        Task {
            await authStore.signOut()
            await MainActor.run {
                authScreen = .signIn
                isSigningOut = false
            }
        }
    }
}

private struct LoadingView: View {
    var body: some View {
        RootStateLayout(
            systemImage: "bolt.heart.fill",
            eyebrow: "NeoGym",
            title: "Preparing your training space",
            message: "Checking for a saved session and syncing the app shell."
        ) {
            SurfaceCard(
                cornerRadius: NeoGymTheme.radiusXL,
                fill: NeoGymTheme.surface,
                contentPadding: EdgeInsets(
                    top: NeoGymTheme.spacingXL,
                    leading: NeoGymTheme.spacingXL,
                    bottom: NeoGymTheme.spacingXL,
                    trailing: NeoGymTheme.spacingXL
                )
            ) {
                HStack(spacing: NeoGymTheme.spacingMD) {
                    ProgressView()
                        .controlSize(.large)
                        .tint(NeoGymTheme.accentText)
                    VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                        Text("Loading NeoGym")
                            .font(.headline)
                        Text("Restoring your session…")
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }
}

private struct ErrorCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        RootStateLayout(
            systemImage: "exclamationmark.triangle.fill",
            eyebrow: "Session error",
            title: "NeoGym couldn't load your saved session",
            message: "Retry the local session check, or sign in again if the issue persists."
        ) {
            SurfaceCard(
                cornerRadius: NeoGymTheme.radiusXL,
                fill: NeoGymTheme.surface,
                contentPadding: EdgeInsets(
                    top: NeoGymTheme.spacingXL,
                    leading: NeoGymTheme.spacingXL,
                    bottom: NeoGymTheme.spacingXL,
                    trailing: NeoGymTheme.spacingXL
                )
            ) {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) {
                    FeedbackBanner(message: message)
                    Button("Try again", action: retry)
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct RootStateLayout<ActionPanel: View>: View {
    let systemImage: String
    let eyebrow: String
    let title: String
    let message: String
    @ViewBuilder let actionPanel: ActionPanel

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXL) {
                    VStack(alignment: .leading, spacing: NeoGymTheme.spacingLG) {
                        IconBadge(systemImage: systemImage, diameter: 86, symbolSize: 32)

                        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                            Text(eyebrow.uppercased())
                                .font(.caption.weight(.bold))
                                .tracking(1.6)
                                .foregroundColor(NeoGymTheme.textSecondary)
                            Text(title)
                                .font(.system(.largeTitle, design: .rounded).weight(.bold))
                                .tracking(-0.8)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(message)
                                .font(.body)
                                .foregroundColor(NeoGymTheme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    actionPanel
                }
                .frame(maxWidth: 620, alignment: .leading)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.top, max(NeoGymTheme.spacingXXL, proxy.safeAreaInsets.top + NeoGymTheme.spacingXL))
                .padding(.bottom, max(NeoGymTheme.spacingXXL, proxy.safeAreaInsets.bottom + NeoGymTheme.spacingXL))
                .frame(maxWidth: .infinity)
                .frame(minHeight: proxy.size.height, alignment: .center)
            }
        }
    }
}

#Preview {
    RootView(appEnvironment: NhostClientFactory.makeEnvironment())
        .environmentObject(AuthStore(authService: PreviewAuthService(), autoBootstrap: false))
        .environmentObject(AuthCallbackURLRouter())
}

private struct PreviewAuthService: AuthServicing {
    func getUserSession() async throws -> StoredSession? { nil }

    func subscribeToSessionChanges(
        _ handler: @escaping @Sendable (StoredSession?) async -> Void
    ) async -> AuthSessionSubscription {
        AuthSessionSubscription {}
    }

    func requestSignInOTP(email: String) async throws {}

    func requestSignUpOTP(email: String, displayName: String) async throws {}

    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? { nil }

    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {}

    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? { nil }

    func signOut(refreshToken: String?) async throws {}

    func clearSession() async throws {}
}

extension AppAppearance {
    /// `nil` follows the system setting.
    var colorScheme: ColorScheme? {
        switch self {
        case .dark: .dark
        case .light: .light
        case .system: nil
        }
    }
}
