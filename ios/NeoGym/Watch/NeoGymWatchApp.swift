import CoreTransferable
import NeoGymKit
import SwiftUI
import UniformTypeIdentifiers

@main
struct NeoGymWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchEnergyBackgroundDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup { WatchHomeView(runtime: delegate.runtime) }
    }
}

private struct WatchHomeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var runtime: WatchEnergyRuntime
    @ObservedObject private var account: WatchAccountModel
    @StateObject private var signIn: SignInModel
    @State private var activity = WatchActivity()
    @State private var wasBackground = false

    init(runtime: WatchEnergyRuntime) {
        self.runtime = runtime
        _account = ObservedObject(wrappedValue: runtime.account)
        _signIn = StateObject(wrappedValue: SignInModel(authService: runtime.account.authStore.authService))
    }

    var body: some View {
        Group {
            if case .name = account.state {
                TabView {
                    energyPage
                    profilePage
                    eventsPage
                }
                .tabViewStyle(.page)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("NeoGym").font(.headline)
                        content
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
            }
        }
        .task { await runtime.bootstrap() }
        .onChange(of: scenePhase, initial: true) { _, phase in
            // A context delivery can launch the view already in the background.
            if phase == .background { wasBackground = true }
            if phase == .active, wasBackground {
                wasBackground = false
                if let context = runtime.connectivity.currentContext() { account.receiveContext(context) }
                // A read started in the background must not stand in for a fresh open.
                account.cancelPendingRead()
                account.refresh()
            }
        }
        .onChange(of: account.isReadingProfile, initial: true) { _, reading in
            if reading { activity.begin("read", onExpire: { account.cancelPendingRead() }) }
            else { activity.end("read") }
        }
        .onChange(of: account.state) { _, state in
            if state == .clearing { activity.begin("clear") }
            else { activity.end("clear") }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch account.state {
        case .awaitingLocalContext, .loading, .clearing:
            ProgressView(account.state == .clearing ? "Clearing watch session…" : "Opening NeoGym…")
        case .name:
            EmptyView() // Signed-in content uses the Energy/Profile/Events pages above.
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

    private var energyPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("Energy").font(.headline)
                    Text("(kcal)").font(.caption2).foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "fork.knife").font(.caption2)
                        Text(consumedText).font(.title3.bold())
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(runtime.snapshot == nil
                        ? "Consumed calories unavailable" : "Consumed \(consumedText) kilocalories")
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: "flame").font(.caption2)
                        Text(burnedText).font(.title3.bold())
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(runtime.snapshot?.burnedKcal == nil
                        ? "Burned calories unavailable" : "Burned \(burnedText) kilocalories")
                }
                HStack(spacing: 4) {
                    Image(systemName: "scalemass").font(.caption2)
                    Text(netText).font(.title3.bold())
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(runtime.snapshot?.netKcal == nil
                    ? "Net calories unavailable" : "Net \(netText) kilocalories")
                HStack(spacing: 6) {
                    Text("Active \(activeText)")
                    Spacer(minLength: 0)
                    Text("Resting \(restingText)")
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(breakdownAccessibilityText)
                HStack(spacing: 6) {
                    Button { Task { await runtime.refresh(trigger: .manual) } } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.caption)
                            .frame(width: 32, height: 32)
                            .background(.thinMaterial, in: Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(runtime.isRefreshing || !runtime.contextReady
                        || account.isReadingProfile || account.profileError != nil)
                    .accessibilityLabel("Refresh energy")
                    if let snapshot = runtime.snapshot {
                        Text("Synced \(snapshot.updatedAt, style: .time)")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                if !runtime.healthEnabled {
                    Button("Sync Apple Health") { Task { await runtime.enableHealth() } }
                        .disabled(!runtime.contextReady || account.isReadingProfile
                            || account.profileError != nil)
                    Text("Allow active and resting energy on this watch. NeoGym only reads Health data.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                if let error = runtime.errorMessage {
                    Text(error).font(.caption2).foregroundStyle(.red)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private var consumedText: String {
        runtime.snapshot.map { $0.consumedKcal.formatted(.number.precision(.fractionLength(0))) } ?? "—"
    }

    private var burnedText: String {
        runtime.snapshot?.burnedKcal.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "—"
    }

    private var activeText: String {
        runtime.snapshot?.activeKcal.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "—"
    }

    private var restingText: String {
        runtime.snapshot?.restingKcal.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "—"
    }

    private var netText: String {
        guard let net = runtime.snapshot?.netKcal else { return "—" }
        let formatted = net.formatted(.number.precision(.fractionLength(0)))
        return net > 0 ? "+\(formatted)" : formatted
    }

    private var breakdownAccessibilityText: String {
        let active = runtime.snapshot?.activeKcal == nil
            ? "Active energy unavailable" : "Active \(activeText) kilocalories"
        let resting = runtime.snapshot?.restingKcal == nil
            ? "Resting energy unavailable" : "Resting \(restingText) kilocalories"
        return "\(active), \(resting)"
    }

    private var profilePage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Profile").font(.headline)
                Text(account.currentUser?.displayName ?? "Athlete").font(.title3.bold())
                Text(account.currentUser?.email ?? "No email available")
                    .font(.caption).foregroundStyle(.secondary)
                if let error = account.profileError {
                    Text(error).font(.caption2).foregroundStyle(.secondary)
                    Button("Retry profile") { account.refresh() }
                }
                signOutButton
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private var eventsPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                Text("Events").font(.headline)
                Text("Saved on this watch. Requested or accepted does not mean WidgetKit displayed new data.")
                    .font(.caption2).foregroundStyle(.secondary)
                ShareLink(item: WatchEventsFile(events: runtime.events),
                          preview: SharePreview("NeoGym Watch events")) {
                    Label("Share logs", systemImage: "square.and.arrow.up")
                }
                .accessibilityHint("Choose a destination in the system share sheet; nothing is sent automatically.")
                if runtime.events.isEmpty {
                    Text("No events yet.").font(.caption).foregroundStyle(.secondary)
                }
                ForEach(runtime.events) { event in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 4) {
                            Image(systemName: eventSymbol(event.outcome))
                                .foregroundStyle(eventColor(event.outcome))
                            Text(event.action.title).font(.caption.bold())
                        }
                        Text(event.outcome.title + (event.trigger.map { " · \($0.title)" } ?? ""))
                            .font(.caption2)
                        if let details = event.failureDetails {
                            Text(details).font(.caption2).foregroundStyle(.secondary)
                        }
                        Text(event.occurredAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(7)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 9))
                    .accessibilityElement(children: .combine)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private func eventSymbol(_ outcome: WatchEventOutcome) -> String {
        switch outcome {
        case .failed: "xmark.circle.fill"
        case .succeeded: "checkmark.circle.fill"
        case .accepted, .finished: "checkmark.circle"
        case .started, .requested, .skipped: "clock"
        }
    }

    private func eventColor(_ outcome: WatchEventOutcome) -> Color {
        switch outcome {
        case .failed: .red
        case .succeeded: .green
        case .started, .accepted, .requested, .finished, .skipped: .secondary
        }
    }

    private var signOutButton: some View {
        Button("Sign out", role: .destructive) {
            activity.perform("signOut", cancelOnExpire: false) {
                await runtime.signOut()
                signIn.reset()
                signIn.email = ""
            }
        }
    }
}

/// FileRepresentation preserves the .txt attachment instead of sharing a URL string.
/// The file is generated only when the user initiates a share.
private struct WatchEventsFile: Transferable {
    let events: [WatchEvent]

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .plainText) { item in
            SentTransferredFile(try WatchEventExport.write(events: item.events))
        }
    }
}
