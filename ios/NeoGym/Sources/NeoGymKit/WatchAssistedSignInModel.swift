import Combine
import Foundation

/// Owns the watch's ephemeral challenge and verifies only for its current phone account.
@MainActor
public final class WatchAssistedSignInModel: ObservableObject {
    @Published public private(set) var status: String?
    @Published public private(set) var isVerifying = false

    private let account: WatchAccountModel
    private let auth: any AuthServicing
    private let now: @MainActor () -> Date
    private let send: @MainActor (WatchAssistedSignInMessage, @escaping @MainActor () -> Void) -> Void
    private var attempt: WatchAssistedSignInAttempt?
    private var email: String?

    public init(account: WatchAccountModel, now: @escaping @MainActor () -> Date = Date.init,
                send: @escaping @MainActor (WatchAssistedSignInMessage, @escaping @MainActor () -> Void) -> Void) {
        self.account = account
        auth = account.authStore.authService
        self.now = now
        self.send = send
    }

    public func start() {
        guard let id = account.assistedSignInUserID, !isVerifying else { return }
        let next = WatchAssistedSignInAttempt(id: UUID(), userID: id, startedAt: now())
        attempt = next
        email = nil
        status = "Open NeoGym on your iPhone, then open Me → Profile → Connect Apple Watch."
        send(.request(next.id)) { [weak self] in
            guard let self, self.attempt == next else { return }
            self.status = "iPhone unavailable. Keep NeoGym open on both devices and retry."
        }
    }

    /// Returns true only when a code has started verification; the caller holds
    /// its watchOS expiring activity for that asynchronous operation.
    public func receive(_ message: WatchAssistedSignInMessage) -> Bool {
        switch message {
        case .challenge(let id, let challengeEmail, let userID):
            guard let attempt, account.assistedSignInUserID == attempt.userID,
                  attempt.accepts(id: id, userID: userID, now: now()) else { return false }
            email = challengeEmail
            status = "Enter the emailed code on your iPhone."
        case .code(let id, let otp):
            if isVerifying, attempt?.id == id { return false }
            guard !isVerifying, let attempt, let email,
                  WatchAssistedSignInAttempt.canVerifyCode(
                    id: id, attempt: attempt, currentUserID: account.assistedSignInUserID,
                    challengeEmail: email, now: now()
                  ) else {
                send(.result(id, succeeded: false), {})
                return false
            }
            isVerifying = true
            verification = (attempt, email, otp)
            return true
        case .request, .result: break
        }
        return false
    }

    private var verification: (WatchAssistedSignInAttempt, String, String)?

    /// A rejected or superseded response must never leave a newly persisted
    /// credential for a different (or now blocked) watch account.
    @discardableResult
    public func verify() async -> Bool {
        guard let (attempt, email, otp) = verification else { return false }
        defer { verification = nil; isVerifying = false }
        do {
            // The queued verification may start after the request expires or
            // the phone hint changes. Avoid spending a code that is already invalid.
            guard self.attempt == attempt,
                  WatchAssistedSignInAttempt.canVerifyCode(
                    id: attempt.id, attempt: self.attempt, currentUserID: account.assistedSignInUserID,
                    challengeEmail: self.email, now: now()
                  ), self.email == email else {
                throw VerificationError.invalidAttempt
            }
            guard let session = try await auth.verifySignInOTP(email: email, otp: otp) else {
                throw VerificationError.noSession
            }
            guard self.attempt == attempt,
                  self.email == email,
                  attempt.accepts(id: attempt.id, userID: attempt.userID, now: now()),
                  account.allowsAssistedVerifiedSession(userID: attempt.userID),
                  session.user?.id == attempt.userID else {
                try await auth.clearSession()
                throw VerificationError.accountMismatch
            }
            account.acceptVerifiedSession(session)
            self.attempt = nil
            self.email = nil
            status = nil
            send(.result(attempt.id, succeeded: true), {})
            return true
        } catch {
            if self.attempt == attempt {
                status = "Code could not be verified. Check it on your iPhone or try again."
            }
            send(.result(attempt.id, succeeded: false), {})
            return false
        }
    }

    private enum VerificationError: Error { case invalidAttempt, noSession, accountMismatch }
}
