import Foundation
import WatchConnectivity

@MainActor
final class WatchAccountConnectivity: NSObject, WCSessionDelegate {
    var onContext: (([String: Any]) -> Void)?

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
