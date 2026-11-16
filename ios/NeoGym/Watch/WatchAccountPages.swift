import CoreTransferable
import NeoGymKit
import SwiftUI
import UniformTypeIdentifiers

/// Page 3: who is signed in, Health access, Sign out. The diagnostics page appears
/// only with Debug mode on (a watch-only setting), behind this page.
struct WatchAccountPage: View {
    static let debugModeKey = "watchDebugMode.v1"

    @ObservedObject var runtime: WatchEnergyRuntime
    @ObservedObject var account: WatchAccountModel
    let actions: WatchAccountActions
    @AppStorage(Self.debugModeKey) private var debugMode = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Text(initial)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(WatchPalette.accentSoftText)
                        .frame(width: 36, height: 36)
                        .background(WatchPalette.accentSoft, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(name)
                            .font(.system(size: 16, weight: .semibold))
                            .lineLimit(1)
                        Text("Signed in from iPhone")
                            .font(WatchType.small)
                            .foregroundStyle(WatchPalette.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
                HStack(spacing: 8) {
                    Image(systemName: "heart.fill")
                        .foregroundStyle(WatchPalette.health)
                        .accessibilityHidden(true)
                    Text(runtime.healthEnabled ? "Health · read only" : "Health · not allowed")
                }
                .font(WatchType.caption)
                .foregroundStyle(WatchPalette.textSecondary)
                if let error = account.profileError {
                    WatchNote(text: error)
                    Button("Retry profile") { account.refresh() }
                        .buttonStyle(.watchCapsule())
                    if account.hasRestorablePAT {
                        Button("Restore saved sign-in") { actions.restoreSavedSignIn() }
                            .buttonStyle(.watchCapsule())
                            .disabled(account.isRecovering)
                    }
                }
                Button("Sign out", role: .destructive) { actions.signOut() }
                    .buttonStyle(.watchCapsule(.destructive))
                Toggle("Debug mode", isOn: $debugMode)
                    .font(WatchType.caption)
                    .foregroundStyle(WatchPalette.textSecondary)
                if debugMode {
                    NavigationLink("Diagnostics") {
                        WatchDiagnosticsPage(runtime: runtime)
                            .navigationTitle("Diagnostics")
                    }
                    .font(WatchType.caption)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
        }
    }

    private var name: String { account.currentUser?.displayName ?? "Athlete" }

    private var initial: String {
        name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() } ?? "N"
    }
}

/// Not signed in: connect from the iPhone, restore a saved sign-in, or wait while the
/// session opens or clears.
struct WatchConnectionView: View {
    @ObservedObject var runtime: WatchEnergyRuntime
    @ObservedObject var account: WatchAccountModel
    @ObservedObject var assisted: WatchAssistedSignInModel
    let actions: WatchAccountActions

    var body: some View {
        switch account.state {
        case .awaitingLocalContext, .loading, .clearing, .name:
            ProgressView(account.state == .clearing ? "Clearing watch session…" : "Opening NeoGym…")
        case .signedOut, .matchPhone:
            WatchMessageView(title: "Connect your iPhone", message: "On iPhone: Me › Account › Apple Watch.") {
                devicesIcon
            } actions: {
                if account.isRecovering { ProgressView("Restoring session…") }
                connectButton
                assistedStatus
            }
        case .reauthenticate, .authError:
            WatchMessageView(
                title: account.state == .reauthenticate ? "Sign in again" : "Couldn't sign in",
                message: "Reconnect from your iPhone or restore the saved sign-in."
            ) {
                devicesIcon
            } actions: {
                if account.isRecovering { ProgressView("Restoring session…") }
                if account.assistedSignInUserID != nil { connectButton }
                if account.hasRestorablePAT {
                    Button("Restore saved sign-in") { actions.restoreSavedSignIn() }
                        .buttonStyle(.watchCapsule(account.assistedSignInUserID == nil ? .primary : .secondary))
                        .disabled(account.isRecovering)
                }
                assistedStatus
                // Erase a retained PAT even when no SDK session remains.
                Button("Sign out", role: .destructive) { actions.signOut() }
                    .buttonStyle(.watchCapsule(.destructive))
            }
        case .phoneSignedOut:
            WatchMessageView(title: "Signed out on iPhone",
                             message: "Sign in there to use NeoGym on this watch.") {
                Image(systemName: "iphone").font(.system(size: 24))
            } actions: {
                EmptyView()
            }
        case .error:
            // Replaces the old session-error text; Events keep the safe cause.
            WatchMessageView(title: "Connect your iPhone", message: "On iPhone: Me › Account › Apple Watch.") {
                devicesIcon
            } actions: {
                Button("Try again") { Task { await account.bootstrap() } }
                    .buttonStyle(.watchCapsule(.primary))
                Button("Sign out", role: .destructive) { actions.signOut() }
                    .buttonStyle(.watchCapsule(.destructive))
            }
        }
    }

