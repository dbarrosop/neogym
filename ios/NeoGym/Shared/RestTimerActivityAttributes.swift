import ActivityKit
import Foundation

struct RestTimerActivityAttributes: ActivityAttributes {
    /// Token-free display state. New fields are optional so an activity started by an
    /// earlier build still decodes after an update.
    struct ContentState: Codable, Hashable {
        var endDate: Date
        /// Total rest length in seconds, including +30 s extensions.
        var duration: TimeInterval?
        var exerciseName: String?
        var nextSetNumber: Int?
        /// The next set's target prefilled from the set just logged: "95 kg × 10".
        var target: String?
        var sessionId: String?

        init(
            endDate: Date, duration: TimeInterval? = nil, exerciseName: String? = nil,
            nextSetNumber: Int? = nil, target: String? = nil, sessionId: String? = nil
        ) {
            self.endDate = endDate
            self.duration = duration
            self.exerciseName = exerciseName
            self.nextSetNumber = nextSetNumber
            self.target = target
            self.sessionId = sessionId
        }

        /// The countdown's start, so the bar shows time left across extensions.
        func startDate(fallback: Date) -> Date {
            guard let duration, duration > 0 else { return min(fallback, endDate) }
            return endDate.addingTimeInterval(-duration)
        }

        /// The session pill's words: "Leg Extensions · set 3 next".
        var runningLabel: String? {
            guard let exerciseName else { return nil }
            return nextSetNumber.map { "\(exerciseName) · set \($0) next" } ?? exerciseName
        }

        /// After the rest: "Leg Extensions · set 3".
        var finishedLabel: String? {
            guard let exerciseName else { return nil }
            return nextSetNumber.map { "\(exerciseName) · set \($0)" } ?? exerciseName
        }
    }

    var startedAt: Date
    var duration: TimeInterval
}
