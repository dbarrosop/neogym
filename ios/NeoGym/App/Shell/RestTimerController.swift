import ActivityKit
import Foundation
import NeoGymKit
@preconcurrency import UserNotifications

/// iPhone-only notification and Live Activity mirrors of the account-owned timer.
@MainActor
final class RestTimerSystemEffects: RestTimerEffects {
    private static let notificationIdentifier = "io.nhost.neogym.rest-timer"
    /// A finished rest stays on the Lock Screen as "Rest over" for this long, unless the
    /// next set's rest replaces it first.
    nonisolated static let restOverDismissal: TimeInterval = 10 * 60
    private var notificationTask: Task<Void, Never>?
    private var activityTask: Task<Void, Never>?
    private var activityRevision = 0
    private var lastSchedule: RestTimerSchedule?

    private enum ActivityMirror {
        case running(RestTimerSchedule)
        case finished(RestTimerSchedule?)
        case cleared
    }

    func schedule(_ schedule: RestTimerSchedule) {
        lastSchedule = schedule
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
        mirrorActivity(.running(schedule))
    }

    func cancel() {
        lastSchedule = nil
        notificationTask?.cancel()
        notificationTask = nil
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.notificationIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [Self.notificationIdentifier])
        mirrorActivity(.cleared)
    }

    func finish() {
        notificationTask?.cancel()
        notificationTask = nil
        mirrorActivity(.finished(lastSchedule))
        lastSchedule = nil
    }

    /// Lets a Live Activity intent enqueue its notification and finish ActivityKit
    /// work before the system suspends a background launch.
    func waitForPendingWork() async {
        await notificationTask?.value
        await activityTask?.value
    }

    nonisolated static func contentState(for schedule: RestTimerSchedule) -> RestTimerActivityAttributes.ContentState {
        RestTimerActivityAttributes.ContentState(
            endDate: schedule.endDate,
            duration: TimeInterval(schedule.duration),
            exerciseName: schedule.context?.exerciseName,
            nextSetNumber: schedule.context?.nextSetNumber,
            target: schedule.context?.target,
            sessionId: schedule.sessionId
        )
    }

    private func mirrorActivity(_ mirror: ActivityMirror) {
        activityRevision += 1
        let revision = activityRevision
        let previousTask = activityTask
        activityTask = Task {
            // Serialize ActivityKit operations: a delayed start/update must finish before
            // account cleanup, and old cleanup must not end the next owner's activity.
            await previousTask?.value
            switch mirror {
            case .cleared:
                for activity in Activity<RestTimerActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            case let .finished(schedule):
                await Self.endAsRestOver(schedule)
            case let .running(schedule):
                guard revision == activityRevision, !schedule.isFinished(),
                      ActivityAuthorizationInfo().areActivitiesEnabled else { return }
                await Self.show(schedule)
            }
        }
    }

    /// The ended activity keeps the set and shows "Rest over" with Open session.
    private nonisolated static func endAsRestOver(_ schedule: RestTimerSchedule?) async {
        let dismissAt = (schedule?.endDate ?? Date()).addingTimeInterval(restOverDismissal)
        let policy: ActivityUIDismissalPolicy = dismissAt > Date() ? .after(dismissAt) : .immediate
        let content = schedule.map { ActivityContent(state: contentState(for: $0), staleDate: $0.endDate) }
        for activity in Activity<RestTimerActivityAttributes>.activities {
            await activity.end(content, dismissalPolicy: policy)
        }
    }

    private nonisolated static func show(_ schedule: RestTimerSchedule) async {
        let content = ActivityContent(state: contentState(for: schedule), staleDate: schedule.endDate)
        // Read `activities` afresh for each step instead of holding the array across awaits.
        if let live = Activity<RestTimerActivityAttributes>.activities.first(where: {
            $0.activityState == .active || $0.activityState == .stale
        }) {
            let liveID = live.id
            await live.update(content)
            for other in Activity<RestTimerActivityAttributes>.activities where other.id != liveID {
                await other.end(nil, dismissalPolicy: .immediate)
            }
            return
        }
        // A "Rest over" activity stays ended until dismissed; the next rest replaces it.
        for ended in Activity<RestTimerActivityAttributes>.activities {
            await ended.end(nil, dismissalPolicy: .immediate)
        }
        let attributes = RestTimerActivityAttributes(startedAt: Date(), duration: TimeInterval(schedule.duration))
        _ = try? Activity<RestTimerActivityAttributes>.request(attributes: attributes, content: content, pushType: nil)
    }
}
