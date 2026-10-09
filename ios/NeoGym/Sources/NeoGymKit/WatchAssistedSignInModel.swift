import Combine
import Foundation

/// A live, nonce-bound phone handoff. No email entry or OTP UI exists on watch.
@MainActor
public final class WatchAssistedSignInModel: ObservableObject {
    @Published public private(set) var status: String?
    @Published public private(set) var isConnecting = false

    private let account: WatchAccountModel
    private let now: @MainActor () -> Date
    private let send: @MainActor (WatchAssistedSignInMessage, @escaping @MainActor () -> Void) -> Void
    private var attempt: WatchAssistedSignInAttempt?
    private var received: (WatchAssistedSignInAttempt, WatchPATCredential)?

    public init(account: WatchAccountModel, now: @escaping @MainActor () -> Date = Date.init,
                send: @escaping @MainActor (WatchAssistedSignInMessage, @escaping @MainActor () -> Void) -> Void) {
        self.account = account
        self.now = now
        self.send = send
    }

    public func cancel() {
        attempt = nil
        received = nil
        status = nil
    }

    public func start() {
        guard let userID = account.assistedSignInUserID, !isConnecting else { return }
        let attempt = WatchAssistedSignInAttempt(id: UUID(), userID: userID, startedAt: now())
        self.attempt = attempt
        received = nil
        status = "Open NeoGym on your iPhone, then Me → Profile → Connect Apple Watch."
        send(.request(attempt.id)) { [weak self] in
            guard let self, self.attempt == attempt else { return }
            self.status = "iPhone unavailable. Open NeoGym on both devices and try again."
        }
    }

    public func receive(_ message: WatchAssistedSignInMessage) -> Bool {
        guard case .credential(let id, let credential) = message,
              !isConnecting, let attempt,
              attempt.accepts(id: id, userID: credential.userID, now: now()),
              account.assistedSignInUserID == credential.userID,
              credential.isValid(at: now()) else { return false }
        received = (attempt, credential)
        isConnecting = true
        status = "Connecting…"
        return true
    }

    public func connect() async -> Bool {
        guard let (attempt, credential) = received else { return false }
        defer { received = nil; isConnecting = false }
        guard self.attempt == attempt,
              attempt.accepts(id: attempt.id, userID: credential.userID, now: now()),
              account.assistedSignInUserID == credential.userID else { return false }
        let succeeded = await account.acceptPAT(credential)
        let stillAllowed = self.attempt == attempt
            && attempt.accepts(id: attempt.id, userID: credential.userID, now: now())
            && account.allowsAssistedVerifiedSession(userID: credential.userID)
        if succeeded && !stillAllowed { await account.signOut() }
        let accepted = succeeded && stillAllowed
        if accepted { self.attempt = nil; status = nil }
        else { status = "Could not connect. Keep both apps open and try again." }
        send(.result(attempt.id, succeeded: accepted), {})
        return accepted
    }
}
