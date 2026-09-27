import Foundation
import NeoGymKit

/// Holds a best-effort watchOS assertion around auth work. The 20-second
/// deadline releases only the assertion; it does not cancel a live request or
/// interrupt SDK refresh-token persistence. System expiry may cancel an OTP or
/// name read. Session clearing must finish locally even on system expiry.
@MainActor
final class WatchActivity {
    private var activities: [String: WatchActivityLease] = [:]
    private let expiryGate = WatchActivityExpiryGate()

    func begin(_ key: String, id: UUID = UUID(), onExpire: @escaping @MainActor @Sendable () -> Void = {}) {
        end(key)
        let activity = WatchActivityLease(onSystemExpiry: { [weak self] in
            Task { @MainActor in
                // A stale callback cannot cancel a newer read using this key.
                guard self?.expiryGate.expire(key, id: id) == true else { return }
                self?.end(key)
            }
        })
        expiryGate.register(key, id: id, onExpire: onExpire)
        activities[key] = activity
        ProcessInfo.processInfo.performExpiringActivity(withReason: "NeoGym authentication") { expired in
            if expired {
                activity.systemExpired()
            } else {
                activity.waitUntilEnded()
            }
        }
    }

    func perform(
        _ key: String,
        cancelOnExpire: Bool = true,
        operation: @escaping @MainActor @Sendable () async -> Void
    ) {
        let id = UUID()
        let task = Task { @MainActor in
            await operation()
            end(key, matching: id)
        }
        // This main-actor method completes before the new task can run.
        // Never cancel session clearing: even a cancelled remote revocation
        // must still try to remove the persisted local credential.
        begin(key, id: id, onExpire: { if cancelOnExpire { task.cancel() } })
    }

    func end(_ key: String) {
        expiryGate.remove(key)
        activities.removeValue(forKey: key)?.end()
    }

    private func end(_ key: String, matching id: UUID) {
        if expiryGate.matches(key, id: id) { end(key) }
    }
}
