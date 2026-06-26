import NeoGymKit
import Nhost
import SwiftUI

enum AuthScreen {
    case signIn
    case signUp
}

struct RootView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var authScreen: AuthScreen = .signIn
    @State private var isSigningOut = false

    var body: some View {
        ZStack {
            GridBackground()

            switch authStore.state {
            case .loading:
                LoadingView()
            case .signedOut:
                signedOutView
            case let .signedIn(session):
                ProfileView(session: session, isSigningOut: isSigningOut) {
                    signOut()
                }
            case let .error(message):
                ErrorCard(message: message) {
                    authStore.start()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: authStore.state.isLoading)
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
        AuthCard(title: "Loading NeoGym", description: "Checking for a saved session…") {
            VStack(spacing: 14) {
                ProgressView()
                    .controlSize(.large)
                Text("Preparing your profile")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            .frame(maxWidth: .infinity)
        } footer: {
            EmptyView()
        }
    }
}

private struct ErrorCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        AuthCard(title: "Session error", description: "NeoGym couldn't load your saved session.") {
            FeedbackBanner(message: message)
            Button("Try again", action: retry)
                .buttonStyle(NeoGymPrimaryButtonStyle())
        } footer: {
            EmptyView()
        }
    }
}

#Preview {
    RootView()
        .environmentObject(AuthStore(authService: PreviewAuthService(), autoBootstrap: false))
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

    func signOut(refreshToken: String?) async throws {}

    func clearSession() async throws {}
}
