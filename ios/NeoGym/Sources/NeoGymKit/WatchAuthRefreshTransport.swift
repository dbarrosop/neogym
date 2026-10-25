import Foundation
import Nhost

/// A watch-only recovery signal for a confirmed Auth POST /token HTTP 400.
/// It says the refresh was rejected, not that the credential is proven invalid.
/// No request, token, response body or server description is retained.
public enum WatchAuthRefreshRejection: Error, Sendable, Equatable {
    case badRequest

    static func matches(_ error: any Error) -> Bool {
        if error is Self { return true }
        let diagnostic = (error as? GraphQLDomainError)?.transportDiagnostic
            ?? (error as? WatchHealthSyncFailure)?.transportDiagnostic
        // Only this typed rejection produces a session-refresh diagnostic with
        // HTTP 400. An unrelated .http/400 must never request PAT recovery.
        return diagnostic == WatchTransportDiagnostic(kind: .sessionRefresh, code: 400)
    }
}

extension WatchAuthRefreshRejection: LocalizedError {
    public var errorDescription: String? { "Watch session refresh was rejected (HTTP 400)." }
}

/// Only fixed outcomes and allowlisted error categories cross into watch diagnostics.
/// Neither the request nor its response (including tokens and headers) is retained.
public struct WatchAuthRefreshObservation: Sendable, Equatable {
    public enum Outcome: Sendable, Equatable {
        case started
        case responseReceived
        case rejected(Int)
        case cancelled
        case failed(WatchTransportDiagnostic)
    }

    public let id: UUID
    public let outcome: Outcome
    public let occurredAt: Date
    public let wallSeconds: Int?

    public init(id: UUID, outcome: Outcome, occurredAt: Date, wallSeconds: Int? = nil) {
        self.id = id
        self.outcome = outcome
        self.occurredAt = occurredAt
        self.wallSeconds = wallSeconds
    }
}

/// Buffers initial observations until the watch runtime has installed its event sink.
public actor WatchAuthRefreshObserver {
    private var handler: (@Sendable (WatchAuthRefreshObservation) -> Void)?
    private var pending: [WatchAuthRefreshObservation] = []

    public init() {}

    public func observe(_ event: WatchAuthRefreshObservation) {
        if let handler { handler(event) }
        else { pending.append(event) }
    }

    public func setHandler(_ handler: @escaping @Sendable (WatchAuthRefreshObservation) -> Void) {
        self.handler = handler
        for event in pending { handler(event) }
        pending.removeAll()
    }
}

/// Watches the actual Auth refresh HTTP exchange, including proactive SDK refreshes.
/// A 200 means Auth returned a response, NOT that the rotated token reached Keychain.
public struct WatchAuthRefreshTransport: HTTPTransport {
    private let underlying: any HTTPTransport
    private let refreshURL: URL
    private let observer: WatchAuthRefreshObserver

    public init(authBaseURL: URL, observer: WatchAuthRefreshObserver,
                underlying: any HTTPTransport = URLSessionTransport()) {
        refreshURL = authBaseURL.appendingPathComponent("token")
        self.observer = observer
        self.underlying = underlying
    }

    public func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        guard request.method == "POST", request.url == refreshURL else {
            return try await underlying.fetch(request)
        }
        let id = UUID()
        let started = Date()
        await observer.observe(.init(id: id, outcome: .started, occurredAt: started))
        let response: NhostRawResponse
        do {
            response = try await underlying.fetch(request)
        } catch where error is CancellationError || (error as? URLError)?.code == .cancelled {
            // The server may already have rotated the token; preserve the SDK's original error.
            await observer.observe(.init(id: id, outcome: .cancelled, occurredAt: Date(),
                                         wallSeconds: max(0, Int(Date().timeIntervalSince(started).rounded(.up)))))
            throw error
        } catch {
            await observer.observe(.init(id: id, outcome: .failed(WatchTransportDiagnostic.classify(error)),
                                         occurredAt: Date(),
                                         wallSeconds: max(0, Int(Date().timeIntervalSince(started).rounded(.up)))))
            throw error
        }
        let outcome: WatchAuthRefreshObservation.Outcome = (200..<300).contains(response.status)
            ? .responseReceived : .rejected(response.status)
        await observer.observe(.init(id: id, outcome: outcome, occurredAt: Date(),
                                     wallSeconds: max(0, Int(Date().timeIntervalSince(started).rounded(.up)))))
        if response.status == 400 {
            let authError = try? NhostJSON.restDecoder.decode(AuthErrorResponse.self, from: response.body)
            // Keep the SDK's conditional session removal for its recognized
            // invalid-refresh-token response. Other refresh 400s need a safe,
            // endpoint-specific signal before the SDK discards request origin.
            if authError?.error != .invalidRefreshToken { throw WatchAuthRefreshRejection.badRequest }
        }
        return response
    }
}
