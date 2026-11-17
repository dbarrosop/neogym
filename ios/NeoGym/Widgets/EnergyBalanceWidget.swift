import AppIntents
import NeoGymKit
import SwiftUI
import WidgetKit

/// Today's balance so far on the Home Screen (small, medium) and Lock Screen (inline,
/// rectangular, circular): the same numbers as Today's Balance card.
struct EnergyBalanceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: EnergyBalanceWidgetConstants.widgetKind,
            provider: EnergyBalanceTimelineProvider()
        ) { entry in
            EnergyBalanceWidgetView(entry: entry)
        }
        .configurationDisplayName("Balance")
        .description("Today’s balance so far: food in, energy out and the end-of-day estimate.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryInline, .accessoryRectangular, .accessoryCircular])
        .contentMarginsDisabled()
    }
}

struct EnergyBalanceTimelineEntry: TimelineEntry {
    let content: EnergyBalanceWidgetTimelineEntry

    var date: Date { content.date }
    var display: EnergyBalanceDisplay? { content.display }
}

private struct SendableTimelineCompletion: @unchecked Sendable {
    private let completion: (Timeline<EnergyBalanceTimelineEntry>) -> Void

    init(_ completion: @escaping (Timeline<EnergyBalanceTimelineEntry>) -> Void) {
        self.completion = completion
    }

    func callAsFunction(_ timeline: Timeline<EnergyBalanceTimelineEntry>) {
        completion(timeline)
    }
}

struct EnergyBalanceTimelineProvider: TimelineProvider {
    private let snapshotStore: EnergyBalanceWidgetSnapshotStore
    private let liveRefreshOrchestrator: EnergyBalanceWidgetLiveRefreshOrchestrator

    init(
        snapshotStore: EnergyBalanceWidgetSnapshotStore = .shared,
        liveRefreshClientFactory: @escaping @Sendable () throws -> EnergyBalanceWidgetLiveRefreshClient = {
            try NhostClientFactory.makeProductionWidgetLiveRefreshClient()
        }
    ) {
        self.snapshotStore = snapshotStore
        liveRefreshOrchestrator = EnergyBalanceWidgetLiveRefreshOrchestrator(
            snapshotStore: snapshotStore,
            liveRefreshClientFactory: liveRefreshClientFactory
        )
    }

    func placeholder(in context: Context) -> EnergyBalanceTimelineEntry {
        EnergyBalanceTimelineEntry(content: EnergyBalanceWidgetTimelineEntry(date: Date(), snapshot: .placeholder))
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyBalanceTimelineEntry) -> Void) {
        let snapshot = context.isPreview ? EnergyBalanceWidgetSnapshot.placeholder : snapshotStore.load()
        completion(EnergyBalanceTimelineEntry(content: EnergyBalanceWidgetTimelineEntry(date: Date(), snapshot: snapshot)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyBalanceTimelineEntry>) -> Void) {
        let completion = SendableTimelineCompletion(completion)
        Task {
            let now = Date()
            let timeline = await liveRefreshOrchestrator.timeline(date: now)

            // WidgetKit treats timeline policies as best-effort hints. This provider can attempt a
            // live server fetch through the shared keychain session, but iOS still decides when the
            // extension receives runtime. Cached data remains the supported fallback on no session,
            // auth, network, or provisioning failures.
            completion(Timeline(
                entries: timeline.entries.map { EnergyBalanceTimelineEntry(content: $0) },
                policy: .after(timeline.reloadAfter)
            ))
        }
    }
}

struct EnergyBalanceWidgetView: View {
    let entry: EnergyBalanceTimelineEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(AppDeepLink.todayURL)
            .containerBackground(for: .widget) {
                if isAccessory { Color.clear } else { WidgetTheme.surface }
            }
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryInline:
            InlineBalanceView(display: entry.display)
        case .accessoryRectangular:
            RectangularBalanceView(display: entry.display)
        case .accessoryCircular:
            CircularIntakeView(display: entry.display)
        case .systemMedium:
            if let display = entry.display { MediumBalanceView(display: display) } else { SignedOutBalanceView() }
        default:
            if let display = entry.display { SmallBalanceView(display: display) } else { SignedOutBalanceView() }
        }
    }

    private var isAccessory: Bool {
        [.accessoryInline, .accessoryRectangular, .accessoryCircular].contains(family)
    }
}

// MARK: - Home Screen

/// "+251 kcal": the number is accentable in tinted Home Screen modes.
private struct BalanceFigure: View {
    let display: EnergyBalanceDisplay
    let size: CGFloat

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(display.balance)
                .font(.system(size: size, weight: .bold))
                .tracking(-0.02 * size)
                .foregroundStyle(WidgetTheme.text)
                .widgetAccentable()
            Text("kcal")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(WidgetTheme.textSecondary)
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(display.balanceAccessibility)
    }
}

