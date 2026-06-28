import Combine
import Foundation
import Nhost

public enum AuthState: Sendable {
    case loading
    case signedOut
    case signedIn(StoredSession)
    case error(String)

    public var session: StoredSession? {
        if case let .signedIn(session) = self {
            return session
        }

        return nil
    }

    public var isLoading: Bool {
        if case .loading = self {
            return true
        }

        return false
    }
}

@MainActor
public final class AuthStore: ObservableObject {
    @Published public private(set) var state: AuthState = .loading

    public let authService: any AuthServicing
    private var subscription: AuthSessionSubscription?
    private var bootstrapTask: Task<Void, Never>?

    public init(
        authService: any AuthServicing = NhostClientFactory.makeAuthService(),
        autoBootstrap: Bool = true
    ) {
        self.authService = authService

        if autoBootstrap {
            start()
        }
    }

    deinit {
        bootstrapTask?.cancel()
        let subscription = subscription
        Task {
            await subscription?.cancel()
        }
    }

    public func start() {
        bootstrapTask?.cancel()
        bootstrapTask = Task { [weak self] in
            await self?.bootstrap()
        }
    }

    public func bootstrap() async {
        state = .loading
        await subscription?.cancel()
        subscription = nil

        do {
            let newSubscription = await authService.subscribeToSessionChanges { [weak self] session in
                await self?.applySession(session)
            }
            let session = try await authService.getUserSession()

            subscription = newSubscription
            applySession(session)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    public func applyVerifiedSession(_ session: StoredSession) {
        applySession(session)
    }

    public func signOut() async {
        let refreshToken = state.session?.refreshToken

        do {
            try await authService.signOut(refreshToken: refreshToken)
        } catch {
            // Local clearing below is the important UX/security boundary for the
            // app shell. A later auth phase can surface remote sign-out failures.
        }

        do {
            try await authService.clearSession()
            applySession(nil)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private func applySession(_ session: StoredSession?) {
        if let session {
            state = .signedIn(session)
        } else {
            state = .signedOut
        }
    }
}
