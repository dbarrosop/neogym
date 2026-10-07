import Foundation
import NeoGymKit
import WatchConnectivity

@MainActor
final class WatchAccountConnectivity: NSObject, WCSessionDelegate {
    var onContext: (([String: Any]) -> Void)?
    var onAssistedMessage: ((WatchAssistedSignInMessage) -> Void)?

    func send(_ message: WatchAssistedSignInMessage, onFailure: @escaping @MainActor () -> Void) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated,
              WCSession.default.isReachable else { onFailure(); return }
        WCSession.default.sendMessage(message.context, replyHandler: nil) { _ in
            Task { @MainActor in onFailure() }
        }
    }

    /// Only waits for local WCSession activation, never for the iPhone to answer.
    func activate() async -> [String: Any]? {
        guard WCSession.isSupported() else { return nil }
        WCSession.default.delegate = self
        WCSession.default.activate()
        for _ in 0..<20 where WCSession.default.activationState != .activated {
            try? await Task.sleep(for: .milliseconds(100))
        }
        return currentContext()
    }

    func currentContext() -> [String: Any]? {
        guard WCSession.isSupported() else { return nil }
        let context = WCSession.default.receivedApplicationContext
        return context.isEmpty ? nil : context
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            if let context = currentContext() { onContext?(context) }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let strings = message.compactMapValues { $0 as? String }
        guard strings.count == message.count,
              let payload = WatchAssistedSignInMessage.decode(strings) else { return }
        Task { @MainActor in onAssistedMessage?(payload) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        // WCSession's Any dictionary is non-Sendable; copy only the string schema
        // before crossing to the main actor. The model validates it again.
        let strings = context.compactMapValues { $0 as? String }
        Task { @MainActor in
            // Always prefer the latest stored context: an activation callback and
            // a delivery callback can be queued onto the main actor together.
            onContext?(currentContext() ?? strings.mapValues { $0 as Any })
        }
    }
}
