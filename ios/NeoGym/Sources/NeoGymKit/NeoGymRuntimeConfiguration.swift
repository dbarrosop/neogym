import Foundation

public struct NeoGymRuntimeConfiguration: Equatable, Sendable {
    public enum Key {
        public static let bundleIdentifier = "CFBundleIdentifier"
        public static let nhostSubdomain = "NeoGymNhostSubdomain"
        public static let nhostRegion = "NeoGymNhostRegion"
        public static let callbackScheme = "NeoGymCallbackScheme"
        public static let appGroupIdentifier = "NeoGymAppGroupIdentifier"
        public static let sharedKeychainAccessGroup = "NeoGymSharedKeychainAccessGroup"
        public static let sharedKeychainAccessGroupSuffix = "NeoGymSharedKeychainAccessGroupSuffix"
    }

    public let nhost: NhostConfig
    public let callbackScheme: String
    public let callbackURL: String
    public let appGroupIdentifier: String
    public let sharedKeychainAccessGroup: String
    public let sharedKeychainAccessGroupSuffix: String
    public let pkceServiceIdentifier: String
    public let notificationIdentifier: String
    public let widgetOpenURL: URL

    public init(infoDictionary: [String: Any]) throws {
        let bundleIdentifier = try Self.requiredValue(for: Key.bundleIdentifier, in: infoDictionary)
        let subdomain = try Self.requiredValue(for: Key.nhostSubdomain, in: infoDictionary)
        let region = try Self.requiredValue(for: Key.nhostRegion, in: infoDictionary)
        let callbackScheme = try Self.requiredValue(for: Key.callbackScheme, in: infoDictionary)
        let appGroupIdentifier = try Self.requiredValue(for: Key.appGroupIdentifier, in: infoDictionary)
        let accessGroup = try Self.requiredValue(for: Key.sharedKeychainAccessGroup, in: infoDictionary)
        let accessGroupSuffix = try Self.requiredValue(
            for: Key.sharedKeychainAccessGroupSuffix,
            in: infoDictionary
        )

        let hasExpectedAccessGroup = accessGroup == accessGroupSuffix
            || (accessGroup.hasSuffix(".\(accessGroupSuffix)")
                && accessGroup.count > accessGroupSuffix.count + 1)
        guard hasExpectedAccessGroup else {
            throw NeoGymRuntimeConfigurationError.inconsistentValue(
                key: Key.sharedKeychainAccessGroup
            )
        }

        let callbackURL = "\(callbackScheme)://verify"
        guard let widgetOpenURL = URL(string: "\(callbackScheme)://") else {
            throw NeoGymRuntimeConfigurationError.invalidValue(key: Key.callbackScheme)
        }

        nhost = NhostConfig(subdomain: subdomain, region: region)
        self.callbackScheme = callbackScheme
        self.callbackURL = callbackURL
        self.appGroupIdentifier = appGroupIdentifier
        sharedKeychainAccessGroup = accessGroup
        sharedKeychainAccessGroupSuffix = accessGroupSuffix
        pkceServiceIdentifier = "\(bundleIdentifier).auth"
        notificationIdentifier = "\(bundleIdentifier).rest-timer"
        self.widgetOpenURL = widgetOpenURL
    }

    public init(bundle: Bundle) throws {
        try self.init(infoDictionary: bundle.infoDictionary ?? [:])
    }

    private static func requiredValue(
        for key: String,
        in dictionary: [String: Any]
    ) throws -> String {
        guard let value = dictionary[key] else {
            throw NeoGymRuntimeConfigurationError.missingValue(key: key)
        }
        guard let value = value as? String else {
            throw NeoGymRuntimeConfigurationError.invalidValue(key: key)
        }
        guard !value.isEmpty else {
            throw NeoGymRuntimeConfigurationError.emptyValue(key: key)
        }
        guard !value.contains("$("), !value.contains("${") else {
            throw NeoGymRuntimeConfigurationError.unexpandedValue(key: key)
        }
        return value
    }
}

public enum NeoGymRuntimeConfigurationError: LocalizedError, Equatable, Sendable {
    case missingValue(key: String)
    case emptyValue(key: String)
    case unexpandedValue(key: String)
    case invalidValue(key: String)
    case inconsistentValue(key: String)

    public var errorDescription: String? {
        switch self {
        case let .missingValue(key):
            "Runtime configuration key is missing: \(key)"
        case let .emptyValue(key):
            "Runtime configuration key is empty: \(key)"
        case let .unexpandedValue(key):
            "Runtime configuration key is unexpanded: \(key)"
        case let .invalidValue(key):
            "Runtime configuration key is invalid: \(key)"
        case let .inconsistentValue(key):
            "Runtime configuration key is inconsistent: \(key)"
        }
    }
}
