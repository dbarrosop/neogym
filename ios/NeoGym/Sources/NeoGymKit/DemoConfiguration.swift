import Foundation
import Nhost

public enum DemoScreen: String, CaseIterable, Sendable {
    case today
    case sessions = "train/sessions"
    case workouts = "train/workouts"
    case exercises = "train/exercises"
    case currentSession = "train/session/current"
    case log = "nutrition/log"
    case plans = "nutrition/plans"
    case foods = "nutrition/foods"
    case meals = "nutrition/meals"
    case overview = "progress/overview"
    case muscles = "progress/muscles"
    case strength = "progress/strength"
    case body = "progress/body"
    case energy = "progress/energy"
    case journal = "me/journal"
    case account = "me/account"
}

public struct DemoLaunchOptions: Sendable, Equatable {
    public var enabled = false
    public var reset = false
    public var screen: DemoScreen = .today

    public init(arguments: [String]) throws {
        var index = 1
        var hasDemoOptions = false
        while index < arguments.count {
            let argument = arguments[index]
            switch argument {
            case "--demo": enabled = true
            case "--demo-reset":
                reset = true
                hasDemoOptions = true
            case "--demo-screen", "--demo-scenario":
                hasDemoOptions = true
                index += 1
                guard index < arguments.count else { throw DemoLaunchError.invalidArguments }
                let value = arguments[index]
                if argument == "--demo-screen" {
                    guard let screen = DemoScreen(rawValue: value) else { throw DemoLaunchError.invalidArguments }
                    self.screen = screen
                } else if value != "populated" { throw DemoLaunchError.invalidArguments }
            default:
                if argument.hasPrefix("--demo") { throw DemoLaunchError.invalidArguments }
            }
            index += 1
        }
        if !enabled, hasDemoOptions { throw DemoLaunchError.invalidArguments }
    }
}

public enum DemoLaunchError: LocalizedError {
    case invalidArguments
    public var errorDescription: String? {
        "Invalid demo arguments. Use --demo [--demo-reset] [--demo-scenario populated] [--demo-screen SCREEN]."
    }
}

public enum DemoIdentity {
    /// Display-only shell identity. Never put it in an SDK session store or use it as a bearer.
    public static func session() throws -> StoredSession {
        try StoredSession(
            accessToken: "demo.not-a-credential.invalid", accessTokenExpiresIn: 900,
            refreshTokenId: "demo-not-a-credential", refreshToken: "demo-not-a-credential",
            user: AuthUser(
                avatarUrl: "", createdAt: Date(timeIntervalSince1970: 1_700_000_000), defaultRole: "user",
                displayName: "Alex Morgan · Demo", email: "alex@example.invalid", emailVerified: true,
                id: DemoStore.userId, isAnonymous: false, locale: "en", metadata: [:], phoneNumberVerified: false, roles: ["user"]
            ), decodedToken: DecodedToken(claims: [:])
        )
    }
}
