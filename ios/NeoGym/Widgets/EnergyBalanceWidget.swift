import AppIntents
import NeoGymKit
import SwiftUI
import WidgetKit

struct EnergyBalanceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: EnergyBalanceWidgetConstants.widgetKind,
            provider: EnergyBalanceTimelineProvider()
        ) { entry in
            EnergyBalanceWidgetView(entry: entry)
        }
        .configurationDisplayName("Energy Balance")
        .description("See today’s calories in, calories out, net balance, and 7-day average.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct EnergyBalanceTimelineEntry: TimelineEntry {
    let content: EnergyBalanceWidgetTimelineEntry

    var date: Date { content.date }
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

private struct EnergyBalanceWidgetView: View {
    let entry: EnergyBalanceTimelineEntry

    var body: some View {
        Group {
            if let snapshot = entry.content.snapshot {
                populatedView(snapshot)
            } else {
                emptyView
            }
        }
        .widgetURL(URL(string: "neogym://"))
        .energyBalanceWidgetBackground()
    }

    private func populatedView(_ snapshot: EnergyBalanceWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("Energy")
                    .font(.system(size: 13, weight: .semibold))
                Text("kcal")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 4)
                refreshButton
            }

            HStack(alignment: .center, spacing: 12) {
                netSummary(snapshot)
                    .frame(maxWidth: .infinity)

                VStack(alignment: .leading, spacing: 8) {
                    energyMetric(
                        symbol: "fork.knife", color: .green, label: "Consumed",
                        value: snapshot.consumedValue, caption: snapshot.consumedCaption
                    )
                    energyMetric(
                        symbol: "flame.fill", color: .red, label: "Burned",
                        value: snapshot.burnedValue, caption: snapshot.burnedCaption,
                        estimate: entry.content.estimatedBurnedValue
                    )
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            footer(snapshot)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .accessibilityElement(children: .contain)
    }

    private func netSummary(_ snapshot: EnergyBalanceWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 5) {
                Image(systemName: "plusminus")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.teal)
                Text("Net")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            Text(compactValue(snapshot.netValue))
                .font(.system(size: 28, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .tracking(-0.5)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            if let estimate = entry.content.estimatedNetValue {
                estimateValue(estimate)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.teal.opacity(0.09), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Net today")
        .accessibilityValue(accessibilityValue(
            snapshot.netValue, caption: snapshot.netCaption, estimate: entry.content.estimatedNetValue
        ))
        .accessibilityHint(entry.content.estimatedNetValue == nil ? "" : "Net estimate uses food already logged.")
    }

    private func energyMetric(
        symbol: String, color: Color, label: String, value: String, caption: String, estimate: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(color)
                    .frame(width: 22)
                Text(compactValue(value))
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            if let estimate {
                estimateValue(estimate)
                    .padding(.leading, 30)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(accessibilityValue(value, caption: caption, estimate: estimate))
        .accessibilityHint(estimate == nil ? "" : "Recent resting energy plus activity so far.")
    }

    private func estimateValue(_ value: String) -> some View {
        Text("Est. \(compactValue(value))")
            .font(.system(size: 11, weight: .medium))
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    private func footer(_ snapshot: EnergyBalanceWidgetSnapshot) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("7-day avg")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                Text(compactValue(snapshot.sevenDayValue))
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .monospacedDigit()
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Seven-day average net")
            .accessibilityValue(accessibilityValue(snapshot.sevenDayValue, caption: snapshot.sevenDayCaption))

            Spacer(minLength: 4)

            HStack(spacing: 3) {
                Image(systemName: "clock")
                    .font(.system(size: 9))
                Text(snapshot.lastSyncedText.replacingOccurrences(of: "Last synced ", with: ""))
                    .font(.system(size: 10))
                    .monospacedDigit()
            }
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(snapshot.lastSyncedText)
        }
    }

    private var emptyView: some View {
        HStack(spacing: 12) {
            Image(systemName: "bolt.heart.fill")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(.teal)
                .frame(width: 44, height: 44)
                .background(.teal.opacity(0.09), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("Sign in to NeoGym")
                    .font(.system(size: 14, weight: .semibold))
                Text("Open the app to sync")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
        .accessibilityElement(children: .combine)
    }

    private var refreshButton: some View {
        Button(intent: RefreshEnergyBalanceIntent()) {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 28, height: 28)
                .background(.quaternary.opacity(0.5), in: Circle())
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Refresh energy balance")
        .accessibilityHint("Attempts to fetch fresh server data for this widget")
    }

    private func compactValue(_ value: String) -> String {
        value.hasSuffix(" kcal") ? String(value.dropLast(" kcal".count)) : value
    }

    private func accessibilityValue(_ value: String, caption: String, estimate: String? = nil) -> String {
        [value, caption, estimate.map { "Estimated \($0)" }]
            .compactMap { $0 }.joined(separator: ". ")
    }
}

private extension EnergyBalanceWidgetSnapshot {
    static let placeholder = preview()
    static let largeValues = preview(
        consumed: "12,850 kcal", burned: "52,180 kcal", net: "−39,330 kcal",
        average: "−10,210 kcal", estimatedBurned: "≈58,000 kcal", estimatedNet: "≈−45,150 kcal"
    )

    private static func preview(
        consumed: String = "1,850 kcal", burned: String = "2,180 kcal", net: String = "−330 kcal",
        average: String = "−210 kcal", estimatedBurned: String = "≈2,360 kcal", estimatedNet: String = "≈−510 kcal"
    ) -> EnergyBalanceWidgetSnapshot {
        EnergyBalanceWidgetSnapshot(
            localDate: DateOnly.todayLocalISO(),
            userMarker: "preview",
            generatedAtISO8601: "2026-07-11T12:30:00Z",
            generatedAtText: "Jul 11, 12:30 PM",
            lastSyncedText: "Last synced 12:30 PM",
            consumedValue: consumed,
            consumedCaption: "As of 12:15 PM",
            burnedValue: burned,
            burnedCaption: "Active plus resting",
            netValue: net,
            netCaption: "Deficit",
            netState: "deficit",
            sevenDayValue: average,
            sevenDayCaption: "Deficit",
            sevenDayState: "deficit",
            estimatedBurnedValue: estimatedBurned,
            estimatedNetValue: estimatedNet
        )
    }
}

private extension View {
    func energyBalanceWidgetBackground() -> some View {
        containerBackground(for: .widget) {
            Rectangle()
                .fill(.background)
                .overlay {
                    LinearGradient(
                        colors: [.teal.opacity(0.04), .clear],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                }
        }
    }
}

#if DEBUG
struct EnergyBalanceWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            EnergyBalanceWidgetView(entry: EnergyBalanceTimelineEntry(
                content: EnergyBalanceWidgetTimelineEntry(date: .now, snapshot: .placeholder)
            ))
            .previewDisplayName("Live or cached data")

            EnergyBalanceWidgetView(entry: EnergyBalanceTimelineEntry(
                content: EnergyBalanceWidgetTimelineEntry(date: .now, snapshot: .largeValues)
            ))
            .previewDisplayName("Large totals")

            EnergyBalanceWidgetView(entry: EnergyBalanceTimelineEntry(
                content: EnergyBalanceWidgetTimelineEntry(date: .now, snapshot: .placeholder)
            ))
            .environment(\.dynamicTypeSize, .accessibility3)
            .previewDisplayName("Accessibility text size")

            EnergyBalanceWidgetView(entry: EnergyBalanceTimelineEntry(
                content: EnergyBalanceWidgetTimelineEntry(date: .now, snapshot: nil)
            ))
            .previewDisplayName("Empty state")
        }
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
#endif
