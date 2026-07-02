import NeoGymKit
import Nhost
import SwiftUI

struct ProfileView: View {
    let session: StoredSession
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var isShowingChangeEmail = false

    var body: some View {
        ScrollView {
            VStack(spacing: NeoGymTheme.spacingXL) {
                accountHeader
                profileCard
                settingsCard
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $isShowingChangeEmail) {
            if let changeEmailModel, let profile {
                ChangeEmailSheet(
                    model: changeEmailModel,
                    currentEmailDisplay: profile.emailDisplay,
                    dismiss: { isShowingChangeEmail = false }
                )
            }
        }
    }

    private var accountHeader: some View {
        HStack(alignment: .center, spacing: NeoGymTheme.spacingMD) {
            if let profile {
                avatar(profile: profile)

                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                    Text("Account")
                        .font(.caption.weight(.bold))
                        .tracking(1.4)
                        .foregroundColor(NeoGymTheme.mutedText)
                    Text(profile.displayName)
                        .font(.system(.title2, design: .rounded).weight(.bold))
                        .tracking(-0.4)
                    Text(profile.emailDisplay)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(2)
                }
            } else {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                    Text("Account")
                        .font(.caption.weight(.bold))
                        .tracking(1.4)
                        .foregroundColor(NeoGymTheme.mutedText)
                    Text("Signed in")
                        .font(.system(.title2, design: .rounded).weight(.bold))
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var profileCard: some View {
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
            VStack(alignment: .leading, spacing: 18) {
                if let profile {
                    HStack(alignment: .center, spacing: NeoGymTheme.spacingSM) {
                        Label("Profile details", systemImage: "person.text.rectangle.fill")
                            .font(.headline)
                        Spacer(minLength: 0)
                        Button {
                            isShowingChangeEmail = true
                        } label: {
                            Label("Change email", systemImage: "pencil")
                                .font(.caption.weight(.semibold))
                                .labelStyle(.titleAndIcon)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .glassSurface(
                                    cornerRadius: NeoGymTheme.radiusPill,
                                    material: .ultraThin,
                                    tint: NeoGymTheme.glassSubtleFill,
                                    shadow: false
                                )
                        }
                        .buttonStyle(.plain)
                        .foregroundColor(.primary)
                        .frame(minHeight: 44)
                        .accessibilityLabel("Change email")
                        .disabled(changeEmailModel == nil)
                    }

                    GlassDivider()

                    DetailRow(label: "Email") { Text(profile.emailDisplay) }
                    DetailRow(label: "Locale") { Text(profile.locale) }
                    DetailRow(label: "Default role") { Text(profile.defaultRole) }
                    DetailRow(label: "User ID") {
                        Text(profile.id)
                            .font(.caption.monospaced())
                            .padding(.horizontal, 7)
                            .padding(.vertical, 4)
                            .glassSurface(
                                cornerRadius: NeoGymTheme.radiusSM,
                                material: .ultraThin,
                                tint: NeoGymTheme.glassSubtleFill,
                                shadow: false
                            )
                    }
                    DetailRow(label: "Member since") { Text(profile.memberSince) }
                } else {
                    FeedbackBanner(
                        message: "Your session is active, but the profile payload is missing. "
                            + "Sign out and sign in again if this persists.",
                        tone: .info
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var settingsCard: some View {
        GlassPanel(
            cornerRadius: NeoGymTheme.radiusXXL,
            material: .regular,
            tint: NeoGymTheme.glassFill,
            contentPadding: EdgeInsets(
                top: NeoGymTheme.spacingXL,
                leading: NeoGymTheme.spacingXL,
                bottom: NeoGymTheme.spacingXL,
                trailing: NeoGymTheme.spacingXL
            )
        ) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Settings")
                    .font(.headline)
                GlassDivider()
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
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var profile: UserProfile? {
        session.user.map { UserProfile(user: $0) }
    }

    private func avatar(profile: UserProfile) -> some View {
        ZStack {
            Circle()
                .fill(NeoGymTheme.accentSoft)
            Text(profile.initials)
                .font(.title3.bold())
                .foregroundColor(.primary)
        }
        .frame(width: 64, height: 64)
        .overlay(Circle().stroke(NeoGymTheme.glassStrokeSecondary))
        .shadow(color: NeoGymTheme.glassAmbientShadow, radius: 18, y: 8)
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

#Preview("Profile") {
    ScreenScaffold {
        ProfileView(
            session: NeoGymPreviewFixtures.session,
            isSigningOut: false,
            changeEmailModel: nil,
            signOut: {}
        )
    }
}

#Preview("Profile · Dark") {
    ScreenScaffold {
        ProfileView(
            session: NeoGymPreviewFixtures.session,
            isSigningOut: false,
            changeEmailModel: nil,
            signOut: {}
        )
    }
    .preferredColorScheme(.dark)
}
