import Foundation

/// Plain-text, bounded diagnostics for an explicit system share action. The
/// source events contain only fixed categories, timestamps, and numeric codes.
public enum WatchEventExport {
    public static func text(events: [WatchEvent], generatedAt: Date = Date()) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)!
        var lines = [
            "NeoGym Watch events",
            "Generated: \(formatter.string(from: generatedAt)) (UTC)",
            "Events: \(events.count) (newest first)",
            "Accepted scheduling does not guarantee a wake; a WidgetKit reload request does not confirm a new display.",
            "A random attempt ID links events within one in-process attempt; "
                + "a later retry has a new ID and may show the pending wall-clock age.",
            "HealthKit acknowledged means its callback finished after a local handoff, not that a sync succeeded. "
                + "Legacy timeout events may have been acknowledged long after 25s if the app was suspended.",
            "Pending age and stage elapsed times use wall clock, including watch sleep; "
                + "stage starts without ends may reflect suspension, not a failed query.",
            "Observer Started marks main-actor handling; acknowledgement uses callback time, "
                + "so the two can appear in either order after suspension.",
            "A missing background expiry event does not prove work finished. "
                + "App state is recorded only when the scene reports a transition.",
            "Transport diagnostics contain only a fixed cause and URLSession code or HTTP status; "
                + "legacy code 3 was a Swift enum index.",
            "No account identifiers, credentials, URLs, health values, or raw error descriptions are included.",
            ""
        ]
        if events.isEmpty { lines.append("No events recorded.") }
        for event in events.sorted(by: { $0.occurredAt > $1.occurredAt }) {
            let trigger = event.trigger.map { " · \($0.title)" } ?? ""
            let details = event.diagnosticDetails.map { " · \($0)" } ?? ""
            lines.append(
                "\(formatter.string(from: event.occurredAt)) | \(event.action.title) | "
                    + "\(event.outcome.title)\(trigger)\(details)"
            )
        }
        return lines.joined(separator: "\n") + "\n"
    }

    /// Overwrite a single temporary text file rather than accumulating exports.
    /// The system can copy it when preparing the chosen share destination.
    public static func write(
        events: [WatchEvent],
        to directory: URL = FileManager.default.temporaryDirectory,
        generatedAt: Date = Date()
    ) throws -> URL {
        let url = directory.appendingPathComponent("NeoGym-Watch-Events.txt", isDirectory: false)
        try text(events: events, generatedAt: generatedAt).write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}
