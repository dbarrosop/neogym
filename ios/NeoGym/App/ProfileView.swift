import NeoGymKit
import Nhost
import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var phoneConnectivity: PhoneAccountConnectivity
    let session: StoredSession
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var isShowingChangeEmail = false
    @State private var isShowingWatchSignIn = false
    @State private var isShowingAgentAccess = false
    @State private var isConfirmingSignOut = false
    @AppStorage(AppAppearance.storageKey) private var appearanceRawValue = AppAppearance.defaultValue.rawValue
    @AppStorage(RestTimerPreference.storageKey) private var restSeconds = RestTimerPreference.defaultSeconds

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                profileHeader
                group("Account") {
                    SettingsRow(title: "Change email", systemImage: "envelope", value: profile?.emailDisplay) {
                        isShowingChangeEmail = true
                    }
                    .disabled(changeEmailModel == nil)
                    RowSeparator(leadingInset: 60)
                    SettingsRow(title: "Member since", systemImage: "calendar", value: profile?.memberSince)
                }
                group("Connections") {
                    SettingsRow(title: "Apple Health", systemImage: "heart.fill", iconTint: NeoGymTheme.health, value: "Workouts, Body")
                    RowSeparator(leadingInset: 60)
                    SettingsRow(title: "Apple Watch", systemImage: "applewatch", value: watchStatus) {
                        phoneConnectivity.clearPresentedSuccess()
                        isShowingWatchSignIn = true
                    }
                    .disabled(isSigningOut)
                    RowSeparator(leadingInset: 60)
                    SettingsRow(title: "Connect an agent (MCP)", systemImage: "point.3.connected.trianglepath.dotted") {
                        isShowingAgentAccess = true
                    }
                }
                Text("Apple Health access is read-only. NeoGym imports workouts and body measurements on this iPhone; your Apple Watch imports energy.")
                    .font(.caption)
                    .foregroundStyle(NeoGymTheme.textTertiary)
                    .padding(.horizontal, NeoGymTheme.spacingXXS)
                group("Appearance") {
                    Picker("Appearance", selection: $appearanceRawValue) {
                        ForEach(AppAppearance.allCases) { appearance in
                            Text(appearance.title).tag(appearance.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(NeoGymTheme.spacingSM)
                }
                group("Default rest", footer: "Starts after each logged set.") {
                    Picker("Default rest", selection: $restSeconds) {
                        ForEach(RestTimerPreference.presets, id: \.self) { seconds in
                            Text(RestTimerPreference.title(seconds: seconds)).tag(seconds)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(NeoGymTheme.spacingSM)
                }
                signOutButton
                    .padding(.top, NeoGymTheme.spacingXS)
                if let profile {
                    Text("User ID \(profile.id)")
                        .font(.caption.monospaced())
                        .foregroundStyle(NeoGymTheme.textTertiary)
                        .textSelection(.enabled)
                        .padding(.horizontal, NeoGymTheme.spacingXXS)
                }
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
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
            PhoneWatchSignInSheet(connectivity: phoneConnectivity)
        }
        .sheet(isPresented: $isShowingAgentAccess) {
            AgentAccessSheet(url: AgentAccess.productionMCPURL)
        }
        .confirmationDialog("Sign out of NeoGym?", isPresented: $isConfirmingSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive, action: signOut)
            Button("Cancel", role: .cancel) {}
        }
        .onAppear { phoneConnectivity.expireAttempt() }
    }

    private var profile: UserProfile? {
        session.user.map { UserProfile(user: $0) }
    }

    private var watchStatus: String {
        if phoneConnectivity.connected { return "Connected" }
        if phoneConnectivity.pending != nil { return "Request waiting" }
        return "Connect"
    }

    private var profileHeader: some View {
        HStack(spacing: 14) {
            Text(profile?.initials ?? "?")
                .font(.title2.weight(.bold))
                .foregroundStyle(NeoGymTheme.accentText)
                .frame(width: 56, height: 56)
                .background(Circle().fill(NeoGymTheme.accentSoft))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(profile?.displayName ?? "Signed in")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(NeoGymTheme.text)
                Text(profile.map { "\($0.emailDisplay) · signs in with an email code" } ?? "Signs in with an email code")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(NeoGymTheme.spacingMD)
        .cardSurface()
        .accessibilityElement(children: .combine)
    }

    private var signOutButton: some View {
        Button {
            isConfirmingSignOut = true
        } label: {
            Group {
                if isSigningOut {
                    HStack(spacing: NeoGymTheme.spacingXS) {
                        ProgressView()
                        Text("Signing out")
                    }
                } else {
                    Text("Sign out")
                }
            }
            .font(.body)
            .foregroundStyle(NeoGymTheme.destructive)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous).fill(NeoGymTheme.surface))
        }
        .buttonStyle(.plain)
        .disabled(isSigningOut)
    }

    private func group<Content: View>(
        _ title: String,
        footer: String? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NeoGymTheme.textSecondary)
                .padding(.horizontal, NeoGymTheme.spacingXXS)
                .padding(.top, NeoGymTheme.spacingXS)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) { content() }
                .cardSurface()
            if let footer {
                Text(footer)
                    .font(.caption)
                    .foregroundStyle(NeoGymTheme.textTertiary)
                    .padding(.horizontal, NeoGymTheme.spacingXXS)
            }
        }
    }
}

