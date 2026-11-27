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
        let summary = try await repo.summary()
        XCTAssertEqual(summary, .init(count: 3, latestDate: "2024-02-29"))
        let checkIn = try await repo.photos(on: "2024-02-29")
        let history = try await repo.history(angle: "front_a")
        XCTAssertEqual(checkIn.map(\.id), [photoFixtureId])
        XCTAssertEqual(history.map(\.id), [photoFixtureId])
        let measurements = try await repo.measurements(on: ["2024-02-29", "2024-02-29"])
        XCTAssertEqual(measurements.map(\.weightKg), [73.2])
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

    func testConditionalImageRetainsDecodedPixelsOn304AndEvictsOn403() async throws {
        let repo = try imageRepository()
        let cache = ProgressPhotoImageCache(freshness: 0)
        let scope = ProgressPhotoRouteScope()
        let full = ProgressPhotoImageCache.Key(id: conditionalFixtureId, thumbnail: false)
        let thumb = ProgressPhotoImageCache.Key(id: conditionalFixtureId, thumbnail: true)
        let original = try await cache.load(full, repository: repo, scope: scope)
        XCTAssertEqual(original.width, 6)
        XCTAssertTrue(cache.image(for: full) === original)
        XCTAssertNil(cache.image(for: thumb))
        let unchanged = try await cache.load(full, repository: repo, scope: scope)
        XCTAssertTrue(unchanged === original, "304 must reuse the existing decoded image")

        _ = try await cache.load(thumb, repository: repo, scope: scope)
        do {
            _ = try await cache.load(thumb, repository: repo, scope: scope)
            XCTFail("403 must not validate the thumbnail")
        } catch let error as ProgressPhotoError { XCTAssertEqual(error, .unavailable) }
        XCTAssertNil(cache.image(for: thumb))
        XCTAssertNil(cache.image(for: full), "A denied read must evict both renditions")
    }

    func testCacheBoundsAndClearingDoNotPersistAnyPhoto() async throws {
        let repo = try imageRepository()
        let scope = ProgressPhotoRouteScope()
        let key = ProgressPhotoImageCache.Key(id: conditionalFixtureId, thumbnail: false)
        let thumb = ProgressPhotoImageCache.Key(id: conditionalFixtureId, thumbnail: true)
        let cache = ProgressPhotoImageCache()
        let image = try await cache.load(key, repository: repo, scope: scope)
        let bounded = ProgressPhotoImageCache(byteLimit: image.bytesPerRow * image.height)
        _ = try await bounded.load(key, repository: repo, scope: scope)
        _ = try await bounded.load(thumb, repository: repo, scope: scope)
        XCTAssertNil(bounded.image(for: key))
        XCTAssertNotNil(bounded.image(for: thumb))
        bounded.remove(id: conditionalFixtureId)
        XCTAssertNil(bounded.image(for: thumb))
        cache.clear()
        XCTAssertNil(cache.image(for: key))
    }

    func testUnsolicitedNotModifiedIsNotAccepted() async throws {
        let repo = try imageRepository()
        do {
            _ = try await repo.fetchImage(unsolicitedFixtureId, thumbnail: false, ifNoneMatch: "*")
            XCTFail("Invalid validator must never validate an unsolicited 304")
        } catch let error as ProgressPhotoError { XCTAssertEqual(error, .unavailable) }
    }

    private func imageRepository() throws -> ProgressPhotoRepository {
        let session = try credential(owner: "photo-owner")
        let client = createClient(NhostClientOptions(
            storageURL: URL(string: "https://photos.example.test/v1"),
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: session))
        ))
        let configuration = ProgressPhotoTransport.configuration()
        configuration.protocolClasses = [PhotoURLProtocol.self]
        return try XCTUnwrap(ProgressPhotoRepository(client: client, owner: "photo-owner",
                                                        transport: ProgressPhotoTransport(configuration: configuration)))
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

