import ActivityKit
import AppIntents
import NeoGymKit
import SwiftUI
import WidgetKit

#if !NEOGYM_GALLERY
@main
struct NeoGymWidgetsBundle: WidgetBundle {
    var body: some Widget {
        EnergyBalanceWidget()
        RestTimerLiveActivityWidget()
    }
}
#endif

/// The session's rest pill on the Lock Screen and in the Dynamic Island. The time
/// counts down by itself; the app updates it only on +30 s or Skip. At the end date
/// the activity turns stale and shows "Rest over" with Open session.
struct RestTimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestTimerActivityAttributes.self) { context in
            RestTimerLockScreenView(context: RestTimerPresentation(context))
                .activityBackgroundTint(WidgetTheme.surface.opacity(0.94))
                .activitySystemActionForegroundColor(WidgetTheme.text)
                .widgetURL(RestTimerPresentation(context).sessionURL)
        } dynamicIsland: { activity in
            let context = RestTimerPresentation(activity)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    RestIslandLeading(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestCountdown(context: context, size: 40)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    RestIslandBottom(context: context)
                }
            } compactLeading: {
                RestStatusGlyph(isOver: context.isStale, size: 17)
            } compactTrailing: {
                RestCountdown(context: context, size: 15, weight: .semibold)
                    .frame(maxWidth: 44)
            } minimal: {
                RestMinimalRing(context: context)
            }
            .widgetURL(context.sessionURL)
            .keylineTint(WidgetTheme.accentText)
        }
    }
}

/// Immutable rendering input shared by real ActivityKit contexts and visual fixtures.
private struct RestTimerPresentation {
    let attributes: RestTimerActivityAttributes
    let state: RestTimerActivityAttributes.ContentState
    let isStale: Bool

    init(_ context: ActivityViewContext<RestTimerActivityAttributes>) {
        attributes = context.attributes
        state = context.state
        isStale = context.isStale
    }

    init(attributes: RestTimerActivityAttributes, state: RestTimerActivityAttributes.ContentState, isStale: Bool) {
        self.attributes = attributes
        self.state = state
        self.isStale = isStale
    }

    var startDate: Date { state.startDate(fallback: attributes.startedAt) }
    var countdownInterval: ClosedRange<Date> { startDate...max(startDate, state.endDate) }
    var sessionURL: URL? { state.sessionId.flatMap(AppDeepLink.sessionURL) }

    /// "Set 3 next · 95 kg × 10" in the expanded island.
    var expandedDetail: String? {
        let set = state.nextSetNumber.map { isStale ? "Set \($0)" : "Set \($0) next" }
        let parts = [set, state.target].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    var accessibilitySummary: String {
        let context = (isStale ? state.finishedLabel : state.runningLabel).map { ", \($0)" } ?? ""
        let target = state.target.map { ", \($0)" } ?? ""
        return (isStale ? "Rest over" : "Rest") + context + target
    }
}

private struct RestStatusGlyph: View {
    let isOver: Bool
    let size: CGFloat

