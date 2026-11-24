import AppIntents
import Foundation

/// Live Activity buttons. Both the app and the widget extension compile these types,
/// and the system runs a `LiveActivityIntent` in the app's process, so the app's
/// handler updates the session's own rest timer without opening the app. The
/// extension never installs a handler.
enum RestTimerIntentAction: Sendable {
    case extend
    case skip
}

@MainActor
enum RestTimerIntentRouter {
    static var handler: (@MainActor (RestTimerIntentAction) async -> Void)?

    static func perform(_ action: RestTimerIntentAction) async {
        await handler?(action)
    }
}

struct ExtendRestTimerIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Add 30 Seconds to Rest"
    static let description = IntentDescription("Adds 30 seconds to the running NeoGym rest timer.")
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        await RestTimerIntentRouter.perform(.extend)
        return .result()
    }
}

struct SkipRestTimerIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Skip Rest"
    static let description = IntentDescription("Ends the running NeoGym rest timer.")
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        await RestTimerIntentRouter.perform(.skip)
        return .result()
    }
}