private struct HomeSplitBar: View {
    let display: EnergyBalanceDisplay
    @Environment(\.widgetRenderingMode) private var renderingMode

    var body: some View {
        EnergySplitBar(
            split: display.split, restingColor: WidgetTheme.chart1, activeColor: WidgetTheme.chart2,
            trackColor: WidgetTheme.fill, accented: renderingMode == .accented
        )
        .frame(height: 6)
        .widgetAccentable()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(display.splitAccessibility ?? "")
        .accessibilityHidden(display.splitAccessibility == nil)
    }
}

private struct SmallBalanceView: View {
    let display: EnergyBalanceDisplay

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Balance").font(.system(size: 13, weight: .semibold))
                Spacer(minLength: 4)
                Text(display.updatedTime)
                    .font(.system(size: 12))
                    .monospacedDigit()
                    .foregroundStyle(WidgetTheme.textSecondary)
                    .accessibilityLabel("Updated \(display.updatedTime)")
            }
            BalanceFigure(display: display, size: 34).padding(.top, 4)
            Text(display.periodCaption)
                .font(.system(size: 12))
                .foregroundStyle(WidgetTheme.textSecondary)
                .padding(.top, 3)
            HomeSplitBar(display: display)
                .padding(.top, 9)
            Text(display.inOut)
                .font(.system(size: 12))
                .padding(.top, 7)
                .accessibilityLabel(display.inOutAccessibility)
            if let endOfDay = display.endOfDayNet {
                Text("End of day \(endOfDay)")
                    .font(.system(size: 12))
                    .foregroundStyle(WidgetTheme.textSecondary)
                    .padding(.top, 2)
                    .accessibilityLabel(display.endOfDayAccessibility ?? endOfDay)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(WidgetTheme.text)
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 15)
        .padding(.vertical, 14)
    }
}

private struct MediumBalanceView: View {
    let display: EnergyBalanceDisplay

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Balance").font(.system(size: 13, weight: .semibold))
                Text(display.periodHeader)
                    .font(.system(size: 12))
                    .foregroundStyle(WidgetTheme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                RefreshBalanceButton()
            }
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 9) {
                    BalanceFigure(display: display, size: 36)
                    HomeSplitBar(display: display)
                    HStack(spacing: 9) {
                        LegendLabel(color: WidgetTheme.chart1, text: "Resting \(display.resting)")
                        LegendLabel(color: WidgetTheme.chart2, text: "Active \(display.active)")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(WidgetTheme.textSecondary)
                    .accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(spacing: 6) {
                    ValueRow(label: "In", value: display.consumed)
                    ValueRow(label: "Out", value: display.burned)
                    WidgetTheme.fill.frame(height: 1).padding(.vertical, 2)
                    if let endOfDay = display.endOfDayNet {
                        ValueRow(label: "End of day", value: endOfDay)
                            .accessibilityLabel(display.endOfDayAccessibility ?? endOfDay)
                    }
                    ValueRow(label: "7-day avg", value: display.sevenDayAverage, weight: .medium)
                        .accessibilityLabel("Seven-day average net, \(display.sevenDayAverage) kilocalories")
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxHeight: .infinity)
        }
        .foregroundStyle(WidgetTheme.text)
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .padding(.horizontal, 15)
        .padding(.vertical, 14)
    }
}

private struct ValueRow: View {
    let label: String
    let value: String
    var weight: Font.Weight = .semibold

    var body: some View {
        HStack {
            Text(label).foregroundStyle(WidgetTheme.textSecondary)
            Spacer(minLength: 4)
            Text(value).fontWeight(weight)
        }
        .font(.system(size: 13))
        .accessibilityElement(children: .combine)
    }
}

private struct LegendLabel: View {
    let color: Color
    let text: String

    var body: some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 7, height: 7)
            Text(text)
        }
    }
}

/// The existing refresh intent: fetch now, falling back to the cached snapshot.
private struct RefreshBalanceButton: View {
    var body: some View {
        Button(intent: RefreshEnergyBalanceIntent()) {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(WidgetTheme.accentText)
                .widgetAccentable()
                .frame(width: 28, height: 28)
                .background(WidgetTheme.fill, in: Circle())
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Refresh balance")
        .accessibilityHint("Fetches today’s numbers now, or keeps the last ones")
    }
}

/// Signed out or never synced: one message and the app icon, never zeros.
private struct SignedOutBalanceView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(WidgetTheme.accentFill, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .widgetAccentable()
                .accessibilityHidden(true)
            Spacer(minLength: 8)
            Text("Sign in to NeoGym")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(WidgetTheme.text)
            Text("Open the app to see today’s balance.")
                .font(.system(size: 12))
                .foregroundStyle(WidgetTheme.textSecondary)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 15)
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Lock Screen

/// Beside the date. The Lock Screen draws accessories in one vibrant colour, so the
/// words carry the meaning.
private struct InlineBalanceView: View {
    let display: EnergyBalanceDisplay?

