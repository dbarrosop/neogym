import NeoGymKit
import SwiftUI

/// Content of the tab view's bottom accessory: the live session and the rest
/// timer, visible on every tab. Tapping it opens the session.
struct RestTimerAccessory: View {
    @ObservedObject var timer: RestTimerController
    /// The session open in the Train tab, if any.
    let openSessionId: String?
    let onOpenSession: (String) -> Void

    @Environment(\.tabViewBottomAccessoryPlacement) private var placement
    @Environment(\.scenePhase) private var scenePhase

    private var targetSessionId: String? { timer.schedule?.sessionId ?? openSessionId }

    private var sessionName: String? {
        targetSessionId.flatMap { timer.sessionNames[$0] }
    }

    private var isCompact: Bool { placement == .inline }

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            Button(action: openSession) {
                HStack(spacing: NeoGymTheme.spacingSM) {
                    Image(systemName: timer.isRunning ? "stopwatch" : "dumbbell")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.accentText)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(NeoGymTheme.text)
                            .lineLimit(1)
                        if !isCompact, let subtitle {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(NeoGymTheme.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: NeoGymTheme.spacingXXS)
                    if timer.isRunning {
                        Text(timer.formattedRemaining)
                            .font(.title3.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(NeoGymTheme.accentText)
                            .contentTransition(.numericText(countsDown: true))
                    }
                }
                .frame(minHeight: NeoGymTheme.minimumTapTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(targetSessionId == nil)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint(targetSessionId == nil ? "" : "Opens the session")

            controls
        }
        .padding(.leading, NeoGymTheme.spacingMD)
        .padding(.trailing, NeoGymTheme.spacingXS)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { timer.refresh() }
        }
    }

    @ViewBuilder
    private var controls: some View {
        if timer.isRunning {
            if !isCompact {
                Button("+30 s") { timer.extend() }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .tint(NeoGymTheme.text)
                    .accessibilityLabel("Add 30 seconds")
            }
            Button {
                timer.cancel()
            } label: {
                Image(systemName: "forward.end.fill")
                    .frame(width: NeoGymTheme.minimumTapTarget, height: NeoGymTheme.minimumTapTarget)
            }
            .buttonStyle(.plain)
            .foregroundStyle(NeoGymTheme.text)
            .accessibilityLabel("Skip rest")
        } else if let targetSessionId {
            Button {
                timer.start(sessionId: targetSessionId)
            } label: {
                Label("Rest", systemImage: "stopwatch")
                    .labelStyle(.iconOnly)
                    .frame(width: NeoGymTheme.minimumTapTarget, height: NeoGymTheme.minimumTapTarget)
            }
            .buttonStyle(.plain)
            .foregroundStyle(NeoGymTheme.text)
            .accessibilityLabel("Start rest timer, \(RestTimerPreference.title(seconds: timer.defaultSeconds))")
        }
    }

    private var title: String {
        if timer.isRunning { return "Rest" }
        return sessionName ?? "Session in progress"
    }

    private var subtitle: String? {
        if timer.isRunning { return timer.schedule?.label ?? sessionName }
        return "Session open"
    }

    private var accessibilityLabel: String {
        if timer.isRunning {
            let context = timer.schedule?.label.map { ", \($0)" } ?? ""
            return "Rest timer, \(timer.formattedRemaining) remaining\(context)"
        }
        return sessionName.map { "Live session, \($0)" } ?? "Live session"
    }

    private func openSession() {
        if let targetSessionId { onOpenSession(targetSessionId) }
    }
}
