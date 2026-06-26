import NeoGymKit
import Nhost
import SwiftUI

struct RootView: View {
    @EnvironmentObject private var authStore: AuthStore

    var body: some View {
        ZStack {
            BackgroundView()

            switch authStore.state {
            case .loading:
                LoadingView()
            case .signedOut:
                SignedOutPlaceholderView()
            case let .signedIn(session):
                SignedInPlaceholderView(session: session) {
                    Task {
                        await authStore.signOut()
                    }
                }
            case let .error(message):
                ErrorPlaceholderView(message: message) {
                    authStore.start()
                }
            }
        }
    }
}

private struct BackgroundView: View {
    var body: some View {
        LinearGradient(
            colors: [
                Color(.systemBackground),
                Color(.secondarySystemBackground),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
        .overlay(alignment: .topTrailing) {
            Circle()
                .fill(Color.accentColor.opacity(0.18))
                .blur(radius: 80)
                .frame(width: 260, height: 260)
                .offset(x: 120, y: -120)
        }
        .overlay(alignment: .bottomLeading) {
            Circle()
                .fill(Color.purple.opacity(0.12))
                .blur(radius: 90)
                .frame(width: 300, height: 300)
                .offset(x: -150, y: 150)
        }
    }
}

private struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
            Text("Loading NeoGym")
                .font(.headline)
            Text("Checking for a saved session…")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: 320)
        .padding(28)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(.quaternary)
        )
        .shadow(color: .black.opacity(0.08), radius: 24, y: 12)
        .padding()
    }
}

private struct SignedOutPlaceholderView: View {
    var body: some View {
        VStack(spacing: 18) {
            Text("NeoGym")
                .font(.largeTitle.bold())
            Text("Native iOS auth is being ported in phases.")
                .font(.headline)
                .multilineTextAlignment(.center)
            Text(
                "Sign-in and sign-up forms arrive next. "
                    + "For now this shell proves that persisted sessions load before protected content is chosen."
            )
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: 360)
        .padding(28)
        .background(Color(.systemBackground).opacity(0.88), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.primary.opacity(0.08))
        )
        .shadow(color: .black.opacity(0.08), radius: 30, y: 16)
        .padding()
    }
}

private struct SignedInPlaceholderView: View {
    let session: StoredSession
    let signOut: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Text("Protected shell")
                .font(.largeTitle.bold())
            Text(displayName)
                .font(.title3.weight(.semibold))
            Text(email)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Profile details and OTP auth are implemented in the next phase.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Sign out", action: signOut)
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: 360)
        .padding(28)
        .background(Color(.systemBackground).opacity(0.9), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.primary.opacity(0.08))
        )
        .shadow(color: .black.opacity(0.08), radius: 30, y: 16)
        .padding()
    }

    private var displayName: String {
        guard let user = session.user, !user.displayName.isEmpty else {
            return "Signed-in athlete"
        }

        return user.displayName
    }

    private var email: String {
        session.user?.email ?? "Session is active"
    }
}

private struct ErrorPlaceholderView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("Session error")
                .font(.title.bold())
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry)
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: 340)
        .padding(28)
        .background(Color(.systemBackground).opacity(0.9), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding()
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

    func signOut(refreshToken: String?) async throws {}

    func clearSession() async throws {}
}
