import NeoGymKit
import Nhost
import SwiftUI

struct ProfileView: View {
    let session: StoredSession
    let isSigningOut: Bool
    let signOut: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                profileCard
                settingsCard
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, 20)
            .padding(.vertical, 40)
            .frame(maxWidth: .infinity)
        }
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let profile {
                HStack(spacing: 16) {
                    avatar(profile: profile)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(profile.displayName)
                            .font(.title2.bold())
                            .tracking(-0.4)
                        Text(profile.emailDisplay)
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                }

                Divider()

                DetailRow(label: "Email") {
                    HStack(spacing: 8) {
                        Text(profile.emailDisplay)
                        Button {
                            // Phase 3 wires the native PKCE email-change flow.
                        } label: {
                            Image(systemName: "pencil")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .accessibilityLabel("Change email")
                        .disabled(true)
                    }
                }
                DetailRow(label: "Locale") { Text(profile.locale) }
                DetailRow(label: "Default role") { Text(profile.defaultRole) }
                DetailRow(label: "User ID") {
                    Text(profile.id)
                        .font(.caption.monospaced())
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                }
                DetailRow(label: "Member since") { Text(profile.memberSince) }
            } else {
                FeedbackBanner(
                    message: "Your session is active, but the profile payload is missing. Sign out and sign in again if this persists.",
                    tone: .info
                )
            }
        }
        .cardContainer()
    }

    private var settingsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings")
                .font(.headline)
            Divider()
            Button {
                signOut()
            } label: {
                if isSigningOut {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Signing out")
                    }
                } else {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
            .buttonStyle(NeoGymSecondaryButtonStyle())
            .disabled(isSigningOut)
        }
        .cardContainer()
    }

    private var profile: UserProfile? {
        session.user.map { UserProfile(user: $0) }
    }

    private func avatar(profile: UserProfile) -> some View {
        ZStack {
            Circle()
                .fill(NeoGymTheme.mutedFill)
            Text(profile.initials)
                .font(.title3.bold())
                .foregroundColor(.primary)
        }
        .frame(width: 64, height: 64)
        .overlay(Circle().stroke(NeoGymTheme.border))
    }
}

private struct DetailRow<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
            Spacer(minLength: 12)
            content
                .font(.subheadline.weight(.medium))
                .multilineTextAlignment(.trailing)
        }
    }
}

private extension View {
    func cardContainer() -> some View {
        padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(NeoGymTheme.border)
            )
            .shadow(color: Color.accentColor.opacity(0.06), radius: 24, y: 12)
    }
}
