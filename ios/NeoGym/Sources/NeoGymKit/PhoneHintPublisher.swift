import Foundation

/// The transport owns WCSession; this policy is host-testable and never transports
/// an Auth session, email, display name, or a transient bootstrap state.
@MainActor
public protocol PhoneHintTransport: AnyObject {
    func send(context: [String: String]) throws
}

@MainActor
public final class PhoneHintPublisher {
    private let transport: any PhoneHintTransport
    private var latest: PhoneAccountHint?
    private var delivered: PhoneAccountHint?

    public init(transport: any PhoneHintTransport) { self.transport = transport }

    public func observe(_ state: AuthState) {
        guard let hint = PhoneAccountHint.from(state) else { return }
        latest = hint
        sendIfNeeded()
    }

    /// Resend after activation/foreground/installation. An opaque nonce makes
    /// even an unchanged application context observable by WatchConnectivity.
    public func resend() { sendIfNeeded(force: true) }

    private func sendIfNeeded(force: Bool = false) {
        guard let latest, force || latest != delivered else { return }
        var context = latest.context
        if force { context["deliveryId"] = UUID().uuidString }
        do {
            try transport.send(context: context)
            delivered = latest
        } catch {
            // A later state change or activation retries; never persist hints here.
        }
    }
}
