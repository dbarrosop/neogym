import Combine
import NeoGymKit
import WatchConnectivity

/// Application context remains account hints only. Assisted OTP travels via
/// live messages, is never persisted, and is verified by Auth on the watch.
@MainActor
final class PhoneAccountConnectivity: NSObject, ObservableObject, PhoneHintTransport {
    @Published private(set) var pending: WatchAssistedSignInAttempt?
    @Published private(set) var isSendingCode = false
    @Published private(set) var codeRequested = false
    @Published private(set) var codeSent = false
    @Published private(set) var verificationSucceeded = false
    @Published private(set) var errorMessage: String?

    private lazy var publisher = PhoneHintPublisher(transport: self)
    private var currentUserID: String?
    private var currentEmail: String?

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func observe(_ state: AuthState) {
        publisher.observe(state)
        let user = state.session?.user
        let id = user?.id
        if id != currentUserID { clearAttempt() }
        currentUserID = id
        currentEmail = user?.email
    }

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

    func requestCode(using authService: any AuthServicing) async {
        guard let attempt = liveAttempt(), let email = currentEmail else {
            errorMessage = "Open NeoGym on both devices and request sign-in from your watch."
            return
        }
        guard !isSendingCode else { return }
        if codeRequested {
            errorMessage = nil
            sendChallenge(for: attempt, email: email)
            return
        }
        isSendingCode = true
        errorMessage = nil
        defer { isSendingCode = false }
        do {
            try await authService.requestSignInOTP(email: email)
            guard liveAttempt() == attempt else { return }
            codeRequested = true
            sendChallenge(for: attempt, email: email)
        } catch {
            errorMessage = "Could not send an email code. Try again."
        }
    }

    func sendCode(_ otp: String) {
        guard let attempt = liveAttempt(), codeRequested,
              otp.count == 6, otp.allSatisfy(\.isNumber) else {
            errorMessage = "Request a new watch sign-in and enter its six-digit code."
            return
        }
        errorMessage = nil
        codeSent = true
        send(.code(attempt.id, otp: otp), for: attempt)
    }

    func clearAttempt() {
        pending = nil
        codeRequested = false
        codeSent = false
        verificationSucceeded = false
        errorMessage = nil
    }

    private func liveAttempt() -> WatchAssistedSignInAttempt? {
        guard let pending, let id = currentUserID,
              pending.accepts(id: pending.id, userID: id) else {
            clearAttempt()
            return nil
        }
        return pending
    }

    private func sendChallenge(for attempt: WatchAssistedSignInAttempt, email: String) {
        send(.challenge(attempt.id, email: email, userID: attempt.userID), for: attempt)
    }

    private func send(_ message: WatchAssistedSignInMessage, for attempt: WatchAssistedSignInAttempt) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            errorMessage = "Watch is not reachable. Keep NeoGym open on both devices and retry."
            return
        }
        WCSession.default.sendMessage(message.context, replyHandler: nil) { [weak self] _ in
            Task { @MainActor [weak self] in
                if self?.pending == attempt {
                    self?.codeSent = false
                    self?.errorMessage = "Watch is not reachable. Keep NeoGym open on both devices and retry."
                }
            }
        }
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

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let strings = message.compactMapValues { $0 as? String }
        guard strings.count == message.count,
              let payload = WatchAssistedSignInMessage.decode(strings) else { return }
        Task { @MainActor in
            switch payload {
            case .request(let id):
                guard let userID = currentUserID, currentEmail != nil else { return }
                pending = WatchAssistedSignInAttempt(id: id, userID: userID)
                codeRequested = false
                codeSent = false
                verificationSucceeded = false
                errorMessage = nil
            case .result(let id, let succeeded):
                guard liveAttempt()?.id == id else { return }
                verificationSucceeded = succeeded
                if !succeeded { codeSent = false; errorMessage = "Watch could not verify that code. Try again or request a new sign-in." }
            case .challenge, .code: break
            }
        }
    }
}
