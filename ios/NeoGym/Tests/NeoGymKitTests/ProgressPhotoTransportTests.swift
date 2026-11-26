import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

@MainActor
final class ProgressPhotoTransportTests: XCTestCase {
    func testPhotoReadsBypassAppGraphQLCacheAndFoundationStores() async throws {
        let session = try credential(owner: "photo-owner")
        let cache = PhotoCacheSpy()
        let client = createClient(NhostClientOptions(
            graphqlURL: URL(string: "https://photos.example.test/v1"),
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: session)),
            transport: StubTransport { _ in throw PhotoTestError.sdkGraphQLCalled },
            graphqlCache: GraphQLCacheConfiguration(store: cache)
        ))
        let configuration = ProgressPhotoTransport.configuration()
        XCTAssertNil(configuration.urlCache)
        XCTAssertNil(configuration.httpCookieStorage)
        XCTAssertNil(configuration.urlCredentialStorage)
        XCTAssertFalse(configuration.httpShouldSetCookies)
        configuration.protocolClasses = [PhotoURLProtocol.self]
        let repo = try XCTUnwrap(ProgressPhotoRepository(client: client, owner: "photo-owner",
                                                         transport: ProgressPhotoTransport(configuration: configuration)))
        let catalog = try await repo.angles()
        XCTAssertEqual(catalog.map(\.name), ["Fixture angle"])
        let count = await cache.readWriteCount
        XCTAssertEqual(count, 0)
        do {
            _ = try await repo.reservation(photoFixtureId)
            XCTFail("Missing response field cannot be treated as an inaccessible photo")
        } catch is DecodingError {}
        try await client.sessionStore.set(credential(owner: "different-owner"))
        do {
            _ = try await repo.angles()
            XCTFail("Retired owner made a read")
        } catch let error as ProgressPhotoError {
            XCTAssertEqual(error, .unavailable)
        }
    }

    func testImageRequestsUseTheWebTransformOnlyForThumbnails() async throws {
        let session = try credential(owner: "photo-owner")
        let client = createClient(NhostClientOptions(
            storageURL: URL(string: "https://photos.example.test/v1"),
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: session))
        ))
        let configuration = ProgressPhotoTransport.configuration()
        configuration.protocolClasses = [PhotoURLProtocol.self]
        let repo = try XCTUnwrap(ProgressPhotoRepository(client: client, owner: "photo-owner",
                                                         transport: ProgressPhotoTransport(configuration: configuration)))
        let thumbnail = try await repo.imageBytes(photoFixtureId, thumbnail: true)
        let original = try await repo.imageBytes(photoFixtureId, thumbnail: false)
        XCTAssertEqual(String(decoding: thumbnail, as: UTF8.self), "w=480&h=600")
        XCTAssertEqual(String(decoding: original, as: UTF8.self), "original")
    }

    func testRefreshWaitIsCancellableWithoutAbortingRotation() async throws {
        let fixture = try PhotoRefreshFixture()
        let bearer = ProgressPhotoBearer(owner: "photo-owner", current: { await fixture.session },
                                         refresh: { await fixture.refresh() })
        let caller = Task { try await bearer.token() }
        await fixture.waitUntilRefreshing()
        let second = Task { try await bearer.token() }
        caller.cancel()
        do { _ = try await caller.value; XCTFail("Cancelled waiter received bearer") } catch is CancellationError {}
        await fixture.finish(ownerChanged: false)
        _ = try await second.value
        let refreshCount = await fixture.calls
        XCTAssertEqual(refreshCount, 1)
    }

    func testRefreshedReplacementOwnerNeverSuppliesPhotoBearer() async throws {
        let fixture = try PhotoRefreshFixture()
        let bearer = ProgressPhotoBearer(owner: "photo-owner", current: { await fixture.session },
                                         refresh: { await fixture.refresh() })
        let caller = Task { try await bearer.token() }
        await fixture.waitUntilRefreshing()
        await fixture.finish(ownerChanged: true)
        do { _ = try await caller.value; XCTFail("An old route received the replacement bearer") }
        catch let error as ProgressPhotoError { XCTAssertEqual(error, .unavailable) }
    }

    func testMultipartContainsOnlyCanonicalFileAndReservationMetadata() throws {
        let jpeg = Data([0xff, 0xd8, 0xff, 0xd9])
        let body = ProgressPhotoRepository.multipart(jpeg, id: photoFixtureId, boundary: "fixture")
        let payload = try XCTUnwrap(body.range(of: jpeg))
        let headers = String(decoding: body[..<payload.lowerBound], as: UTF8.self)
        XCTAssertTrue(headers.contains("name=\"bucket-id\"\r\n\r\nprogress_photos\r\n"))
        XCTAssertTrue(headers.contains("name=\"metadata[]\"; filename=\"\"\r\nContent-Type: application/json\r\n\r\n{\"id\":\"\(photoFixtureId)\"}"))
        XCTAssertTrue(headers.contains("name=\"file[]\"; filename=\"progress-photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n"))
        XCTAssertEqual(String(decoding: body[payload.upperBound...], as: UTF8.self), "\r\n--fixture--\r\n")
    }
}