private let conditionalFixtureId = "00000000-0000-4000-8000-000000009001"
private let unsolicitedFixtureId = "00000000-0000-4000-8000-000000009002"

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
        if request.httpMethod == "GET", url.path == "/v1/files/\(conditionalFixtureId)" {
            let etag = url.query == nil ? "\"original-v1\"" : "W/\"thumbnail-v1\""
            let validator = request.value(forHTTPHeaderField: "If-None-Match")
            XCTAssertTrue(validator == nil || validator == etag, "Each rendition must send only its own validator")
            let status = validator == etag ? (url.query == nil ? 304 : 403) : 200
            let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAYAAAAICAIAAABVpBlvAAAAEUlEQVR4nGOYve8EGmIYDEIAUCpmMfUNqeIAAAAASUVORK5CYII=")!
            respond(url, mime: "image/png", bytes: status == 200 ? png : Data(), status: status, etag: etag)
            return
        }
        if request.httpMethod == "GET", url.path == "/v1/files/\(unsolicitedFixtureId)" {
            XCTAssertNil(request.value(forHTTPHeaderField: "If-None-Match"))
            respond(url, mime: "image/png", bytes: Data(), status: 304, etag: "\"unexpected\"")
            return
        }
        guard request.httpMethod == "POST" else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        guard let body = fixtureRequestBody(),
              let payload = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any],
              let query = payload["query"] as? String,
              let variables = payload["variables"] as? [String: Any] else {
            XCTFail("Expected a GraphQL query with variables in the fixture request")
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        guard let response = graphQLResponse(query: query, variables: variables) else {
            XCTFail("Unexpected photo GraphQL operation or filter in the fixture: \(query) \(variables)")
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        respond(url, mime: "application/json", body: response)
    }

    private func fixtureRequestBody() -> Data? {
        if let body = request.httpBody { return body }
        // Foundation may surface a POST body as a stream at the URLProtocol boundary.
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var buffer = [UInt8](repeating: 0, count: 1_024)
        var data = Data()
        while data.count < 32 * 1_024 {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count < 0 { return nil }
            if count == 0 { return data }
            data.append(contentsOf: buffer.prefix(count))
        }
        return nil
    }

    private func graphQLResponse(query: String, variables: [String: Any]) -> String? {
        if query.contains("ProgressPhotoDetails") { return #"{"data":{}}"# }
        if query.contains("ProgressPhotoAngles") {
            return #"{"data":{"progressPhotoLabels":[{"value":"test_angle","comment":"Fixture angle"}]}}"#
        }
        guard let filter = variables["where"] as? [String: Any],
              filter["userId"] as? [String: String] == ["_eq": "photo-owner"] else { return nil }
        if query.contains("ProgressPhotoMeasurements") {
            guard filter["measuredOn"] as? [String: [String]] == ["_in": ["2024-02-29"]] else { return nil }
            return #"{"data":{"bodyMeasurements":[{"id":"measurement","measuredOn":"2024-02-29","weightKg":"73.2","bodyFatPct":null}]}}"#
        }
        guard let file = filter["file"] as? [String: [String: Bool]], file == ["isUploaded": ["_eq": true]] else { return nil }
        if query.contains("ProgressPhotoSummary") {
            return #"{"data":{"progressPhotosAggregate":{"aggregate":{"count":3,"max":{"takenOn":"2024-02-29"}}}}}"#
        }
        if query.contains("ProgressPhotoHistory") {
            let isDay = filter["takenOn"] as? [String: String] == ["_eq": "2024-02-29"] && variables["limit"] as? Int == 8
            let isAngle = filter["labelValue"] as? [String: String] == ["_eq": "front_a"] && variables["limit"] as? Int == 500
            guard isDay || isAngle else { return nil }
            return #"""
            {"data":{"progressPhotos":[{"id":"\#(photoFixtureId)","takenOn":"2024-02-29","createdAt":"2024-03-01T00:00:00Z",
            "label":{"value":"front_a"},"file":{"id":"\#(photoFixtureId)","isUploaded":true}}]}}
            """#
        }
        return nil
    }

    private func respond(_ url: URL, mime: String, body: String) {
        respond(url, mime: mime, bytes: Data(body.utf8), status: 200, etag: nil)
    }

    private func respond(_ url: URL, mime: String, bytes: Data, status: Int, etag: String?) {
        var headers = ["Content-Type": mime, "Cache-Control": "public, max-age=86400"]
        headers["ETag"] = etag
        if let http = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: headers) {
            client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .allowed)
            if !bytes.isEmpty { client?.urlProtocol(self, didLoad: bytes) }
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
