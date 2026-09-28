import NeoGymKit
import SwiftUI

@main
struct NeoGymWatchApp: App {
    var body: some Scene {
        WindowGroup { WatchHomeView() }
    }
}

private struct WatchHomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var account: WatchAccountModel
    @StateObject private var signIn: SignInModel
    @State private var connectivity = WatchAccountConnectivity()
    @State private var activity = WatchActivity()
    @State private var wasBackground = false

    init() {
        let account = WatchAccountModel.production()
        _account = StateObject(wrappedValue: account)
        _signIn = StateObject(wrappedValue: SignInModel(authService: account.authStore.authService))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("NeoGym").font(.headline)
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .task {
            connectivity.onContext = { account.receiveContext($0) }
            account.localContextReady(await connectivity.activate())
            await account.bootstrap()
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            // A context delivery can launch the view already in the background.
            if phase == .background { wasBackground = true }
            if phase == .active, wasBackground {
                wasBackground = false
                if let context = connectivity.currentContext() { account.receiveContext(context) }
                // A read started in the background must not stand in for a fresh open.
                account.cancelPendingRead()
                account.refresh()
            }
        }
        .onChange(of: account.state) { _, state in
            if state == .loading {
                activity.begin("read", onExpire: { account.cancelPendingRead() })
            } else {
                activity.end("read")
            }
            if state == .clearing { activity.begin("clear") }
            else { activity.end("clear") }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch account.state {
        case .awaitingLocalContext, .loading, .clearing:
            ProgressView(account.state == .clearing ? "Clearing watch session…" : "Loading account…")
        case .name(let name):
            Text(name).font(.title3.bold()).accessibilityAddTraits(.isHeader)
            Button("Refresh") { account.refresh() }
            signOutButton
        case .signedOut, .matchPhone, .reauthenticate:
            if account.state == .matchPhone { Text("Sign in to match your iPhone account.") }
            else if account.state == .reauthenticate { Text("Session expired. Sign in again.") }
            else { Text("Sign in to your existing account.") }
            otpForm
        case .phoneSignedOut:
            Text("Signed out on iPhone. Sign in there to use NeoGym on this watch.")
        case .networkError:
            Text("Network unavailable. Check the watch connection and retry.")
            Button("Retry") { account.refresh() }
            signOutButton
        case .authError:
            Text("Authentication failed. Retry or sign out of this watch.")
            Button("Retry") { account.refresh() }
            signOutButton
        case .error(let message):
            Text("Session error: \(message)")
            Button("Retry") { Task { await account.bootstrap() } }
            signOutButton
        }
    }

    private var otpForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            if signIn.sentTo == nil {
                TextField("Email", text: $signIn.email)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Email address")
                Button(signIn.isSending ? "Sending…" : "Send code") {
                    activity.perform("auth") { await signIn.requestCode() }
                }
                .disabled(signIn.isSending)
            } else {
                Text("Code sent to \(signIn.sentTo ?? "")")
                    .font(.caption)
                TextField("6-digit code", text: $signIn.otp)
                    .textContentType(.oneTimeCode)
                    .onChange(of: signIn.otp) { _, value in signIn.updateOTP(value) }
                    .accessibilityLabel("Six-digit email code")
                Button(signIn.isVerifying ? "Verifying…" : "Verify") {
                    activity.perform("auth") {
                        let session = await signIn.verifyCode()
                        if let session {
                            account.acceptVerifiedSession(session)
                            signIn.reset()
                            signIn.email = ""
                        }
                    }
                }
                .disabled(signIn.isVerifying || signIn.otp.count != 6)
                Button("Change email") { signIn.reset() }
            }
            if let error = signIn.errorMessage { Text(error).foregroundStyle(.red).font(.caption) }
        }
    }

    private var signOutButton: some View {
        Button("Sign out", role: .destructive) {
            activity.perform("signOut", cancelOnExpire: false) {
                await account.signOut()
                signIn.reset()
                signIn.email = ""
            }
        }
    }
}
