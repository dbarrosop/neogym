import Foundation
import Security

public protocol PKCEVerifierStoring: Sendable {
    func loadVerifier() async throws -> String?
    func saveVerifier(_ verifier: String) async throws
    func clearVerifier() async throws
}

public enum PKCEVerifierStoreError: LocalizedError, Equatable, Sendable {
    case unexpectedData
    case keychainFailure(status: OSStatus)

    public var errorDescription: String? {
        switch self {
        case .unexpectedData:
            "The saved email-change verifier is unreadable."
        case let .keychainFailure(status):
            "Keychain failed with status \(status)."
        }
    }
}

public struct KeychainPKCEVerifierStore: PKCEVerifierStoring {
    public static let defaultAccount = "pkce-email-change-verifier"

    private let service: String
    private let account: String

    public init(
        service: String,
        account: String = KeychainPKCEVerifierStore.defaultAccount
    ) {
        self.service = service
        self.account = account
    }

    public func loadVerifier() async throws -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw PKCEVerifierStoreError.keychainFailure(status: status)
        }

        guard let data = item as? Data, let verifier = String(data: data, encoding: .utf8) else {
            throw PKCEVerifierStoreError.unexpectedData
        }

        return verifier
    }

    public func saveVerifier(_ verifier: String) async throws {
        let data = Data(verifier.utf8)
        var query = baseQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecSuccess {
            return
        }

        if status == errSecDuplicateItem {
            let attributes = [kSecValueData as String: data]
            let updateStatus = SecItemUpdate(baseQuery() as CFDictionary, attributes as CFDictionary)
            guard updateStatus == errSecSuccess else {
                throw PKCEVerifierStoreError.keychainFailure(status: updateStatus)
            }
            return
        }

        throw PKCEVerifierStoreError.keychainFailure(status: status)
    }

    public func clearVerifier() async throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw PKCEVerifierStoreError.keychainFailure(status: status)
        }
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

public actor InMemoryPKCEVerifierStore: PKCEVerifierStoring {
    private var verifier: String?

    public init(verifier: String? = nil) {
        self.verifier = verifier
    }

    public func loadVerifier() async throws -> String? {
        verifier
    }

    public func saveVerifier(_ verifier: String) async throws {
        self.verifier = verifier
    }

    public func clearVerifier() async throws {
        verifier = nil
    }
}
