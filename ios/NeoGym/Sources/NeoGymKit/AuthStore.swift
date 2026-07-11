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

public enum AuthSnapshotClearReason: Sendable, Equatable {
    case signOut
    case signedOutBootstrap
    case signedOutSession
    case authError
    case userSwitch(previousUserMarker: String?, nextUserMarker: String?)
}

public typealias AuthSnapshotClearHandler = @MainActor (AuthSnapshotClearReason) -> Void

@MainActor
public final class AuthStore: ObservableObject {
    @Published public private(set) var state: AuthState = .loading

    public let authService: any AuthServicing
    private let snapshotClearHandler: AuthSnapshotClearHandler
    private var subscription: AuthSessionSubscription?
    private var bootstrapTask: Task<Void, Never>?
    private var isClearingForExplicitSignOut = false

    public init(
        authService: any AuthServicing = NhostClientFactory.makeAuthService(),
        autoBootstrap: Bool = true,
        snapshotClearHandler: @escaping AuthSnapshotClearHandler = { _ in }
    ) {
        self.authService = authService
        self.snapshotClearHandler = snapshotClearHandler

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
            snapshotClearHandler(.authError)
            state = .error(error.localizedDescription)
        }
    }

    public func applyVerifiedSession(_ session: StoredSession) {
        applySession(session)
    }

    public func signOut() async {
        let refreshToken = state.session?.refreshToken
        snapshotClearHandler(.signOut)
        isClearingForExplicitSignOut = true
        defer { isClearingForExplicitSignOut = false }

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
            let previousUserMarker = state.session?.user?.id
            let nextUserMarker = session.user?.id
            if state.session != nil, previousUserMarker != nextUserMarker {
                snapshotClearHandler(.userSwitch(
                    previousUserMarker: previousUserMarker,
                    nextUserMarker: nextUserMarker
                ))
            }
            state = .signedIn(session)
        } else {
            if !isClearingForExplicitSignOut {
                switch state {
                case .loading:
                    snapshotClearHandler(.signedOutBootstrap)
                case .signedIn:
                    snapshotClearHandler(.signedOutSession)
                case .signedOut, .error:
                    break
                }
            }
            state = .signedOut
        }
    }
}
