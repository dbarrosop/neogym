import Combine
import Foundation

/// The phone holds only a short-lived request and email challenge; it never
/// transfers its own session. Live delivery is supplied by the connectivity adapter.
@MainActor
public final class PhoneAssistedSignInModel: ObservableObject {
    @Published public private(set) var pending: WatchAssistedSignInAttempt?
    @Published public private(set) var isSendingCode = false
    @Published public private(set) var codeRequested = false
    @Published public private(set) var codeSent = false
    @Published public private(set) var verificationSucceeded = false
    @Published public private(set) var errorMessage: String?

    private let now: @MainActor () -> Date
    private let send: @MainActor (WatchAssistedSignInMessage, WatchAssistedSignInAttempt) -> Void
    private var currentUserID: String?
    private var currentEmail: String?
    private var isRestoringAuth = true
    private var earlyRequest: (id: UUID, receivedAt: Date)?
    private var expirationTask: Task<Void, Never>?

    public init(now: @escaping @MainActor () -> Date = Date.init,
                send: @escaping @MainActor (WatchAssistedSignInMessage, WatchAssistedSignInAttempt) -> Void) {
        self.now = now
        self.send = send
    }

    public func observe(_ state: AuthState) {
        let user = state.session?.user
        let id = user?.id
        if id != currentUserID { clearAttempt() }
        currentUserID = id
        currentEmail = user?.email
        switch state {
        case .loading:
            isRestoringAuth = true
        case .signedIn:
            isRestoringAuth = false
            if let earlyRequest {
                self.earlyRequest = nil
                acceptRequest(earlyRequest.id, receivedAt: earlyRequest.receivedAt)
            }
        case .signedOut, .error:
            isRestoringAuth = false
            earlyRequest = nil
        }
    }

    public func receive(_ message: WatchAssistedSignInMessage, receivedAt: Date) {
        switch message {
        case .request(let id):
            if isRestoringAuth {
                // Preserve the receipt timestamp across asynchronous Auth restoration.
                earlyRequest = (id, receivedAt)
            } else {
                acceptRequest(id, receivedAt: receivedAt)
            }
        case .result(let id, let succeeded):
            guard pending != nil, let attempt = liveAttempt(),
                  attempt.acceptsResult(id: id, verificationSucceeded: verificationSucceeded) else { return }
            if succeeded {
                endAttempt()
                verificationSucceeded = true
                errorMessage = nil
            } else {
                codeSent = false
                errorMessage = "Watch could not verify the code. Check it, tap Resend to watch, or start again from the watch."
            }
        case .challenge, .code: break
        }
    }

    private func acceptRequest(_ id: UUID, receivedAt: Date) {
        guard let userID = currentUserID, currentEmail != nil else { return }
        let next = WatchAssistedSignInAttempt(id: id, userID: userID, startedAt: receivedAt)
        guard next.accepts(id: id, userID: userID, now: now()) else { return }
        clearAttempt()
        pending = next
        expirationTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000_000)
            guard !Task.isCancelled, let self, self.pending == next else { return }
            self.expireAttempt()
        }
    }

    public func requestCode(using authService: any AuthServicing) async {
        guard let attempt = liveAttempt(), let email = currentEmail else {
            errorMessage = "Open NeoGym on both devices and request sign-in from your watch."
            return
        }
        guard !isSendingCode else { return }
        if codeRequested {
            errorMessage = nil
            send(.challenge(attempt.id, email: email, userID: attempt.userID), attempt)
            return
        }
        isSendingCode = true
        errorMessage = nil
        defer { isSendingCode = false }
        do {
            try await authService.requestSignInOTP(email: email)
            guard liveAttempt() == attempt else { return }
            codeRequested = true
            send(.challenge(attempt.id, email: email, userID: attempt.userID), attempt)
        } catch {
            if pending == attempt { errorMessage = "Could not send an email code. Try again." }
        }
    }

    public func sendCode(_ otp: String) {
        guard let attempt = liveAttempt(), codeRequested,
              otp.count == 6, otp.allSatisfy(\.isNumber) else {
            errorMessage = "Request a new watch sign-in and enter its six-digit code."
            return
        }
        errorMessage = nil
        codeSent = true
        send(.code(attempt.id, otp: otp), attempt)
    }

    public func deliveryFailed(for attempt: WatchAssistedSignInAttempt) {
        guard pending == attempt, !verificationSucceeded else { return }
        codeSent = false
        errorMessage = "Watch is not reachable. Keep NeoGym open on both devices and retry."
    }

    public func clearAttempt() {
        endAttempt()
        verificationSucceeded = false
        errorMessage = nil
    }

    public func clearPresentedSuccess() {
        guard pending == nil else { return }
        verificationSucceeded = false
    }

    public func expireAttempt() {
        guard pending != nil else { return }
        _ = liveAttempt()
    }

    private func endAttempt() {
        expirationTask?.cancel()
        expirationTask = nil
        pending = nil
        codeRequested = false
        codeSent = false
    }

    private func liveAttempt() -> WatchAssistedSignInAttempt? {
        guard let pending else { return nil }
        guard let id = currentUserID, pending.accepts(id: pending.id, userID: id, now: now()) else {
            clearAttempt()
            return nil
        }
        return pending
    }
}
