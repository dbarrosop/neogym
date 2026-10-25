import Combine
import Foundation

/// The phone mints one app-user PAT for a live watch request. It retains the
/// secret only in memory until the watch acknowledges or the request expires.
@MainActor
public final class PhoneAssistedSignInModel: ObservableObject {
    @Published public private(set) var pending: WatchAssistedSignInAttempt?
    @Published public private(set) var isSending = false
    @Published public private(set) var connected = false
    @Published public private(set) var errorMessage: String?

    private let pat: any WatchPATServicing
    private let now: @MainActor () -> Date
    private let send: @MainActor (WatchAssistedSignInMessage, WatchAssistedSignInAttempt) -> Void
    private var credential: WatchPATCredential?
    private var currentUserID: String?
    private var restoring = true
    private var earlyRequest: (UUID, Date)?
    private var expirationTask: Task<Void, Never>?

    public init(pat: any WatchPATServicing, now: @escaping @MainActor () -> Date = Date.init,
                send: @escaping @MainActor (WatchAssistedSignInMessage, WatchAssistedSignInAttempt) -> Void) {
        self.pat = pat
        self.now = now
        self.send = send
    }

    public func observe(_ state: AuthState) {
        let id = state.session?.user?.id
        if id != currentUserID { clearAttempt() }
        currentUserID = id
        switch state {
        case .loading: restoring = true
        case .signedIn:
            restoring = false
            if let earlyRequest {
                self.earlyRequest = nil
                acceptRequest(earlyRequest.0, receivedAt: earlyRequest.1)
            }
        case .signedOut, .error:
            restoring = false
            earlyRequest = nil
        }
    }

    public func receive(_ message: WatchAssistedSignInMessage, receivedAt: Date) {
        switch message {
        case .request(let id):
            if restoring { earlyRequest = (id, receivedAt) }
            else { acceptRequest(id, receivedAt: receivedAt) }
        case .result(let id, let succeeded):
            guard let attempt = liveAttempt(), attempt.id == id, !connected else { return }
            if succeeded {
                expirationTask?.cancel()
                expirationTask = nil
                pending = nil
                credential = nil
                connected = true
                errorMessage = nil
            } else {
                errorMessage = "Watch could not sign in. Keep both apps open and try again."
            }
        case .credential: break
        }
    }

    private func acceptRequest(_ id: UUID, receivedAt: Date) {
        guard let userID = currentUserID else { return }
        let attempt = WatchAssistedSignInAttempt(id: id, userID: userID, startedAt: receivedAt)
        guard attempt.accepts(id: id, userID: userID, now: now()) else { return }
        clearAttempt()
        pending = attempt
        let remaining = 600 - now().timeIntervalSince(receivedAt)
        expirationTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            guard !Task.isCancelled, let self, self.pending == attempt else { return }
            self.clearAttempt()
        }
    }

    public func connect() async {
        guard let attempt = liveAttempt(), !isSending else {
            if pending == nil { errorMessage = "Request connection on your watch first." }
            return
        }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let credential: WatchPATCredential
            if let existing = self.credential, existing.userID == attempt.userID, existing.isValid(at: now()) {
                credential = existing
            } else {
                let expiry = now().addingTimeInterval(90 * 24 * 60 * 60)
                let token = try await pat.create(expiresAt: expiry)
                credential = WatchPATCredential(userID: attempt.userID, token: token, expiresAt: expiry)
            }
            guard liveAttempt() == attempt else { return }
            self.credential = credential
            send(.credential(attempt.id, credential), attempt)
        } catch {
            if pending == attempt { errorMessage = "Could not connect the watch. Try again." }
        }
    }

    public func deliveryFailed(for attempt: WatchAssistedSignInAttempt) {
        guard pending == attempt, !connected else { return }
        errorMessage = "Watch is not reachable. Open NeoGym on both devices and try again."
    }

    public func clearAttempt() {
        expirationTask?.cancel()
        expirationTask = nil
        pending = nil
        credential = nil
        connected = false
        errorMessage = nil
    }

    public func clearPresentedSuccess() { if pending == nil { connected = false } }

    public func expireAttempt() { _ = liveAttempt() }

    private func liveAttempt() -> WatchAssistedSignInAttempt? {
        guard let pending else { return nil }
        guard let currentUserID, pending.accepts(id: pending.id, userID: currentUserID, now: now()) else {
            clearAttempt()
            return nil
        }
        return pending
    }
}