    var body: some View {
        if let display {
            Label(display.inlineText, systemImage: "scalemass")
                .accessibilityLabel(display.inlineAccessibility)
        } else {
            Label("Open NeoGym", systemImage: "dumbbell")
        }
    }
}

private struct RectangularBalanceView: View {
    let display: EnergyBalanceDisplay?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let display {
                HStack(spacing: 5) {
                    BalanceScaleIcon()
                        .stroke(style: BalanceScaleIcon.stroke(for: 13))
                        .frame(width: 13, height: 13)
                    Text(display.isCurrentDay ? "Balance so far" : "Balance \(display.dayLabel)")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                Text(display.balanceWithUnit)
                    .font(.system(size: 22, weight: .bold))
                    .widgetAccentable()
                Text(display.inOut)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            } else {
                Text("NeoGym").font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
                Text("Sign in").font(.system(size: 17, weight: .bold))
                Text("Open the app on iPhone").font(.system(size: 13)).foregroundStyle(.secondary)
            }
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background {
            AccessoryWidgetBackground().clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(display.map { "\($0.balanceAccessibility). \($0.inOutAccessibility)" } ?? "Sign in to NeoGym")
    }
}

/// Food in against the day's plan ("1,461 of 2,243"); a plain total without a plan.
private struct CircularIntakeView: View {
    let display: EnergyBalanceDisplay?

    var body: some View {
        Gauge(value: display?.planProgress ?? 0) {
            Text("In")
        } currentValueLabel: {
            VStack(spacing: 0) {
                Text(display?.consumed ?? KcalText.missing)
                    .font(.system(size: 15, weight: .bold))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                Text(display?.planTarget.map { "of \($0)" } ?? "kcal in")
                    .font(.system(size: 10))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
            }
            .lineLimit(1)
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(display?.planAccessibility ?? "Sign in to NeoGym")
    }
}

// MARK: - Previews

private extension EnergyBalanceWidgetSnapshot {
    static let placeholder = EnergyBalanceWidgetSnapshot(
        localDate: DateOnly.todayLocalISO(),
        userMarker: "preview",
        generatedAt: Calendar.current.date(bySettingHour: 13, minute: 40, second: 0, of: Date()) ?? Date(),
        consumedKcal: 1_461,
        burnedKcal: 1_210,
        activeKcal: 531,
        restingKcal: 679,
        sevenDayAverageNet: -371,
        planKcal: 2_243,
        estimatedBurnedKcal: 2_312,
        estimatedNetKcal: -851
    )
    static let noEnergy = EnergyBalanceWidgetSnapshot(
        localDate: DateOnly.todayLocalISO(), userMarker: "preview", generatedAt: Date(),
        consumedKcal: 640, burnedKcal: nil
    )
}

private func previewEntry(_ snapshot: EnergyBalanceWidgetSnapshot?) -> EnergyBalanceTimelineEntry {
    EnergyBalanceTimelineEntry(content: EnergyBalanceWidgetTimelineEntry(date: .now, snapshot: snapshot))
}

#Preview("Small", as: .systemSmall) {
    EnergyBalanceWidget()
} timeline: {
    previewEntry(.placeholder)
    previewEntry(.noEnergy)
    previewEntry(nil)
}

#Preview("Medium", as: .systemMedium) {
    EnergyBalanceWidget()
} timeline: {
    previewEntry(.placeholder)
    previewEntry(nil)
}

#Preview("Lock Screen rectangular", as: .accessoryRectangular) {
    EnergyBalanceWidget()
} timeline: {
    previewEntry(.placeholder)
}

#Preview("Lock Screen circular", as: .accessoryCircular) {
    EnergyBalanceWidget()
} timeline: {
    previewEntry(.placeholder)
}

#Preview("Lock Screen inline", as: .accessoryInline) {
    EnergyBalanceWidget()
} timeline: {
    previewEntry(.placeholder)
}

#if NEOGYM_GALLERY
/// Family dispatch only: every layout below is the shipping view above. The host
/// does not instantiate a TimelineProvider, SDK client, snapshot store or intent.
struct BalanceGalleryView: View {
    let display: EnergyBalanceDisplay?
    let family: WidgetFamily

    @ViewBuilder var body: some View {
        switch family {
        case .accessoryInline: InlineBalanceView(display: display)
        case .accessoryRectangular: RectangularBalanceView(display: display)
        case .accessoryCircular: CircularIntakeView(display: display)
        case .systemMedium:
            if let display { MediumBalanceView(display: display) } else { SignedOutBalanceView() }
        default:
            if let display { SmallBalanceView(display: display) } else { SignedOutBalanceView() }
        }
    }
}
#endif