private enum PhotoTestError: Error { case sdkGraphQLCalled }

private final class PhotoURLProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "photos.example.test" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let url = request.url,
              request.cachePolicy == .reloadIgnoringLocalCacheData,
              request.value(forHTTPHeaderField: "Cache-Control") == "no-store",
              request.value(forHTTPHeaderField: "Authorization")?.hasPrefix("Bearer ") == true else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        if request.httpMethod == "GET", url.path == "/v1/files/\(photoFixtureId)" {
            respond(url, mime: "image/jpeg", body: url.query ?? "original")
            return
        }
        guard request.httpMethod == "POST" else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let body = request.httpBody.map { String(decoding: $0, as: UTF8.self) } ?? ""
        let response = body.contains("ProgressPhotoDetails") ? #"{"data":{}}"# :
            #"{"data":{"progressPhotoLabels":[{"value":"test_angle","comment":"Fixture angle"}]}}"#
        respond(url, mime: "application/json", body: response)
    }

    private func respond(_ url: URL, mime: String, body: String) {
        let headers = ["Content-Type": mime, "Cache-Control": "public, max-age=86400"]
        if let http = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: headers) {
            client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .allowed)
            client?.urlProtocol(self, didLoad: Data(body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
    }
    override func stopLoading() {}
}

private actor PhotoCacheSpy: GraphQLCacheStore {
    var readWriteCount = 0
    func entry(for key: GraphQLCacheKey) async throws -> GraphQLCacheEntry? { readWriteCount += 1; return nil }
    func write(_ entry: GraphQLCacheEntry, for key: GraphQLCacheKey) async throws { readWriteCount += 1 }
    func removeEntry(for key: GraphQLCacheKey) async throws {}
    func touchEntry(for key: GraphQLCacheKey, at date: Date) async throws {}
    func invalidate(_ filter: GraphQLCacheStoreFilter) async throws -> Int { 0 }
    func prune() async throws {}
}

private actor PhotoRefreshFixture {
    var session: StoredSession
    let renewed: StoredSession
    let different: StoredSession
    var calls = 0
    var held: CheckedContinuation<StoredSession, Never>?
    var start: CheckedContinuation<Void, Never>?
    init() throws {
        session = try credential(owner: "photo-owner", lifetime: -60)
        renewed = try credential(owner: "photo-owner")
        different = try credential(owner: "different-owner")
    }
    func refresh() async -> StoredSession {
        calls += 1
        return await withCheckedContinuation { held = $0; start?.resume(); start = nil }
    }
    func waitUntilRefreshing() async {
        if held == nil { await withCheckedContinuation { start = $0 } }
    }
    func finish(ownerChanged: Bool) {
        session = ownerChanged ? different : renewed
        held?.resume(returning: session)
        held = nil
    }
}

private func credential(owner: String, lifetime: Int = 3600) throws -> StoredSession {
    let claims = try JSONSerialization.data(withJSONObject: ["exp": Int(Date().timeIntervalSince1970) + lifetime])
    let payload = claims.base64EncodedString().replacingOccurrences(of: "=", with: "")
        .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
    return try StoredSession(accessToken: "e30.\(payload).fixture", accessTokenExpiresIn: lifetime,
        refreshTokenId: "fixture", refreshToken: "fixture",
        user: AuthUser(avatarUrl: "", createdAt: Date(timeIntervalSince1970: 0), defaultRole: "user", displayName: "Fixture",
                       emailVerified: true, id: owner, isAnonymous: false, locale: "en", metadata: [:], phoneNumberVerified: false, roles: ["user"]))
}
