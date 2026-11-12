import ActivityKit
import Foundation
import NeoGymKit
@preconcurrency import UserNotifications

/// The one shell-owned rest timer. It survives tab switches and navigation,
/// mirrors itself into a Live Activity and a local notification, and restores
/// a still-running rest after relaunch.
@MainActor
final class RestTimerController: ObservableObject {
    @Published private(set) var schedule: RestTimerSchedule?
    @Published private(set) var remainingSeconds = 0
    /// Display names of sessions opened this run, so the shell accessory can
    /// title a live session without refetching it.
    @Published private(set) var sessionNames: [String: String] = [:]

    private var tickerTask: Task<Void, Never>?
    private let defaults: UserDefaults
    nonisolated private static let notificationIdentifier = "io.nhost.neogym.rest-timer"
    private static let persistedKey = "neogym.rest.running"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        restore()
    }

    var isRunning: Bool { schedule != nil }

    var formattedRemaining: String { RestTimerPreference.countdown(remainingSeconds) }

    var defaultSeconds: Int {
        RestTimerPreference.sanitized(defaults.object(forKey: RestTimerPreference.storageKey) as? Int)
    }

    func noteSession(id: String, name: String) {
        if sessionNames[id] != name { sessionNames[id] = name }
    }

    /// Starts a rest of `seconds`, or the default length set under Me › Account.
    func start(seconds: Int? = nil, label: String? = nil, sessionId: String? = nil) {
        let next = RestTimerSchedule.start(seconds: seconds ?? defaultSeconds, label: label, sessionId: sessionId)
        apply(next)
        Self.scheduleNotification(after: next.remainingSeconds(), label: label)
        RestTimerLiveActivity.start(duration: next.duration, endDate: next.endDate)
    }

    /// Adds time to the running rest (the accessory's "+30 s").
    func extend(by seconds: Int = RestTimerPreference.extensionSeconds) {
        guard let schedule else { return }
        let next = schedule.extended(by: seconds)
        apply(next)
        Self.scheduleNotification(after: next.remainingSeconds(), label: next.label)
        RestTimerLiveActivity.update(endDate: next.endDate)
    }

    /// Ends the rest now (the accessory's Skip).
    func cancel() {
        tickerTask?.cancel()
        tickerTask = nil
        schedule = nil
        remainingSeconds = 0
        persist(nil)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])
        RestTimerLiveActivity.end()
    }

    func refresh() {
        updateRemaining()
        if isRunning { startTicker() }
    }

    private func apply(_ next: RestTimerSchedule) {
        schedule = next
        remainingSeconds = next.remainingSeconds()
        persist(next)
        startTicker()
    }

    private func startTicker() {
        tickerTask?.cancel()
        tickerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled, let self else { return }
                self.updateRemaining()
                if !self.isRunning { return }
            }
        }
    }

    private func updateRemaining() {
        guard let schedule else { return }
        remainingSeconds = schedule.remainingSeconds()
        if schedule.isFinished() {
            tickerTask?.cancel()
            tickerTask = nil
            self.schedule = nil
            persist(nil)
            RestTimerLiveActivity.end()
        }
    }

    // MARK: - Persistence

    private func persist(_ schedule: RestTimerSchedule?) {
        guard let schedule else {
            defaults.removeObject(forKey: Self.persistedKey)
            return
        }
        var stored: [String: Any] = [
            "endDate": schedule.endDate.timeIntervalSince1970,
            "duration": schedule.duration
        ]
        stored["label"] = schedule.label
        stored["sessionId"] = schedule.sessionId
        defaults.set(stored, forKey: Self.persistedKey)
    }

    private func restore() {
        guard let stored = defaults.dictionary(forKey: Self.persistedKey),
              let end = stored["endDate"] as? TimeInterval,
              let duration = stored["duration"] as? Int
        else { return }
        let restored = RestTimerSchedule(
            endDate: Date(timeIntervalSince1970: end),
            duration: duration,
            label: stored["label"] as? String,
            sessionId: stored["sessionId"] as? String
        )
        if restored.isFinished() {
            persist(nil)
        } else {
            apply(restored)
        }
    }

    // MARK: - Notification

    private static func scheduleNotification(after seconds: Int, label: String?) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])
        guard seconds > 0 else { return }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest complete"
            content.body = label ?? "Time to start your next set."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(seconds), repeats: false)
            let request = UNNotificationRequest(identifier: notificationIdentifier, content: content, trigger: trigger)
            UNUserNotificationCenter.current().add(request)
        }
    }
}

/// Live Activity mirror of the running rest (Lock Screen and Dynamic Island).
private enum RestTimerLiveActivity {
    static func start(duration: Int, endDate: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        Task {
            await endAll()
            let attributes = RestTimerActivityAttributes(startedAt: Date(), duration: TimeInterval(duration))
            let content = ActivityContent(
                state: RestTimerActivityAttributes.ContentState(endDate: endDate),
                staleDate: endDate
            )
            _ = try? Activity<RestTimerActivityAttributes>.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
        }
    }

    static func update(endDate: Date) {
        Task {
            let content = ActivityContent(
                state: RestTimerActivityAttributes.ContentState(endDate: endDate),
                staleDate: endDate
            )
            for activity in Activity<RestTimerActivityAttributes>.activities {
                await activity.update(content)
            }
        }
    }

    static func end() {
        Task { await endAll() }
    }

    private static func endAll() async {
        for activity in Activity<RestTimerActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
