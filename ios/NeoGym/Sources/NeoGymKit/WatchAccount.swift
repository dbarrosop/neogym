import Combine
import Foundation
import Nhost

/// The only fields a watch may receive from the companion. A malformed or newer
/// schema is ignored rather than erasing the last definitive account state.
public enum PhoneAccountHint: Sendable, Equatable {
    case signedOut
    case signedIn(userID: String)

    public var context: [String: String] {
        switch self {
        case .signedOut: ["version": "1", "state": "signedOut"]
        case let .signedIn(id): ["version": "1", "state": "signedIn", "userId": id]
        }
    }

    public static func decode(_ context: [String: Any]) -> Self? {
        guard context["version"] as? String == "1", let state = context["state"] as? String else { return nil }
        switch state {
        case "signedOut": return .signedOut
        case "signedIn":
            guard let id = context["userId"] as? String, !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return nil }
            return .signedIn(userID: id)
        default: return nil
        }
    }

    /// Transient phone states never overwrite an already delivered definitive hint.
    public static func from(_ state: AuthState) -> Self? {
        switch state {
        case .signedIn(let session):
            guard let id = session.user?.id,
                  !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
            return .signedIn(userID: id)
        case .signedOut: return .signedOut
        case .loading, .error: return nil
        }
    }
}

public struct CurrentWatchUser: Sendable, Equatable {
    public let id: String
    public let displayName: String
    public let email: String?

    public init(id: String, displayName: String, email: String? = nil) {
        self.id = id
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        self.displayName = trimmed.isEmpty ? "Athlete" : trimmed
        let trimmedEmail = email?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.email = trimmedEmail?.isEmpty == false ? trimmedEmail : nil
    }
}

public protocol CurrentUserServicing: Sendable {
    func getUser() async throws -> CurrentWatchUser
}

public struct NhostCurrentUserService: CurrentUserServicing {
    public let client: NhostClient

    public init(client: NhostClient) { self.client = client }

    public func getUser() async throws -> CurrentWatchUser {
        // Auth's managed bearer/refresh middleware runs for this uncached request.
        let user = try await client.auth.getUser().body
        return CurrentWatchUser(id: user.id, displayName: user.displayName, email: user.email)
    }
}

public enum WatchAccountState: Equatable {
    case awaitingLocalContext
    case signedOut
    case phoneSignedOut
    case matchPhone
    case clearing
    case loading
    case name(String)
    case networkError
    case authError
    case reauthenticate
    case error(String)
}

/// Owns no name cache. A generation invalidates in-flight responses when the
/// session changes or a phone hint blocks it; a refresh hides the prior name.
@MainActor
public final class WatchAccountModel: ObservableObject {
    @Published public private(set) var state: WatchAccountState = .awaitingLocalContext
    @Published public private(set) var currentUser: CurrentWatchUser?
    public let authStore: AuthStore
    private let currentUserService: any CurrentUserServicing
    private var phone: PhoneKnowledge = .pending
    private var sessionID: String?
    private var observedAuthState: AuthState = .loading
    private var requiresReauthentication = false
    private var explicitSignOut = false
    private var explicitlyClearing = false
    private var generation: UInt64 = 0
    private var loadTask: Task<Void, Never>?
    // Package tests retain the cancelled task to await its completion before
    // asserting that a late response was never published.
    var inFlightRead: Task<Void, Never>? { loadTask }
    private var loadingSessionID: String?
    private var clearTask: Task<Void, Never>?
    private var subscription: AnyCancellable?

    private enum PhoneKnowledge: Equatable { case pending, unknown, known(PhoneAccountHint) }

    public init(authStore: AuthStore, currentUser: any CurrentUserServicing) {
        self.authStore = authStore
        self.currentUserService = currentUser
        subscription = authStore.$state.sink { [weak self] state in
            // Publisher delivery is synchronous on the main actor for AuthStore.
            MainActor.assumeIsolated { self?.sessionChanged(state) }
        }
    }

