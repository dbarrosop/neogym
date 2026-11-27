import Foundation
import Nhost

public struct ProgressPhotoRepository: ProgressPhotoRepositoryProtocol {
    private let owner: String
    private let graphql: URL
    private let files: URL
    private let bearer: ProgressPhotoBearer
    private let transport: ProgressPhotoTransport

    public init?(client: NhostClient, owner: String) {
        self.init(client: client, owner: owner, transport: ProgressPhotoTransport())
    }

    init?(client: NhostClient, owner: String, transport: ProgressPhotoTransport) {
        let urls = client.serviceURLs
        guard !owner.isEmpty, [urls.graphql, urls.storage, urls.auth].allSatisfy(Self.secureEndpoint) else { return nil }
        self.owner = owner
        graphql = urls.graphql
        files = urls.storage.appendingPathComponent("files")
        self.transport = transport
        // Same SDK-managed session store and transaction lock as the app/widget.
        // Use a no-redirect Auth transport too: /token contains a refresh credential.
        let refresher = SessionRefresher(auth: AuthClient(baseURL: urls.auth, transport: transport.sdkTransport),
                                         store: client.sessionStore)
        bearer = ProgressPhotoBearer(owner: owner, current: { try await client.getUserSession() },
                                     refresh: {
                                         defer { withExtendedLifetime(transport) {} }
                                         return try await refresher.refreshSession()
                                     })
    }

    private static func secureEndpoint(_ url: URL) -> Bool {
        url.scheme == "https" && url.host != nil && url.user == nil && url.password == nil && url.fragment == nil && url.query == nil
    }

    public func angles() async throws -> [ProgressPhotoAngle] {
        struct Result: Decodable { let progressPhotoLabels: [ProgressPhotoAngle] }
        let result = try await query(Result.self, """
        query ProgressPhotoAngles { progressPhotoLabels(order_by: {value: asc}) { value comment } }
        """, [:])
        return ProgressPhotoHistory.sortedAngles(result.progressPhotoLabels)
    }

    public func summary() async throws -> ProgressPhotoSummary {
        struct Result: Decodable {
            struct Aggregate: Decodable {
                struct Fields: Decodable {
                    struct Maximum: Decodable { let takenOn: String? }
                    let count: Int
                    let max: Maximum?
                }
                let aggregate: Fields?
            }
            let progressPhotosAggregate: Aggregate
        }
        let result = try await query(Result.self, """
        query ProgressPhotoSummary($where: progressPhoto_bool_exp!) {
          progressPhotosAggregate(where: $where) { aggregate { count max { takenOn } } }
        }
        """, ["where": Self.galleryWhere(owner: owner, angle: nil, after: nil)])
        guard let aggregate = result.progressPhotosAggregate.aggregate else { throw ProgressPhotoError.unavailable }
        return .init(count: aggregate.count, latestDate: aggregate.max?.takenOn)
    }

    public func photos(on date: String) async throws -> [ProgressPhoto] {
        var filter = Self.galleryWhere(owner: owner, angle: nil, after: nil)
        filter["takenOn"] = ["_eq": date]
        return ProgressPhotoHistory.unique(try await photos(where: filter, limit: 8))
    }

    public func history(angle: String) async throws -> [ProgressPhoto] {
        try await ProgressPhotoHistory.unique(photos(where: Self.galleryWhere(owner: owner, angle: angle, after: nil),
                                                    limit: ProgressPhotoHistory.angleLimit))
    }

    public func measurements(on dates: [String]) async throws -> [BodyMeasurement] {
        guard !dates.isEmpty else { return [] }
        struct Result: Decodable { let bodyMeasurements: [BodyMeasurement] }
        let filter: [String: Any] = ["userId": ["_eq": owner], "measuredOn": ["_in": Array(Set(dates)).sorted()]]
        return try await query(Result.self, """
        query ProgressPhotoMeasurements($where: bodyMeasurements_bool_exp!) {
          bodyMeasurements(where: $where) { id measuredOn weightKg bodyFatPct }
        }
        """, ["where": filter]).bodyMeasurements
    }

    public func page(angle: String?, after: ProgressPhotoCursor?) async throws -> ProgressPhotoPage {
        try await ProgressPhotoPage(rows: photos(where: Self.galleryWhere(owner: owner, angle: angle, after: after),
                                                limit: ProgressPhotoPage.size + 1))
    }

