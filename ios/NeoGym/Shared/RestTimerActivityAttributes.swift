import ActivityKit
import Foundation

@available(iOS 16.2, *)
@available(iOSApplicationExtension 16.2, *)
struct RestTimerActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endDate: Date
    }

    var startedAt: Date
    var duration: TimeInterval
}
