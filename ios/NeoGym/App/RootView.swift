import NeoGymKit
import Nhost
import SwiftUI

enum AuthScreen {
    case signIn
    case signUp
}

struct RootView: View {
    let appEnvironment: AppEnvironment
    let runtimeConfiguration: NeoGymRuntimeConfiguration

    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var authCallbackURLRouter: AuthCallbackURLRouter
    @State private var authScreen: AuthScreen = .signIn
    @State private var isSigningOut = false
    @State private var changeEmailModel: ChangeEmailModel?

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
                    runtimeConfiguration: runtimeConfiguration,
                    isSigningOut: isSigningOut,
                    changeEmailModel: changeEmailModel,
                    signOut: signOut
                )
            case let .error(message):
                ErrorCard(message: message) {
                    authStore.start()
                }
            }
        }
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
                verifierStore: KeychainPKCEVerifierStore(
                    service: runtimeConfiguration.pkceServiceIdentifier
                ),
                currentEmail: currentEmail,
                redirectTo: runtimeConfiguration.callbackURL,
                callbackScheme: runtimeConfiguration.callbackScheme
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
            GlassPanel(
                cornerRadius: NeoGymTheme.radiusXXL,
                material: .regular,
                tint: NeoGymTheme.glassStrongFill,
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
                        .tint(NeoGymTheme.accent)
                    VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                        Text("Loading NeoGym")
                            .font(.headline)
                        Text("Restoring your session…")
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.mutedText)
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
            GlassPanel(
                cornerRadius: NeoGymTheme.radiusXXL,
                material: .regular,
                tint: NeoGymTheme.glassStrongFill,
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
                        ZStack {
                            Circle()
                                .fill(NeoGymTheme.accentSoft)
                                .frame(width: 108, height: 108)
                                .blur(radius: 18)
                                .offset(x: 14, y: 12)
                            Circle()
                                .fill(.ultraThinMaterial)
                                .frame(width: 86, height: 86)
                                .overlay(Circle().stroke(NeoGymTheme.glassStrokeSecondary))
                            Image(systemName: systemImage)
                                .font(.system(size: 32, weight: .semibold))
                                .foregroundColor(NeoGymTheme.accent)
                        }
                        .accessibilityHidden(true)

                        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                            Text(eyebrow.uppercased())
                                .font(.caption.weight(.bold))
                                .tracking(1.6)
                                .foregroundColor(NeoGymTheme.mutedText)
                            Text(title)
                                .font(.system(.largeTitle, design: .rounded).weight(.bold))
                                .tracking(-0.8)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(message)
                                .font(.body)
                                .foregroundColor(NeoGymTheme.mutedText)
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
    RootView(
        appEnvironment: NhostClientFactory.makeEnvironment(),
        runtimeConfiguration: NeoGymPreviewFixtures.runtimeConfiguration
    )
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
