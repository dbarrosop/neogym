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

public struct CurrentWatchUser: Codable, Sendable, Equatable {
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

/// Watch-app-only profile cache. The session's user ID must be restored from the
/// SDK Keychain before a cached profile can be read; the complication cannot access it.
public struct WatchCurrentUserStore: Sendable {
    private let suite: String?
    private let key = "watchCurrentUser.v1"

    public init(suite: String? = nil) { self.suite = suite }

    public func load(for userID: String) -> CurrentWatchUser? {
        guard let data = defaults.data(forKey: key),
              let user = try? JSONDecoder().decode(CurrentWatchUser.self, from: data),
              user.id == userID else { return nil }
        return user
    }

    public func save(_ user: CurrentWatchUser) {
        guard let data = try? JSONEncoder().encode(user) else { return }
        defaults.set(data, forKey: key)
    }

    public func retainOnly(userID: String) {
        if defaults.data(forKey: key) != nil && load(for: userID) == nil { clear() }
    }

    public func clear() { defaults.removeObject(forKey: key) }

    private var defaults: UserDefaults {
        suite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
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
    case authError
    case reauthenticate
    case error(String)
}

/// Restores a same-user cached profile after local session bootstrap, then reads
/// Auth in the background. A generation discards late responses after blocking hints.
@MainActor
public final class WatchAccountModel: ObservableObject {
    @Published public private(set) var state: WatchAccountState = .awaitingLocalContext
    @Published public private(set) var currentUser: CurrentWatchUser?
    @Published public private(set) var profileError: String?
    @Published public private(set) var isReadingProfile = false
    /// Watch-app-only, typed failure hook; never forwards Auth response bodies,
    /// account details, URLs or localized descriptions into diagnostics.
    public var onReadFailure: (@MainActor (WatchTransportDiagnostic) -> Void)?
    public let authStore: AuthStore
    private let currentUserService: any CurrentUserServicing
    private let currentUserStore: WatchCurrentUserStore?
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

    public init(authStore: AuthStore, currentUser: any CurrentUserServicing,
                currentUserStore: WatchCurrentUserStore? = nil) {
        self.authStore = authStore
        self.currentUserService = currentUser
        self.currentUserStore = currentUserStore
        subscription = authStore.$state.sink { [weak self] state in
            // Publisher delivery is synchronous on the main actor for AuthStore.
            MainActor.assumeIsolated { self?.sessionChanged(state) }
        }
    }