    private var devicesIcon: some View {
        HStack(spacing: 4) {
            Image(systemName: "iphone")
            Image(systemName: "applewatch")
        }
        .font(.system(size: 22))
    }

    /// Asks the signed-in iPhone for a watch sign-in once it is known; until then,
    /// Try again re-reads the latest phone account hint.
    @ViewBuilder
    private var connectButton: some View {
        if account.assistedSignInUserID != nil {
            Button("Connect") { assisted.start() }
                .buttonStyle(.watchCapsule(.primary))
                .disabled(assisted.isConnecting || account.isRecovering)
        } else {
            Button("Try again") {
                if let context = runtime.connectivity.currentContext() { account.receiveContext(context) }
            }
            .buttonStyle(.watchCapsule(.primary))
        }
    }

    @ViewBuilder
    private var assistedStatus: some View {
        if let status = assisted.status {
            Text(status)
                .font(WatchType.small)
                .foregroundStyle(WatchPalette.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Debug-only diagnostics: the saved watch events, widget provider receipts and the
/// share sheet export. The content and safety rules are unchanged from the former
/// Events page.
struct WatchDiagnosticsPage: View {
    @ObservedObject var runtime: WatchEnergyRuntime
    @State private var widgetReceipts: [WatchWidgetProviderReceipt] = []

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 9) {
                Text("Saved on this watch. Requested or accepted does not mean WidgetKit displayed new data.")
                    .font(.caption2).foregroundStyle(.secondary)
                ShareLink(item: WatchEventsFile(events: runtime.events),
                          preview: SharePreview("NeoGym Watch events")) {
                    Label("Share logs", systemImage: "square.and.arrow.up")
                }
                .accessibilityHint(
                    "Choose a destination in the system share sheet; nothing is sent automatically. "
                        + "The logs are attached as a text file."
                )
                Button("Read widget receipts") {
                    widgetReceipts = WatchWidgetProviderReceiptStore.shared.load()
                }
                .font(.caption2)
                if !WatchWidgetProviderReceiptStore.shared.isAvailable {
                    Text("Widget diagnostics container unavailable.")
                        .font(.caption2).foregroundStyle(.secondary)
                } else if widgetReceipts.isEmpty {
                    Text("No widget provider receipts recorded yet.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                ForEach(Array(widgetReceipts.suffix(6).reversed())) { receipt in
                    let source = receipt.snapshotUpdatedAt.map {
                        "snapshot \($0.formatted(date: .omitted, time: .shortened))"
                    } ?? "no snapshot"
                    Text("Widget \(receipt.request.rawValue) · \(source) · "
                         + receipt.requestedAt.formatted(date: .omitted, time: .shortened))
                        .font(.caption2).foregroundStyle(.secondary)
                }
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
                        if let details = event.diagnosticDetails {
                            Text(details).font(.caption2).foregroundStyle(.secondary)
                        }
                        Text(event.occurredAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(7)
                    .background(WatchPalette.card, in: RoundedRectangle(cornerRadius: 9))
                    .accessibilityElement(children: .combine)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onAppear { widgetReceipts = WatchWidgetProviderReceiptStore.shared.load() }
    }

    private func eventSymbol(_ outcome: WatchEventOutcome) -> String {
        switch outcome {
        case .failed, .timedOut, .expired: "xmark.circle.fill"
        case .succeeded: "checkmark.circle.fill"
        case .accepted, .received, .finished, .acknowledged: "checkmark.circle"
        case .started, .entered, .requested, .joined, .skipped: "clock"
        }
    }

    /// Diagnostics keep failure/success colours; this page is a debug tool, not product UI.
    private func eventColor(_ outcome: WatchEventOutcome) -> Color {
        switch outcome {
        case .failed, .timedOut, .expired: .red
        case .succeeded: .green
        case .started, .entered, .accepted, .received, .requested, .finished, .acknowledged, .joined, .skipped: .secondary
        }
    }
}

/// FileRepresentation preserves the .txt attachment instead of sharing a URL string.
/// The file is generated only when the user initiates a share.
private struct WatchEventsFile: Transferable {
    let events: [WatchEvent]

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .plainText) { item in
            SentTransferredFile(try WatchEventExport.write(
                events: item.events, widgetReceipts: WatchWidgetProviderReceiptStore.shared.load()
            ))
        }
    }
}