    public static func production() -> WatchAccountModel {
        let client = NhostClientFactory.makeProductionWatchClient()
        return WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: NhostCurrentUserService(client: client)
        )
    }

    public func bootstrap() async {
        await authStore.bootstrap()
        reconcile()
    }

    /// Background refresh must not finish its system task before the uncached
    /// account read has established that this session may access private data.
    public func waitForCurrentRead() async {
        await loadTask?.value
    }

    /// Call after bounded *local* WCSession activation, not after a phone reply.
    public func localContextReady(_ context: [String: Any]?) {
        let next: PhoneKnowledge
        if let context, let hint = PhoneAccountHint.decode(context) {
            next = .known(hint)
        } else if phone == .pending {
            next = .unknown
        } else {
            return // An invalid later context cannot erase a known hint.
        }
        guard next != phone else { return }
        phone = next
        reconcile()
    }

    public func receiveContext(_ context: [String: Any]) {
        guard let hint = PhoneAccountHint.decode(context), phone != .known(hint) else { return }
        phone = .known(hint)
        reconcile()
    }

    /// OTP may already have persisted a same-ID SDK session before its caller
    /// returns. Always invalidate an earlier read and fetch again from Auth;
    /// reconciliation first blocks/clears a session that conflicts with a hint.
    public func acceptVerifiedSession(_ session: StoredSession) {
        invalidate()
        state = .loading
        authStore.applyVerifiedSession(session)
        reconcile(forceFetch: true)
    }

    /// Coalesces with an in-flight read. The watch view cancels that read first
    /// on background→active so a background-started request cannot serve the open.
    public func refresh() {
        if state == .loading, loadTask != nil { return }
        reconcile(forceFetch: true)
    }

    /// Expiring watchOS activity stops a managed name read; Retry starts a new one.
    /// Never cancel a session-clear task here: local removal must complete.
    public func cancelPendingRead() {
        guard loadTask != nil else { return }
        invalidate()
        state = .networkError
    }

    public func signOut() async {
        invalidate()
        requiresReauthentication = false
        explicitSignOut = true
        explicitlyClearing = true
        state = .loading // Do not claim the credential is gone until local clearing succeeds.
        await authStore.signOut() // Always attempts local clearing, including remote failures.
        explicitlyClearing = false
        reconcile()
    }

    private func sessionChanged(_ authState: AuthState) {
        observedAuthState = authState
        let id = authState.session?.user?.id
        guard id != sessionID else {
            reconcile() // Same-ID token updates and error → signed-out still change the policy.
            return
        }
        if id == nil, sessionID != nil, !explicitSignOut { requiresReauthentication = true }
        if id != nil {
            requiresReauthentication = false
            explicitSignOut = false
        }
        sessionID = id
        reconcile(forceFetch: id != nil)
    }

    private func invalidate() {
        currentUser = nil
        generation &+= 1
        loadTask?.cancel()
        loadTask = nil
        loadingSessionID = nil
    }

    private func reconcile(forceFetch: Bool = false) {
        if case .error(let error) = observedAuthState {
            invalidate()
            state = .error(error) // A failed local clear must remain visible, even under a blocking hint.
            return
        }
        if explicitlyClearing {
            invalidate()
            state = .loading // An explicit sign-out already owns the local removal.
            return
        }
        if clearTask != nil {
            invalidate()
            state = .clearing // Do not offer OTP while local removal may still delete a new session.
            return
        }
        if case .pending = phone {
            invalidate()
            state = .awaitingLocalContext
            return
        }
        switch phone {
        case .known(.signedOut):
            invalidate()
            blockAndClear(.phoneSignedOut)
            return
        case .known(.signedIn(let phoneID)):
            if let id = sessionID, id != phoneID {
                invalidate()
                blockAndClear(.matchPhone)
                return
            }
        case .pending, .unknown: break
        }
        if explicitSignOut {
            invalidate()
            if observedAuthState.isLoading || observedAuthState.session != nil {
                state = .loading // A bootstrap retry may still restore the failed-to-clear credential.
            } else if case .known(.signedIn) = phone {
                state = .matchPhone // A later phone account hint still asks for watch sign-in.
            } else {
                state = .signedOut
            }
            return
        }
        switch observedAuthState {
        case .loading:
            invalidate()
            state = .loading // AuthStore.bootstrap(), not a /user task, owns this loading state.
        case .signedOut:
            invalidate()
            if case .known(.signedIn) = phone { state = .matchPhone }
            else { state = requiresReauthentication ? .reauthenticate : .signedOut }
        case .error(let error):
            invalidate()
            state = .error(error)
        case .signedIn:
            guard let id = sessionID, !id.isEmpty else {
                invalidate()
                state = .reauthenticate
                return
            }
            // Preserve a same-session read across matching phone hints or direct
            // refresh calls. The view cancels first on background→active to replace it.
            if loadTask != nil, loadingSessionID == id { return }
            if !forceFetch, state != .loading, state != .awaitingLocalContext,
               state != .signedOut, state != .phoneSignedOut, state != .matchPhone,
               state != .clearing { return }
            invalidate()
            state = .loading
            loadingSessionID = id
            let revision = generation
            loadTask = Task { [weak self, currentUserService] in
                do {
                    let user = try await currentUserService.getUser()
                    self?.finish(user: user, id: id, revision: revision)
                } catch {
                    self?.fail(error, revision: revision)
                }
            }
        }
    }

    private func blockAndClear(_ blocked: WatchAccountState) {
        guard observedAuthState.session != nil else {
            state = blocked
            return
        }
        state = .clearing
        // Let an in-progress clear finish: cancelling it can prevent SDK local clearing.
        clearTask = Task { [weak self] in
            await self?.authStore.signOut()
            // A newer hint/session could arrive during the remote request.
            self?.clearTask = nil
            self?.reconcile()
        }
    }

    private func finish(user: CurrentWatchUser, id: String, revision: UInt64) {
        guard revision == generation, !Task.isCancelled else { return }
        loadTask = nil
        loadingSessionID = nil
        guard user.id == id, !user.id.isEmpty else { state = .authError; return }
        if case .known(.signedIn(let phoneID)) = phone, phoneID != user.id {
            blockAndClear(.matchPhone)
            return
        }
        currentUser = user
        state = .name(user.displayName)
    }

    private func fail(_ error: Error, revision: UInt64) {
        guard revision == generation, !Task.isCancelled else { return }
        loadTask = nil
        loadingSessionID = nil
        if error is SessionRefreshError { state = .reauthenticate }
        else if let fetch = error as? FetchError,
                fetch.decodedBody(AuthErrorResponse.self)?.error == .invalidRefreshToken {
            state = .reauthenticate
        }
        else if let fetch = error as? FetchError, fetch.status == 401 { state = .authError }
        else if error is URLError { state = .networkError }
        else if let fetch = error as? FetchError, case .transport = fetch { state = .networkError }
        else { state = .error(error.localizedDescription) }
    }
}
