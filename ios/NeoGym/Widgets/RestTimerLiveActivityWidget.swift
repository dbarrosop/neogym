import ActivityKit
import SwiftUI
import WidgetKit

@main
struct NeoGymWidgetsBundle: WidgetBundle {
    var body: some Widget {
        EnergyBalanceWidget()

        if #available(iOSApplicationExtension 16.2, *) {
            RestTimerLiveActivityWidget()
        }
    }
}

@available(iOSApplicationExtension 16.2, *)
struct RestTimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerActivityAttributes.self) { context in
            RestTimerLockScreenView(context: context)
                .activityBackgroundTint(Color(.systemBackground))
                .activitySystemActionForegroundColor(.accentColor)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "stopwatch.fill")
                        .foregroundStyle(Color.accentColor)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text("Rest timer")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(context.state.endDate, style: .timer)
                            .font(.headline.monospacedDigit().weight(.bold))
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(Self.durationText(context.attributes.duration))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "stopwatch.fill")
                    .foregroundStyle(Color.accentColor)
            } compactTrailing: {
                Text(context.state.endDate, style: .timer)
                    .monospacedDigit()
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "stopwatch.fill")
                    .foregroundStyle(Color.accentColor)
            }
        }
    }

    private static func durationText(_ duration: TimeInterval) -> String {
        let seconds = Int(duration.rounded())
        if seconds >= 60 {
            return "\(seconds / 60)m"
        }
        return "\(seconds)s"
    }
}

@available(iOSApplicationExtension 16.2, *)
private struct RestTimerLockScreenView: View {
    let context: ActivityViewContext<RestTimerActivityAttributes>

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "stopwatch.fill")
                .font(.title3.weight(.bold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Color.accentColor.opacity(0.14)))
            VStack(alignment: .leading, spacing: 2) {
                Text("NeoGym rest timer")
                    .font(.subheadline.weight(.semibold))
                Text("Next set in")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(context.state.endDate, style: .timer)
                .font(.title3.monospacedDigit().weight(.bold))
        }
        .padding(.vertical, 4)
    }
}
