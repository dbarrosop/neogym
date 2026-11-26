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
        return try await query(Result.self, """
        query ProgressPhotoAngles { progressPhotoLabels(order_by: {value: asc}) { value comment } }
        """, [:]).progressPhotoLabels
    }

    public func page(angle: String?, after: ProgressPhotoCursor?) async throws -> ProgressPhotoPage {
        struct Result: Decodable { let progressPhotos: [ProgressPhoto] }
        let result = try await query(Result.self, """
        query ProgressPhotoHistory($where: progressPhoto_bool_exp!, $limit: Int!) {
          progressPhotos(where: $where, order_by: [{takenOn: desc}, {createdAt: desc}, {id: desc}], limit: $limit) {
            \(Self.selection)
          }
        }
        """, ["where": Self.galleryWhere(owner: owner, angle: angle, after: after), "limit": ProgressPhotoPage.size + 1])
        return ProgressPhotoPage(rows: result.progressPhotos)
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
        let (status, response) = try await send(files, method: "POST", contentType: "multipart/form-data; boundary=\(boundary)",
            body: Self.multipart(jpeg, id: id, boundary: boundary), timeout: 45)
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
        let (status, _) = try await send(fileURL(id), method: "DELETE")
        return (200..<300).contains(status) || status == 404
    }

    public func imageBytes(_ id: String, thumbnail: Bool) async throws -> Data {
        var parts = URLComponents(url: try fileURL(id), resolvingAgainstBaseURL: false)
        if thumbnail {
            parts?.queryItems = [
                .init(name: "w", value: String(ProgressPhotoImage.thumbnailWidth)),
                .init(name: "h", value: String(ProgressPhotoImage.thumbnailHeight))
            ]
        }
        guard let url = parts?.url else { throw ProgressPhotoError.unavailable }
        let (status, bytes) = try await send(url, method: "GET", timeout: 20, limit: ProgressPhotoImage.jpegLimit, image: true)
        guard status == 200, !bytes.isEmpty else { throw ProgressPhotoError.unavailable }
        return bytes
    }

    private func fileURL(_ id: String) throws -> URL {
        guard ProgressPhoto.canonical(id) else { throw ProgressPhotoError.unavailable }
        return files.appendingPathComponent(id)
    }

    private func query<T: Decodable>(_ type: T.Type, _ query: String, _ variables: [String: Any]) async throws -> T {
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables])
        let (status, bytes) = try await send(graphql, method: "POST", contentType: "application/json", body: body)
        guard status == 200 else { throw ProgressPhotoError.unavailable }
        // Never pass GraphQL messages, headers or response bodies to UI or logs.
        let result = try JSONDecoder().decode(Envelope<T>.self, from: bytes)
        guard result.errors?.isEmpty != false, let data = result.data else { throw ProgressPhotoError.unavailable }
        return data
    }

    private func send(_ url: URL, method: String, contentType: String? = nil, body: Data? = nil,
                      timeout: TimeInterval = 12, limit: Int = 512 * 1024, image: Bool = false) async throws -> (Int, Data) {
        do {
            let token = try await bearer.token()
            var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
            request.httpMethod = method
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
            request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            try await bearer.checkOwner()
            let result = try await transport.request(request, limit: limit, image: image)
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
