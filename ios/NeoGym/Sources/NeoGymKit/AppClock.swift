import Foundation

/// A versioned, opt-in documentation fixture. Never changes the OS or SDK clock.
public struct DemoCaptureProfile: Equatable, Sendable {
    public let version: Int
    public let now: Date
    public let timeZone: TimeZone
    public let locale: Locale

    public var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.locale = locale
        return calendar
    }

    public static func requested(environment: [String: String] = ProcessInfo.processInfo.environment) throws -> Self? {
        guard environment["NEOGYM_DEMO_CAPTURE"] == "1" else { return nil }
        guard let url = Bundle.module.url(forResource: "gallery-capture", withExtension: "json") else {
            throw DemoError.incompatibleData
        }
        return try Self(data: Data(contentsOf: url))
    }

    public init(data: Data) throws {
        struct Specification: Decodable {
            let version: Int
            let now: String
            let timeZone: String
            let locale: String
        }
        let spec = try JSONDecoder().decode(Specification.self, from: data)
        guard spec.version == 1,
              let instant = ISO8601DateFormatter().date(from: spec.now),
              let zone = TimeZone(identifier: spec.timeZone),
              spec.locale == "en_US" else { throw DemoError.incompatibleData }
        version = spec.version
        now = instant
        timeZone = zone
        locale = Locale(identifier: spec.locale)
    }
}

/// Application/domain time only. Network deadlines, Auth and HealthKit keep system time.
/// The composition root enables this solely while an explicitly opted-in demo is active.
public enum AppClock {
    private final class Storage: @unchecked Sendable {
        let lock = NSLock()
        var profile: DemoCaptureProfile?
    }
    private static let storage = Storage()

    public static var captureProfile: DemoCaptureProfile? {
        storage.lock.lock()
        defer { storage.lock.unlock() }
        return storage.profile
    }

    public static func useDemoCapture(_ profile: DemoCaptureProfile?) {
        storage.lock.lock()
        defer { storage.lock.unlock() }
        storage.profile = profile
    }

    public static func now() -> Date { captureProfile?.now ?? Date() }
    public static func resolve(_ date: Date) -> Date { captureProfile?.now ?? date }
    public static var calendar: Calendar { captureProfile?.calendar ?? .current }
}
