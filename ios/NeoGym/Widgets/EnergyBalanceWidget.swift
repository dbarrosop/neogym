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
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Energy balance")
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text(snapshot.lastSyncedText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 6)
                refreshButton
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 4) {
                metricTile(
                    label: "Consumed",
                    value: snapshot.consumedValue,
                    metadata: compactConsumedMetadata(snapshot.consumedCaption)
                )
                metricTile(
                    label: "Burned",
                    value: snapshot.burnedValue,
                    metadata: compactBurnedMetadata(snapshot.burnedCaption),
                    estimate: entry.content.estimatedBurnedValue
                )
                metricTile(
                    label: "Net today",
                    value: snapshot.netValue,
                    metadata: snapshot.netCaption,
                    state: snapshot.netState,
                    estimate: entry.content.estimatedNetValue
                )
                metricTile(
                    label: "7-day avg",
                    value: snapshot.sevenDayValue,
                    metadata: snapshot.sevenDayCaption,
                    state: snapshot.sevenDayState
                )
            }
        }
        .padding(10)
        .accessibilityElement(children: .contain)
    }

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "bolt.heart")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.orange)
                    .accessibilityHidden(true)
                Spacer()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Sign in to NeoGym")
                    .font(.headline.weight(.semibold))
                Text("Open NeoGym to sync")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Text("The widget will also try to refresh when iOS schedules it after you sign in.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)

            Text("Tap to open the app")
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var refreshButton: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            Button(intent: RefreshEnergyBalanceIntent()) {
                Image(systemName: "arrow.clockwise")
                    .font(.caption.weight(.semibold))
                    .frame(width: 28, height: 28)
                    .contentShape(.rect)
            }
            .buttonStyle(.borderless)
            .tint(.accentColor)
            .accessibilityLabel("Refresh energy balance")
            .accessibilityHint("Attempts to fetch fresh server data for this widget")
        }
    }

    private func metricTile(label: String, value: String, metadata: String, state: String? = nil,
                            estimate: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(label)
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                Spacer(minLength: 2)

                if let state, state != "unavailable" {
                    stateIndicator(for: state)
                } else {
                    Text(metadata)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }

            Text(value)
                .font(.system(.callout, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            if let estimate {
                Text("Est. \(estimate)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .accessibilityLabel("Estimated \(label.lowercased()) \(estimate). Recent resting energy plus activity so far; food already logged only.")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(6)
        .background(.quaternary.opacity(0.55), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func stateIndicator(for state: String) -> some View {
        switch state {
        case "surplus":
            Image(systemName: "arrow.up")
                .foregroundStyle(.green)
                .accessibilityLabel("Surplus")
        case "deficit":
            Image(systemName: "arrow.down")
                .foregroundStyle(.red)
                .accessibilityLabel("Deficit")
        case "balanced":
            Image(systemName: "minus")
                .foregroundStyle(.blue)
                .accessibilityLabel("Balanced")
        default:
            Text(state.capitalized)
                .foregroundStyle(.secondary)
        }
    }

    private func compactConsumedMetadata(_ caption: String) -> String {
        let stripped = caption.hasPrefix("As of ") ? String(caption.dropFirst("As of ".count)) : caption
        return stripped.replacingOccurrences(of: ":", with: ".")
    }

    private func compactBurnedMetadata(_ caption: String) -> String {
        caption.replacingOccurrences(of: " kcal", with: "")
    }
}

private extension EnergyBalanceWidgetSnapshot {
    static let placeholder = EnergyBalanceWidgetSnapshot(
        localDate: DateOnly.todayLocalISO(),
        userMarker: "preview",
        generatedAtISO8601: "2026-07-11T12:30:00Z",
        generatedAtText: "Jul 11, 12:30 PM",
        lastSyncedText: "Last synced 12:30 PM",
        consumedValue: "1,850 kcal",
        consumedCaption: "As of 12:15 PM",
        burnedValue: "2,180 kcal",
        burnedCaption: "620 + 1,560 kcal",
        netValue: "−330 kcal",
        netCaption: "Deficit",
        netState: "deficit",
        sevenDayValue: "−210 kcal",
        sevenDayCaption: "Deficit",
        sevenDayState: "deficit",
        estimatedBurnedValue: "≈2,360 kcal",
        estimatedNetValue: "≈−510 kcal"
    )
}

private extension View {
    @ViewBuilder
    func energyBalanceWidgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(.background, for: .widget)
        } else {
            background(Color(.systemBackground))
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
                content: EnergyBalanceWidgetTimelineEntry(date: .now, snapshot: nil)
            ))
            .previewDisplayName("Empty state")
        }
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
#endif
