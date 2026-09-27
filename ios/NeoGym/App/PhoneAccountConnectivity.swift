import NeoGymKit
import WatchConnectivity

/// WCSession is only a latest-state delivery channel, not a credential store.
@MainActor
final class PhoneAccountConnectivity: NSObject, ObservableObject, PhoneHintTransport {
    private lazy var publisher = PhoneHintPublisher(transport: self)

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func observe(_ state: AuthState) { publisher.observe(state) }

    func foreground() {
        guard WCSession.isSupported() else { return }
        if WCSession.default.activationState != .activated { WCSession.default.activate() }
        else { publisher.resend() }
    }

    func send(context: [String: String]) throws {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
            throw ConnectivityError.notActivated
        }
        try WCSession.default.updateApplicationContext(context)
    }

    private enum ConnectivityError: Error { case notActivated }
}

extension PhoneAccountConnectivity: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            if state == .activated { publisher.resend() }
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        Task { @MainActor in WCSession.default.activate() }
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        Task { @MainActor in publisher.resend() }
    }
}
