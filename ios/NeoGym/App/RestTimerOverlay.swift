import ActivityKit
import SwiftUI
@preconcurrency import UserNotifications

struct RestTimerOverlay: View {
    @ObservedObject var timer: RestTimerController
    @Environment(\.scenePhase) private var scenePhase
    @State private var isChoosingDuration = false

    var body: some View {
        Group {
            if timer.isRunning {
                runningPill
            } else {
                idleButton
            }
        }
        .confirmationDialog("Start rest timer", isPresented: $isChoosingDuration, titleVisibility: .visible) {
            ForEach(RestTimerPreset.allCases) { preset in
                Button(preset.title) {
                    timer.start(seconds: preset.seconds)
                }
            }
            if timer.isRunning {
                Button("Clear timer", role: .destructive) {
                    timer.cancel()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Choose a rest duration.")
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                timer.refresh()
            }
        }
    }

    private var idleButton: some View {
        Button {
            isChoosingDuration = true
        } label: {
            Image(systemName: "stopwatch.fill")
                .font(.title2.weight(.bold))
                .foregroundColor(.white)
                .frame(width: 58, height: 58)
                .background(Circle().fill(Color.accentColor))
                .shadow(color: .black.opacity(0.28), radius: 14, y: 8)
        }
        .accessibilityLabel("Start rest timer")
    }

    private var runningPill: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            Button {
                isChoosingDuration = true
            } label: {
                HStack(spacing: NeoGymTheme.spacingXS) {
                    Image(systemName: "stopwatch.fill")
                    Text(timer.formattedRemaining)
                        .monospacedDigit()
                        .fontWeight(.bold)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Rest timer, \(timer.formattedRemaining) remaining")

            Button {
                timer.cancel()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel rest timer")
        }
        .font(.headline)
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusPill,
            material: .regular,
            tint: NeoGymTheme.glassStrongFill,
            stroke: Color.accentColor.opacity(0.3),
            shadow: true
        )
    }

}

@MainActor
final class RestTimerController: ObservableObject {
    @Published private(set) var isRunning = false
    @Published private(set) var remainingSeconds = 0

    private var endDate: Date?
    private var tickerTask: Task<Void, Never>?
    private let notificationIdentifier = "io.nhost.neogym.rest-timer"

    var formattedRemaining: String {
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    func start(seconds: Int) {
        tickerTask?.cancel()
        isRunning = true
        remainingSeconds = seconds
        let endDate = Date().addingTimeInterval(TimeInterval(seconds))
        self.endDate = endDate
        scheduleNotification(seconds: seconds)
        RestTimerLiveActivity.start(seconds: seconds, endDate: endDate)
        startTicker()
    }

    func cancel() {
        tickerTask?.cancel()
        tickerTask = nil
        isRunning = false
        remainingSeconds = 0
        endDate = nil
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])
        RestTimerLiveActivity.end(immediately: true)
    }

    func refresh() {
        updateRemaining()
        if isRunning {
            startTicker()
        }
    }

    private func startTicker() {
        tickerTask?.cancel()
        tickerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                await self?.updateRemaining()
                if await self?.isRunning == false { return }
            }
        }
    }

    private func updateRemaining() {
        guard let endDate else { return }
        let remaining = max(0, Int(ceil(endDate.timeIntervalSinceNow)))
        remainingSeconds = remaining
        if remaining == 0 {
            tickerTask?.cancel()
            tickerTask = nil
            isRunning = false
            self.endDate = nil
            RestTimerLiveActivity.end(immediately: true)
        }
    }

    private func scheduleNotification(seconds: Int) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationIdentifier])
        center.requestAuthorization(options: [.alert, .sound]) { [notificationIdentifier] granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest complete"
            content.body = "Time to start your next set."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(seconds), repeats: false)
            let request = UNNotificationRequest(identifier: notificationIdentifier, content: content, trigger: trigger)
            UNUserNotificationCenter.current().add(request)
        }
    }
}

private enum RestTimerLiveActivity {
    static func start(seconds: Int, endDate: Date) {
        guard #available(iOS 16.2, *) else { return }
        RestTimerLiveActivityRuntime.start(seconds: seconds, endDate: endDate)
    }

    static func end(immediately: Bool) {
        guard #available(iOS 16.2, *) else { return }
        Task {
            await RestTimerLiveActivityRuntime.endAll(immediately: immediately)
        }
    }
}

@available(iOS 16.2, *)
private enum RestTimerLiveActivityRuntime {
    static func start(seconds: Int, endDate: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        Task {
            await endAll(immediately: true)
            let attributes = RestTimerActivityAttributes(
                startedAt: Date(),
                duration: TimeInterval(seconds)
            )
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

    static func endAll(immediately: Bool) async {
        let dismissalPolicy: ActivityUIDismissalPolicy = immediately ? .immediate : .default
        for activity in Activity<RestTimerActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: dismissalPolicy)
        }
    }
}

private enum RestTimerPreset: Int, CaseIterable, Identifiable {
    case thirty = 30
    case sixty = 60
    case ninety = 90
    case threeMinutes = 180

    var id: Int { rawValue }
    var seconds: Int { rawValue }

    var title: String {
        switch self {
        case .thirty:
            return "30 seconds"
        case .sixty:
            return "60 seconds"
        case .ninety:
            return "90 seconds"
        case .threeMinutes:
            return "180 seconds"
        }
    }
}
