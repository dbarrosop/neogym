import Foundation
import Nhost

private final class NoPhotoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// Foundation's caches and the SDK's persistent GraphQL cache are both bypassed.
final class ProgressPhotoTransport: Sendable {
    private let session: URLSession

    static func configuration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.urlCredentialStorage = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForResource = 45
        return configuration
    }

    init(configuration: URLSessionConfiguration = ProgressPhotoTransport.configuration()) {
        session = URLSession(configuration: configuration, delegate: NoPhotoRedirects(), delegateQueue: nil)
    }

    deinit { session.invalidateAndCancel() }

    var sdkTransport: URLSessionTransport { URLSessionTransport(session: session) }

    func request(_ request: URLRequest, limit: Int, image: Bool = false) async throws -> (Int, Data) {
        let (stream, response) = try await session.bytes(for: request)
        defer { stream.task.cancel() }
        guard let http = response as? HTTPURLResponse, http.url == request.url else {
            throw ProgressPhotoError.unavailable
        }
        guard (200..<300).contains(http.statusCode) else { return (http.statusCode, Data()) }
        guard response.expectedContentLength <= Int64(limit),
              !image || ["image/jpeg", "image/png", "image/webp"].contains(response.mimeType?.lowercased() ?? "") else {
            throw ProgressPhotoError.unavailable
        }
        var body = Data()
        for try await byte in stream {
            guard body.count < limit else { throw ProgressPhotoError.unavailable }
            body.append(byte)
        }
        try Task.checkCancellation()
        return (http.statusCode, body)
    }
}

/// Waits on one SDK-managed rotation per owner. Leaving a photo route cancels
/// its waiter, not an in-flight exchange that might have rotated the token.
actor ProgressPhotoBearer {
    private let owner: String
    private let current: @Sendable () async throws -> StoredSession?
    private let refresh: @Sendable () async throws -> StoredSession?
    private var refreshing = false
    private var waiters: [UUID: AsyncStream<Bool>.Continuation] = [:]

    init(owner: String, current: @escaping @Sendable () async throws -> StoredSession?,
         refresh: @escaping @Sendable () async throws -> StoredSession?) {
        self.owner = owner
        self.current = current
        self.refresh = refresh
    }

    func checkOwner() async throws {
        _ = try await ownerSession()
    }

    func token() async throws -> String {
        let initial = try await ownerSession()
        if let expiry = initial.decodedToken.exp, expiry.timeIntervalSinceNow > 60, !initial.accessToken.isEmpty {
            return initial.accessToken
        }
        let id = UUID()
        let completion = AsyncStream<Bool> { continuation in
            waiters[id] = continuation
        }
        defer { waiters[id] = nil }
        if !refreshing {
            refreshing = true
            Task { await completeRefresh() }
        }
        var iterator = completion.makeAsyncIterator()
        let succeeded = await iterator.next()
        try Task.checkCancellation()
        guard succeeded == true else { throw ProgressPhotoError.unavailable }
        let session = try await ownerSession()
        guard let expiry = session.decodedToken.exp, expiry.timeIntervalSinceNow > 0, !session.accessToken.isEmpty else {
            throw ProgressPhotoError.unavailable
        }
        return session.accessToken
    }

    private func completeRefresh() async {
        let succeeded: Bool
        do {
            _ = try await ownerSession()
            succeeded = try await refresh()?.user?.id == owner
        } catch {
            succeeded = false
        }
        refreshing = false
        for continuation in waiters.values {
            continuation.yield(succeeded)
            continuation.finish()
        }
        waiters.removeAll()
    }

    private func ownerSession() async throws -> StoredSession {
        try Task.checkCancellation()
        guard let session = try await current(), session.user?.id == owner else {
            throw ProgressPhotoError.unavailable
        }
        try Task.checkCancellation()
        return session
    }
}
