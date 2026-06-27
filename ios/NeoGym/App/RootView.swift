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
        .onChange(of: changeEmailModelKey) { _ in
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
        VStack(spacing: NeoGymTheme.spacingXL) {
            Spacer(minLength: NeoGymTheme.spacingXXL)
            GlassPanel(
                cornerRadius: NeoGymTheme.radiusXXL,
                material: .regular,
                tint: NeoGymTheme.glassStrongFill,
                contentPadding: EdgeInsets(
                    top: NeoGymTheme.spacingXXL,
                    leading: NeoGymTheme.spacingXL,
                    bottom: NeoGymTheme.spacingXXL,
                    trailing: NeoGymTheme.spacingXL
                )
            ) {
                VStack(spacing: NeoGymTheme.spacingMD) {
                    ProgressView()
                        .controlSize(.large)
                        .tint(NeoGymTheme.accent)
                    Text("Loading NeoGym")
                        .font(.title2.bold())
                        .tracking(-0.4)
                    Text("Checking for a saved session…")
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: NeoGymTheme.maxCardWidth)
            Spacer(minLength: NeoGymTheme.spacingXXL)
        }
        .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
    }
}

private struct ErrorCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: NeoGymTheme.spacingXL) {
            Spacer(minLength: NeoGymTheme.spacingXXL)
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
                    VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
                        Text("Session error")
                            .font(.title2.bold())
                            .tracking(-0.4)
                        Text("NeoGym couldn't load your saved session.")
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    FeedbackBanner(message: message)
                    Button("Try again", action: retry)
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                }
            }
            .frame(maxWidth: NeoGymTheme.maxCardWidth)
            Spacer(minLength: NeoGymTheme.spacingXXL)
        }
        .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
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