    public static func production() -> WatchAccountModel {
        let client = NhostClientFactory.makeProductionWatchClient()
        return WatchAccountModel(
            authStore: AuthStore(authService: NhostAuthService(client: client), autoBootstrap: false),
            currentUser: NhostCurrentUserService(client: client),
            currentUserStore: WatchCurrentUserStore()
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
        if currentUser?.id == session.user?.id {
            invalidateRead()
        } else {
            invalidate()
            currentUserStore?.clear()
            state = .loading
        }
        authStore.applyVerifiedSession(session)
        reconcile(forceFetch: true)
    }

    /// Coalesces with an in-flight read. The watch runtime cancels that read first
    /// on background→active so a background-started request cannot serve the open.
    public func refresh() {
        if loadTask != nil { return }
        reconcile(forceFetch: true)
    }

    /// Expiring watchOS activity stops a managed name read; Retry starts a new one.
    /// Never cancel a session-clear task here: local removal must complete.
    public func cancelPendingRead() {
        guard loadTask != nil else { return }
        invalidateRead()
        profileError = "Profile may be out of date."
    }

    public func signOut() async {
        invalidate()
        currentUserStore?.clear()
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
        if id == nil || (sessionID != nil && sessionID != id) { currentUserStore?.clear() }
        if let id {
            currentUserStore?.retainOnly(userID: id)
            requiresReauthentication = false
            explicitSignOut = false
        }
        sessionID = id
        reconcile(forceFetch: id != nil)
    }

    private func invalidate() {
        currentUser = nil
        profileError = nil
        invalidateRead()
    }

    private func invalidateRead() {
        isReadingProfile = false
        generation &+= 1
        loadTask?.cancel()
        loadTask = nil
        loadingSessionID = nil
    }

    private func reconcile(forceFetch: Bool = false) {
        if handleBlockingState() { return }
        if explicitSignOut {
            reconcileExplicitSignOut()
            return
        }
        reconcileAuthState(forceFetch: forceFetch)
    }

    private func handleBlockingState() -> Bool {
        if case .error(let error) = observedAuthState {
            invalidate()
            currentUserStore?.clear()
            state = .error(error) // A failed local clear must remain visible, even under a blocking hint.
            return true
        }
        if explicitlyClearing {
            invalidate()
            state = .loading // An explicit sign-out already owns the local removal.
            return true
        }
        if clearTask != nil {
            invalidate()
            state = .clearing // Do not offer OTP while local removal may still delete a new session.
            return true
        }
        if case .pending = phone {
            invalidate()
            state = .awaitingLocalContext
            return true
        }
        switch phone {
        case .known(.signedOut):
            invalidate()
            currentUserStore?.clear()
            blockAndClear(.phoneSignedOut)
            return true
        case .known(.signedIn(let phoneID)):
            if let id = sessionID, id != phoneID {
                invalidate()
                currentUserStore?.clear()
                blockAndClear(.matchPhone)
                return true
            }
        case .pending, .unknown: break
        }
        return false
    }

    private func reconcileExplicitSignOut() {
        invalidate()
        if observedAuthState.isLoading || observedAuthState.session != nil {
            state = .loading // A bootstrap retry may still restore the failed-to-clear credential.
        } else if case .known(.signedIn) = phone {
            state = .matchPhone // A later phone account hint still asks for watch sign-in.
        } else {
            state = .signedOut
        }
    }

    private func reconcileAuthState(forceFetch: Bool) {
        switch observedAuthState {
        case .loading:
            invalidate()
            state = .loading // AuthStore.bootstrap(), not a /user task, owns this loading state.
        case .signedOut:
            invalidate()
            currentUserStore?.clear()
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
            // refresh calls. The runtime cancels first on background→active to replace it.
            if loadTask != nil, loadingSessionID == id { return }
            if !forceFetch, state != .loading, state != .awaitingLocalContext,
               state != .signedOut, state != .phoneSignedOut, state != .matchPhone,
               state != .clearing { return }
            startRead(id: id)
        }
    }

    private func startRead(id: String) {
        invalidateRead()
        if currentUser?.id != id {
            // The session is local and owner-checked. A previously fetched name
            // wins over the older SDK session payload until Auth revalidates.
            let cached = currentUserStore?.load(for: id)
            let fallback = CurrentWatchUser(id: id,
                displayName: observedAuthState.session?.user?.displayName ?? "Athlete")
            currentUser = cached ?? fallback
        }
        profileError = nil
        loadingSessionID = id
        isReadingProfile = true
        let revision = generation
        loadTask = Task { [weak self, currentUserService] in
            do {
                let user = try await currentUserService.getUser()
                self?.finish(user: user, id: id, revision: revision)
            } catch {
                self?.fail(error, revision: revision)
            }
        }
        state = .name(currentUser?.displayName ?? "Athlete")
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
        isReadingProfile = false
        guard user.id == id, !user.id.isEmpty else {
            invalidate()
            currentUserStore?.clear()
            state = .authError
            return
        }
        if case .known(.signedIn(let phoneID)) = phone, phoneID != user.id {
            invalidate()
            currentUserStore?.clear()
            blockAndClear(.matchPhone)
            return
        }
        currentUserStore?.save(user)
        currentUser = user
        profileError = nil
        state = .name(user.displayName)
    }

    private func fail(_ error: Error, revision: UInt64) {
        guard revision == generation, !Task.isCancelled else { return }
        onReadFailure?(WatchTransportDiagnostic.classify(error))
        loadTask = nil
        loadingSessionID = nil
        isReadingProfile = false
        // startRead seeds an owner-checked profile before the request; only
        // invalidation can clear it, and that also changes the generation.
        if error is SessionRefreshError {
            invalidate()
            currentUserStore?.clear()
            state = .reauthenticate
        } else if let fetch = error as? FetchError,
                  fetch.decodedBody(AuthErrorResponse.self)?.error == .invalidRefreshToken {
            invalidate()
            currentUserStore?.clear()
            state = .reauthenticate
        } else if let fetch = error as? FetchError, fetch.status == 401 {
            invalidate()
            currentUserStore?.clear()
            state = .authError
        } else if error is URLError {
            profileError = "Profile may be out of date. Retry when connected."
        } else if let fetch = error as? FetchError, case .transport = fetch {
            profileError = "Profile may be out of date. Retry when connected."
        } else {
            profileError = "Profile could not be refreshed. Retry."
        }
    }
}