    var body: some View {
        Image(systemName: isOver ? "checkmark" : "stopwatch")
            .font(.system(size: size * 0.9, weight: isOver ? .bold : .semibold))
            .foregroundStyle(isOver ? WidgetTheme.positive : WidgetTheme.accentText)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// Counts down to the end date and stops at 0:00, in the accent while running and
/// tertiary once the rest is over.
private struct RestCountdown: View {
    let context: RestTimerPresentation
    let size: CGFloat
    var weight: Font.Weight = .bold

    var body: some View {
        Group {
            if context.isStale {
                Text("0:00").foregroundStyle(WidgetTheme.textTertiary)
            } else {
                countdown.foregroundStyle(WidgetTheme.accentText)
            }
        }
        .font(.system(size: size, weight: weight))
        .tracking(size >= 30 ? -0.02 * size : 0)
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
    }

    private var countdown: Text {
        #if NEOGYM_GALLERY
        Text("1:15") // Frozen fixture timer, not a running ActivityKit countdown.
        #else
        Text(timerInterval: context.countdownInterval, countsDown: true)
        #endif
    }
}

/// The time-left bar: full at the start of the rest, empty at its end.
private struct RestProgressBar: View {
    let context: RestTimerPresentation

    var body: some View {
        progress.progressViewStyle(.linear)
        .tint(WidgetTheme.accentText)
        .accessibilityLabel("Time left")
    }

    private var progress: some View {
        #if NEOGYM_GALLERY
        ProgressView(value: 0.625) { EmptyView() } currentValueLabel: { EmptyView() }
        #else
        ProgressView(timerInterval: context.countdownInterval, countsDown: true) {
            EmptyView()
        } currentValueLabel: { EmptyView() }
        #endif
    }
}

/// +30 s and Skip are App Intents that update the session's own timer; once the rest
/// is over they give way to Open session.
private struct RestActions: View {
    let context: RestTimerPresentation
    let height: CGFloat

    var body: some View {
        if context.isStale {
            if let url = context.sessionURL {
                Link(destination: url) {
                    Text("Open session")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: height)
                        .background(WidgetTheme.accentFill, in: Capsule())
                }
            }
        } else {
            VStack(spacing: 12) {
                RestProgressBar(context: context)
                HStack(spacing: 10) {
                    Button(intent: ExtendRestTimerIntent()) {
                        Text("+30 s").capsuleAction(height: height)
                    }
                    .accessibilityLabel("Add 30 seconds")
                    Button(intent: SkipRestTimerIntent()) {
                        HStack(spacing: 6) {
                            Text("Skip")
                            Image(systemName: "forward.end.fill").font(.system(size: 12, weight: .bold))
                        }
                        .capsuleAction(height: height)
                    }
                    .accessibilityLabel("Skip rest")
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private extension View {
    func capsuleAction(height: CGFloat) -> some View {
        font(.system(size: 15, weight: .semibold))
            .foregroundStyle(WidgetTheme.text)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(WidgetTheme.fill, in: Capsule())
            .contentShape(Capsule())
    }
}

/// With another Live Activity: a ring of time left around the glyph.
private struct RestMinimalRing: View {
    let context: RestTimerPresentation

    var body: some View {
        if context.isStale {
            RestStatusGlyph(isOver: true, size: 14)
        } else {
            progress.progressViewStyle(.circular)
            .tint(WidgetTheme.accentText)
            .accessibilityLabel("Rest time left")
        }
    }

    private var progress: some View {
        #if NEOGYM_GALLERY
        ProgressView(value: 0.625) { EmptyView() } currentValueLabel: {
            RestStatusGlyph(isOver: false, size: 11)
        }
        #else
        ProgressView(timerInterval: context.countdownInterval, countsDown: true) {
            EmptyView()
        } currentValueLabel: { RestStatusGlyph(isOver: false, size: 11) }
        #endif
    }
}

private struct RestTimerLockScreenView: View {
    let context: RestTimerPresentation

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                RestStatusGlyph(isOver: context.isStale, size: 20)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.isStale ? "Rest over" : "Rest")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(WidgetTheme.text)
                    if let label = context.isStale ? context.state.finishedLabel : context.state.runningLabel {
                        Text(label)
                            .font(.system(size: 13))
                            .foregroundStyle(WidgetTheme.textSecondary)
                    }
                    if let target = context.state.target {
                        Text(target)
                            .font(.system(size: 13))
                            .monospacedDigit()
                            .foregroundStyle(WidgetTheme.textSecondary)
                    }
                }
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(context.accessibilitySummary)
                RestCountdown(context: context, size: 40)
            }
            RestActions(context: context, height: 38)
        }
        .padding(16)
    }
}

private struct RestIslandLeading: View {
    let context: RestTimerPresentation
    var body: some View {
        HStack(spacing: 10) {
            RestStatusGlyph(isOver: context.isStale, size: 22)
            VStack(alignment: .leading, spacing: 0) {
                Text(context.isStale ? "Rest over" : "Rest").font(.system(size: 15, weight: .semibold))
                if let exercise = context.state.exerciseName {
                    Text(exercise)
                        .font(.system(size: 13))
                        .foregroundStyle(WidgetTheme.textSecondary)
                }
            }
            .lineLimit(1)
        }
        .padding(.leading, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(context.accessibilitySummary)
    }
}

private struct RestIslandBottom: View {
    let context: RestTimerPresentation
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let detail = context.expandedDetail {
                Text(detail)
                    .font(.system(size: 13))
                    .monospacedDigit()
                    .foregroundStyle(WidgetTheme.textSecondary)
            }
            RestActions(context: context, height: 40)
        }
        .padding(.horizontal, 4)
    }
}


#if NEOGYM_GALLERY
/// The system's regions are arranged by the fixture host, not hosted in an island.
struct RestGalleryView: View {
    let region: String
    let isOver: Bool

    private var context: RestTimerPresentation {
        let start = Date(timeIntervalSince1970: 1_736_948_400)
        return RestTimerPresentation(
            attributes: .init(startedAt: start, duration: 120),
            state: .init(endDate: start.addingTimeInterval(120), duration: 120,
                         exerciseName: "Leg Extensions", nextSetNumber: 3,
                         target: "95 kg × 10", sessionId: "fictional-session"),
            isStale: isOver
        )
    }

    @ViewBuilder var body: some View {
        switch region {
        case "expanded":
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    RestIslandLeading(context: context)
                    Spacer(minLength: 8)
                    RestCountdown(context: context, size: 40)
                }
                RestIslandBottom(context: context)
            }.padding(16)
        case "compact":
            HStack {
                RestStatusGlyph(isOver: isOver, size: 17)
                Spacer()
                RestCountdown(context: context, size: 15, weight: .semibold).frame(maxWidth: 44)
            }.padding(.horizontal, 12)
        case "minimal": RestMinimalRing(context: context).padding(8)
        default: RestTimerLockScreenView(context: context)
        }
    }
}
#endif
