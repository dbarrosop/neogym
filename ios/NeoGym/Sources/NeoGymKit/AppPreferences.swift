import Foundation

/// The user's colour-scheme choice under Me › Account. Dark is the default.
public enum AppAppearance: String, CaseIterable, Identifiable, Sendable {
    case dark
    case light
    case system

    public static let storageKey = "neogym.appearance"
    public static let defaultValue: AppAppearance = .dark

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .dark: "Dark"
        case .light: "Light"
        case .system: "System"
        }
    }

    /// Unknown or missing stored values fall back to the default.
    public init(storedValue: String?) {
        self = storedValue.flatMap(AppAppearance.init(rawValue:)) ?? Self.defaultValue
    }
}

/// Rest lengths offered in the app, shared by the default setting and the timer.
public enum RestTimerPreference {
    public static let storageKey = "neogym.rest.defaultSeconds"
    public static let presets = [30, 60, 90, 180]
    public static let defaultSeconds = 90
    public static let extensionSeconds = 30

    /// Snaps a stored value to a supported preset, falling back to the default.
    public static func sanitized(_ seconds: Int?) -> Int {
        guard let seconds, presets.contains(seconds) else { return defaultSeconds }
        return seconds
    }

    /// Short label for a preset: "30 s", "1 min", "1:30", "3 min".
    public static func title(seconds: Int) -> String {
        if seconds < 60 { return "\(seconds) s" }
        if seconds.isMultiple(of: 60) { return "\(seconds / 60) min" }
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    /// Countdown label: "1:24".
    public static func countdown(_ seconds: Int) -> String {
        let clamped = max(seconds, 0)
        return String(format: "%d:%02d", clamped / 60, clamped % 60)
    }
}

/// One running rest, independent of any UI or notification plumbing.
public struct RestTimerSchedule: Equatable, Sendable {
    public let endDate: Date
    /// Total length in seconds, including any extensions.
    public let duration: Int
    /// Context such as "Leg Extensions · set 3 next".
    public let label: String?
    /// The session the rest belongs to, so the shell can reopen it.
    public let sessionId: String?

    public init(endDate: Date, duration: Int, label: String? = nil, sessionId: String? = nil) {
        self.endDate = endDate
        self.duration = duration
        self.label = label
        self.sessionId = sessionId
    }

    public static func start(
        seconds: Int,
        now: Date = Date(),
        label: String? = nil,
        sessionId: String? = nil
    ) -> RestTimerSchedule {
        let length = max(seconds, 1)
        return RestTimerSchedule(
            endDate: now.addingTimeInterval(TimeInterval(length)),
            duration: length,
            label: label,
            sessionId: sessionId
        )
    }

    public func extended(by seconds: Int) -> RestTimerSchedule {
        RestTimerSchedule(
            endDate: endDate.addingTimeInterval(TimeInterval(seconds)),
            duration: duration + seconds,
            label: label,
            sessionId: sessionId
        )
    }

    /// Whole seconds left, rounded up so the last second still shows "0:01".
    public func remainingSeconds(at now: Date = Date()) -> Int {
        max(0, Int(ceil(endDate.timeIntervalSince(now))))
    }

    public func isFinished(at now: Date = Date()) -> Bool {
        remainingSeconds(at: now) == 0
    }
}
