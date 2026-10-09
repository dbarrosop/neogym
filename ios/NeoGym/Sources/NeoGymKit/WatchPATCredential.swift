import Foundation
import Nhost
import Security

/// An app-user Auth PAT, not a Nhost Cloud/account PAT. Never put it in
/// application context, a widget snapshot, logs, or the SDK's session slot.
public struct WatchPATCredential: Codable, Sendable, Equatable {
    public let userID: String
    public let token: String
    public let expiresAt: Date

    public init(userID: String, token: String, expiresAt: Date) {
        self.userID = userID
        self.token = token
        self.expiresAt = expiresAt
    }

    public func isValid(at date: Date) -> Bool {
        !userID.isEmpty && !token.isEmpty && expiresAt > date
    }
}

public protocol WatchPATStoring: Sendable {
    func load() throws -> WatchPATCredential?
    func save(_ credential: WatchPATCredential) throws
    func clear() throws
}

/// Private to the watch app process, device-only and independent of SDK session
/// rotation. The widget has neither the item nor this store.
public struct WatchPATKeychainStore: WatchPATStoring {
    private let service = "io.nhost.neogym.watch.pat.v1"
    private let account = "watch"

    public init() {}

    public func load() throws -> WatchPATCredential? {
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query([kSecReturnData: true, kSecMatchLimit: kSecMatchLimitOne]) as CFDictionary,
                                         &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw StoreError.keychain(status) }
        return try JSONDecoder().decode(WatchPATCredential.self, from: data)
    }

    public func save(_ credential: WatchPATCredential) throws {
        let data = try JSONEncoder().encode(credential)
        var attributes = query([kSecValueData: data, kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly])
        let status = SecItemAdd(attributes as CFDictionary, nil)
        if status == errSecDuplicateItem {
            attributes = [kSecValueData: data]
            let updated = SecItemUpdate(query() as CFDictionary, attributes as CFDictionary)
            guard updated == errSecSuccess else { throw StoreError.keychain(updated) }
        } else if status != errSecSuccess { throw StoreError.keychain(status) }
    }

    public func clear() throws {
        let status = SecItemDelete(query() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw StoreError.keychain(status) }
    }

    private func query(_ extras: [CFString: Any] = [:]) -> [CFString: Any] {
        var result: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword, kSecAttrService: service, kSecAttrAccount: account
        ]
        for (key, value) in extras { result[key] = value }
        return result
    }

    public enum StoreError: Error { case keychain(OSStatus) }
}

public protocol WatchPATServicing: Sendable {
    func create(expiresAt: Date) async throws -> String
    func signIn(token: String) async throws -> StoredSession?
}

public struct NhostWatchPATService: WatchPATServicing {
    public let client: NhostClient

    public init(client: NhostClient) { self.client = client }

    public func create(expiresAt: Date) async throws -> String {
        try await client.auth.createPAT(body: AuthCreatePATRequest(expiresAt: expiresAt,
            metadata: ["device": .string("neogym-watch")])).body.personalAccessToken
    }

    public func signIn(token: String) async throws -> StoredSession? {
        let response = try await client.auth.signInPAT(body: AuthSignInPATRequest(personalAccessToken: token))
        guard let session = response.body.session else { return nil }
        return try StoredSession(session)
    }
}