    private func photos(where filter: [String: Any], limit: Int) async throws -> [ProgressPhoto] {
        struct Result: Decodable { let progressPhotos: [ProgressPhoto] }
        return try await query(Result.self, """
        query ProgressPhotoHistory($where: progressPhoto_bool_exp!, $limit: Int!) {
          progressPhotos(where: $where, order_by: [{takenOn: desc}, {createdAt: desc}, {id: desc}], limit: $limit) {
            \(Self.selection)
          }
        }
        """, ["where": filter, "limit": limit]).progressPhotos
    }

    static func galleryWhere(owner: String, angle: String?, after: ProgressPhotoCursor?) -> [String: Any] {
        var filter: [String: Any] = ["userId": ["_eq": owner], "file": ["isUploaded": ["_eq": true]]]
        if let angle { filter["labelValue"] = ["_eq": angle] }
        if let after {
            filter["_or"] = [
                ["takenOn": ["_lt": after.takenOn]],
                ["takenOn": ["_eq": after.takenOn], "createdAt": ["_lt": after.createdAt]],
                ["takenOn": ["_eq": after.takenOn], "createdAt": ["_eq": after.createdAt], "id": ["_lt": after.id]]
            ]
        }
        return filter
    }

    public func reservation(_ id: String) async throws -> ProgressPhoto? {
        struct Result: Decodable {
            let progressPhoto: ProgressPhoto?
            private enum CodingKeys: CodingKey { case progressPhoto }
            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                // Only explicit null establishes inaccessibility during deletion.
                progressPhoto = try container.decode(ProgressPhoto?.self, forKey: .progressPhoto)
            }
        }
        guard ProgressPhoto.canonical(id) else { throw ProgressPhotoError.unavailable }
        let result = try await query(Result.self, """
        query ProgressPhotoDetails($id: uuid!) { progressPhoto(id: $id) { \(Self.selection) } }
        """, ["id": id])
        guard result.progressPhoto == nil || result.progressPhoto?.id == id else { throw ProgressPhotoError.unavailable }
        return result.progressPhoto
    }

    public func reserve(_ fields: ProgressPhotoFields) async throws -> String {
        struct Result: Decodable { let insertProgressPhoto: ID? }
        let result = try await query(Result.self, """
        mutation ReserveProgressPhoto($label: progressPhotoLabel_enum!, $date: date!) {
          insertProgressPhoto(object: {labelValue: $label, takenOn: $date}) { id }
        }
        """, ["label": fields.label, "date": fields.date])
        guard let id = result.insertProgressPhoto?.id, ProgressPhoto.canonical(id) else { throw ProgressPhotoError.unavailable }
        return id
    }

    public func update(_ id: String, fields: ProgressPhotoFields) async throws -> Bool {
        struct Result: Decodable { let updateProgressPhoto: ID? }
        guard ProgressPhoto.canonical(id) else { throw ProgressPhotoError.unavailable }
        let result = try await query(Result.self, """
        mutation UpdateProgressPhoto($id: uuid!, $label: progressPhotoLabel_enum!, $date: date!) {
          updateProgressPhoto(pk_columns: {id: $id}, _set: {labelValue: $label, takenOn: $date}) { id }
        }
        """, ["id": id, "label": fields.label, "date": fields.date])
        return result.updateProgressPhoto?.id == id
    }

    public func upload(_ jpeg: Data, to id: String) async throws -> Bool {
        guard ProgressPhoto.canonical(id), !jpeg.isEmpty, jpeg.count <= ProgressPhotoImage.jpegLimit else {
            throw ProgressPhotoError.unavailable
        }
        struct Result: Decodable { let processedFiles: [ProgressPhoto.File] }
        let boundary = "NeoGym-\(UUID().uuidString)"
        let (status, response, _) = try await send(files, method: "POST", contentType: "multipart/form-data; boundary=\(boundary)",
            body: Self.multipart(jpeg, id: id, boundary: boundary), timeout: 45, uploading: true)
        guard (200..<300).contains(status) else { return false }
        let result = try JSONDecoder().decode(Result.self, from: response)
        return result.processedFiles.count == 1 && result.processedFiles.first == .init(id: id, isUploaded: true)
    }

    static func multipart(_ jpeg: Data, id: String, boundary: String) -> Data {
        let line = "--\(boundary)\r\n"
        var body = Data((line + "Content-Disposition: form-data; name=\"bucket-id\"\r\n\r\nprogress_photos\r\n"
            + line + "Content-Disposition: form-data; name=\"metadata[]\"; filename=\"\"\r\nContent-Type: application/json\r\n\r\n{\"id\":\"\(id)\"}\r\n"
            + line + "Content-Disposition: form-data; name=\"file[]\"; filename=\"progress-photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").utf8)
        body.append(jpeg)
        body.append(contentsOf: "\r\n--\(boundary)--\r\n".utf8)
        return body
    }

    public func delete(_ id: String) async throws -> Bool {
        let (status, _, _) = try await send(fileURL(id), method: "DELETE")
        return (200..<300).contains(status) || status == 404
    }

    public func imageBytes(_ id: String, thumbnail: Bool) async throws -> Data {
        guard case let .image(bytes, _) = try await fetchImage(id, thumbnail: thumbnail, ifNoneMatch: nil) else {
            throw ProgressPhotoError.unavailable
        }
        return bytes
    }

    public func fetchImage(_ id: String, thumbnail: Bool, ifNoneMatch: String?) async throws -> ProgressPhotoImageResponse {
        var parts = URLComponents(url: try fileURL(id), resolvingAgainstBaseURL: false)
        if thumbnail {
            parts?.queryItems = [
                .init(name: "w", value: String(ProgressPhotoImage.thumbnailWidth)),
                .init(name: "h", value: String(ProgressPhotoImage.thumbnailHeight))
            ]
        }
        guard let url = parts?.url else { throw ProgressPhotoError.unavailable }
        let validator = Self.validETag(ifNoneMatch)
        let (status, bytes, etag) = try await send(url, method: "GET", timeout: 20,
                                                  limit: ProgressPhotoImage.jpegLimit, image: true, ifNoneMatch: validator)
        if status == 304, validator != nil { return .notModified }
        guard status == 200, !bytes.isEmpty else { throw ProgressPhotoError.unavailable }
        return .image(bytes, etag: Self.validETag(etag))
    }

    private static func validETag(_ value: String?) -> String? {
        guard let value, value.utf8.count <= 256 else { return nil }
        let opaque = value.hasPrefix("W/") ? value.dropFirst(2) : value[...]
        guard opaque.count >= 2, opaque.first == "\"", opaque.last == "\"",
              opaque.dropFirst().dropLast().utf8.allSatisfy({ $0 == 0x21 || (0x23...0x7e).contains($0) }) else { return nil }
        return value
    }

    private func fileURL(_ id: String) throws -> URL {
        guard ProgressPhoto.canonical(id) else { throw ProgressPhotoError.unavailable }
        return files.appendingPathComponent(id)
    }

    private func query<T: Decodable>(_ type: T.Type, _ query: String, _ variables: [String: Any]) async throws -> T {
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables])
        let (status, bytes, _) = try await send(graphql, method: "POST", contentType: "application/json", body: body)
        guard status == 200 else { throw ProgressPhotoError.unavailable }
        // Never pass GraphQL messages, headers or response bodies to UI or logs.
        let result = try JSONDecoder().decode(Envelope<T>.self, from: bytes)
        guard result.errors?.isEmpty != false, let data = result.data else { throw ProgressPhotoError.unavailable }
        return data
    }

    private func send(_ url: URL, method: String, contentType: String? = nil, body: Data? = nil,
                      timeout: TimeInterval = 12, limit: Int = 512 * 1024, image: Bool = false,
                      ifNoneMatch: String? = nil, uploading: Bool = false) async throws -> (Int, Data, String?) {
        do {
            let token = try await bearer.token()
            var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
            request.httpMethod = method
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
            request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
            request.setValue(ifNoneMatch, forHTTPHeaderField: "If-None-Match")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            try await bearer.checkOwner()
            let result = try await transport.request(request, limit: limit, image: image, uploading: uploading)
            try await bearer.checkOwner()
            return result
        } catch {
            try Task.checkCancellation()
            // Do not let transport error text cross this private boundary.
            throw ProgressPhotoError.unavailable
        }
    }

    private static let selection = "id takenOn createdAt label { value comment } file { id isUploaded }"
    private struct ID: Decodable { let id: String }
    private struct Envelope<T: Decodable>: Decodable {
        struct Rejection: Decodable {}
        let data: T?
        let errors: [Rejection]?
    }
}