/// Settings-style row: icon tile, title, trailing value and a chevron when it acts.
private struct SettingsRow: View {
    let title: String
    let systemImage: String
    var iconTint: Color = NeoGymTheme.accentText
    var value: String?
    var action: (() -> Void)?

    var body: some View {
        if let action {
            Button(action: action) { label(showsChevron: true) }
                .buttonStyle(.plain)
        } else {
            label(showsChevron: false)
        }
    }

    private func label(showsChevron: Bool) -> some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(iconTint)
                .frame(width: 32, height: 32)
                .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(NeoGymTheme.fill))
                .accessibilityHidden(true)
            Text(title)
                .font(.body)
                .foregroundStyle(NeoGymTheme.text)
            Spacer(minLength: NeoGymTheme.spacingXS)
            if let value {
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingSM)
        .frame(minHeight: 52)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// The MCP endpoint, with copy, for Claude, Cursor or any MCP client.
private struct AgentAccessSheet: View {
    let url: String
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) {
                Text("Point Claude, Cursor or any MCP client at this URL to log workouts and query your data.")
                    .font(.subheadline)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Text(url)
                    .font(.footnote.monospaced())
                    .foregroundStyle(NeoGymTheme.text)
                    .textSelection(.enabled)
                    .padding(NeoGymTheme.spacingSM)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(cornerRadius: NeoGymTheme.radiusSM, fill: NeoGymTheme.fill)
                Button {
                    UIPasteboard.general.string = url
                    copied = true
                } label: {
                    Label(copied ? "Copied" : "Copy URL", systemImage: copied ? "checkmark" : "doc.on.doc")
                }
                .buttonStyle(NeoGymPrimaryButtonStyle())
                .accessibilityLabel(copied ? "MCP URL copied" : "Copy MCP URL")
                Spacer()
            }
            .padding(NeoGymTheme.screenHorizontalPadding)
            .navigationTitle("Agent access (MCP)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

private struct PhoneWatchSignInSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var connectivity: PhoneAccountConnectivity

    var body: some View {
        NavigationStack {
            Form {
                Section("Connect your watch") {
                    Text("On your Apple Watch, tap Connect using iPhone. Keep NeoGym open on both devices.")
                    if connectivity.connected {
                        Text("Apple Watch connected successfully.")
                    } else if connectivity.pending != nil {
                        Text("Your iPhone will create a watch sign-in credential that can restore its session without another code. It expires after 90 days.")
                            .foregroundStyle(NeoGymTheme.textSecondary)
                        Button(connectivity.isSending ? "Connecting…" : "Connect watch") {
                            Task { await connectivity.connect() }
                        }
                        .disabled(connectivity.isSending)
                    } else {
                        Text("Waiting for a request from your watch…")
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                }
                if let error = connectivity.errorMessage {
                    Section { Text(error).foregroundStyle(NeoGymTheme.destructive) }
                }
            }
            .navigationTitle("Connect Apple Watch")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear { connectivity.expireAttempt() }
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
    .environmentObject(PhoneAccountConnectivity(patService: NhostWatchPATService(client: NhostClientFactory.makeClient())))
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
    .environmentObject(PhoneAccountConnectivity(patService: NhostWatchPATService(client: NhostClientFactory.makeClient())))
}
