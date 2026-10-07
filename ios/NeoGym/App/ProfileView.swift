import NeoGymKit
import Nhost
import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var phoneConnectivity: PhoneAccountConnectivity
    let session: StoredSession
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var isShowingChangeEmail = false
    @State private var isShowingWatchSignIn = false

    var body: some View {
        ScrollView {
            VStack(spacing: NeoGymTheme.spacingXL) {
                accountHeader
                profileCard
                settingsCard
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding)
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
        .sheet(isPresented: $isShowingWatchSignIn, onDismiss: {
            phoneConnectivity.clearPresentedSuccess()
        }) {
            PhoneWatchSignInSheet(connectivity: phoneConnectivity,
                                  authService: authStore.authService)
        }
        .onAppear { phoneConnectivity.expireAttempt() }
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
                    phoneConnectivity.clearPresentedSuccess()
                    isShowingWatchSignIn = true
                } label: {
                    Label(phoneConnectivity.pending == nil ? "Connect Apple Watch" : "Finish watch sign-in",
                          systemImage: "applewatch")
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSigningOut)
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

private struct PhoneWatchSignInSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var connectivity: PhoneAccountConnectivity
    let authService: any AuthServicing
    @State private var otp = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Connect your watch") {
                    Text("On your Apple Watch, tap Sign in using iPhone. Keep NeoGym open on both devices.")
                    if connectivity.verificationSucceeded {
                        Text("Apple Watch signed in successfully.")
                    } else if connectivity.pending != nil {
                        Text("Watch request received. An email code will create a separate watch session; your iPhone stays signed in.")
                            .foregroundStyle(.secondary)
                        Button(connectivity.codeRequested ? "Resend to watch" : "Email sign-in code") {
                            Task { await connectivity.requestCode(using: authService) }
                        }
                        .disabled(connectivity.isSendingCode)
                    } else {
                        Text("Waiting for a request from your watch…")
                            .foregroundStyle(.secondary)
                    }
                }
                if connectivity.codeRequested, !connectivity.verificationSucceeded {
                    Section("Email code") {
                        TextField("6-digit code", text: $otp)
                            .textContentType(.oneTimeCode)
                            .keyboardType(.numberPad)
                            .onChange(of: otp) { _, value in
                                otp = String(value.filter(\.isNumber).prefix(6))
                            }
                        Button(connectivity.codeSent ? "Send code again" : "Verify on watch") {
                            connectivity.sendCode(otp)
                        }
                        .disabled(otp.count != 6)
                        Text("The watch verifies this code directly. No iPhone session or refresh token is copied.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                if let error = connectivity.errorMessage {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Connect Apple Watch")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear { connectivity.expireAttempt() }
            .onChange(of: connectivity.pending?.id) { _, _ in otp = "" }
            .onChange(of: connectivity.verificationSucceeded) { _, succeeded in
                if succeeded { otp = "" }
            }
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
    .environmentObject(AuthStore(authService: NeoGymPreviewAuthService(), autoBootstrap: false))
    .environmentObject(PhoneAccountConnectivity())
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
    .environmentObject(AuthStore(authService: NeoGymPreviewAuthService(), autoBootstrap: false))
    .environmentObject(PhoneAccountConnectivity())
}
