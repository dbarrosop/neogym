import ActivityKit
import Foundation
import NeoGymKit
@preconcurrency import UserNotifications

/// iPhone-only notification and Live Activity mirrors of the account-owned timer.
@MainActor
final class RestTimerSystemEffects: RestTimerEffects {
    private static let notificationIdentifier = "io.nhost.neogym.rest-timer"
    private var notificationTask: Task<Void, Never>?
    private var activityTask: Task<Void, Never>?
    private var activityRevision = 0

    func schedule(_ schedule: RestTimerSchedule) {
        notificationTask?.cancel()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])
        notificationTask = Task {
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) == true
            // Authorization may complete after sign-out or another timer has started.
            guard !Task.isCancelled, granted else { return }
            let seconds = schedule.remainingSeconds()
            guard seconds > 0 else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest complete"
            content.body = schedule.label ?? "Time to start your next set."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(seconds), repeats: false)
            let request = UNNotificationRequest(identifier: Self.notificationIdentifier, content: content, trigger: trigger)
            // Enqueue without suspending between the cancellation check and add/remove calls.
            center.add(request, withCompletionHandler: nil)
        }
        mirrorActivity(schedule)
    }

    func cancel() {
        notificationTask?.cancel()
        notificationTask = nil
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [Self.notificationIdentifier])
        mirrorActivity(nil)
    }

    func finish() {
        notificationTask?.cancel()
        notificationTask = nil
        mirrorActivity(nil)
    }

    private func mirrorActivity(_ schedule: RestTimerSchedule?) {
        activityRevision += 1
        let revision = activityRevision
        let previousTask = activityTask
        activityTask = Task {
            // Serialize ActivityKit operations: a delayed start/update must finish before
            // account cleanup, and old cleanup must not end the next owner's activity.
            await previousTask?.value
            guard let schedule else {
                for activity in Activity<RestTimerActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                return
            }
            guard revision == activityRevision, !schedule.isFinished(),
                  ActivityAuthorizationInfo().areActivitiesEnabled else { return }
            let content = ActivityContent(
                state: RestTimerActivityAttributes.ContentState(endDate: schedule.endDate),
                staleDate: schedule.endDate
            )
            if let activity = Activity<RestTimerActivityAttributes>.activities.first {
                await activity.update(content)
            } else {
                let attributes = RestTimerActivityAttributes(startedAt: Date(), duration: TimeInterval(schedule.duration))
                _ = try? Activity<RestTimerActivityAttributes>.request(attributes: attributes, content: content, pushType: nil)
            }
        }
    }
}
