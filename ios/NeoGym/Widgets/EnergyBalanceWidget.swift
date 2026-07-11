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
    }
}

struct EnergyBalanceTimelineEntry: TimelineEntry {
    let date: Date
    let snapshot: EnergyBalanceWidgetSnapshot?
    let isPlaceholder: Bool
    let refreshDecision: EnergyBalanceWidgetLiveRefreshDecision

    var displaySnapshot: EnergyBalanceWidgetSnapshot? {
        snapshot ?? (isPlaceholder ? .placeholder : nil)
    }
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
    private let liveRefreshClientFactory: @Sendable () -> EnergyBalanceWidgetLiveRefreshClient

    init(
        snapshotStore: EnergyBalanceWidgetSnapshotStore = .shared,
        liveRefreshClientFactory: @escaping @Sendable () -> EnergyBalanceWidgetLiveRefreshClient = {
            NhostClientFactory.makeProductionWidgetLiveRefreshClient()
        }
    ) {
        self.snapshotStore = snapshotStore
        self.liveRefreshClientFactory = liveRefreshClientFactory
    }

    func placeholder(in context: Context) -> EnergyBalanceTimelineEntry {
        EnergyBalanceTimelineEntry(
            date: Date(),
            snapshot: .placeholder,
            isPlaceholder: true,
            refreshDecision: .liveSnapshot
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyBalanceTimelineEntry) -> Void) {
        let snapshot = context.isPreview ? EnergyBalanceWidgetSnapshot.placeholder : snapshotStore.load()
        completion(EnergyBalanceTimelineEntry(
            date: Date(),
            snapshot: snapshot,
            isPlaceholder: context.isPreview,
            refreshDecision: snapshot == nil ? .emptyState : .cachedFallback
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyBalanceTimelineEntry>) -> Void) {
        let completion = SendableTimelineCompletion(completion)
        Task {
            let now = Date()
            let entry = await timelineEntry(date: now)

            // WidgetKit treats timeline policies as best-effort hints. This provider can attempt a
            // live server fetch through the shared keychain session, but iOS still decides when the
            // extension receives runtime. Cached data remains the supported fallback on no session,
            // auth, network, or provisioning failures.
            let reloadInterval: TimeInterval = entry.refreshDecision == .emptyState ? 15 * 60 : 30 * 60
            completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(reloadInterval))))
        }
    }

    private func timelineEntry(date: Date) async -> EnergyBalanceTimelineEntry {
        let cachedSnapshot = snapshotStore.load()

        do {
            let livePayload = try await liveRefreshClientFactory().fetchOverview()
            let summary = EnergyBalanceOverviewSummary(payload: livePayload.overview, todayDate: date)
            let liveSnapshot = EnergyBalanceWidgetSnapshot(
                summary: summary,
                userMarker: livePayload.userMarker,
                generatedAt: date
            )
            _ = snapshotStore.save(liveSnapshot)

            return EnergyBalanceTimelineEntry(
                date: date,
                snapshot: liveSnapshot,
                isPlaceholder: false,
                refreshDecision: .decide(liveFetchSucceeded: true, cachedSnapshotExists: cachedSnapshot != nil)
            )
        } catch {
            let decision = EnergyBalanceWidgetLiveRefreshDecision.decide(
                liveFetchSucceeded: false,
                cachedSnapshotExists: cachedSnapshot != nil
            )
            return EnergyBalanceTimelineEntry(
                date: date,
                snapshot: cachedSnapshot,
                isPlaceholder: false,
                refreshDecision: decision
            )
        }
    }
}

private struct EnergyBalanceWidgetView: View {
    let entry: EnergyBalanceTimelineEntry

    var body: some View {
        Group {
            if let snapshot = entry.displaySnapshot {
                populatedView(snapshot)
            } else {
                emptyView
            }
        }
        .widgetURL(URL(string: "neogym://"))
        .energyBalanceWidgetBackground()
    }

    private func populatedView(_ snapshot: EnergyBalanceWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
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

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 6) {
                metricTile(
                    label: "Consumed",
                    value: snapshot.consumedValue,
                    metadata: compactConsumedMetadata(snapshot.consumedCaption)
                )
                metricTile(
                    label: "Burned",
                    value: snapshot.burnedValue,
                    metadata: compactBurnedMetadata(snapshot.burnedCaption)
                )
                metricTile(
                    label: "Net today",
                    value: snapshot.netValue,
                    metadata: snapshot.netCaption,
                    state: snapshot.netState
                )
                metricTile(
                    label: "7-day avg",
                    value: snapshot.sevenDayValue,
                    metadata: snapshot.sevenDayCaption,
                    state: snapshot.sevenDayState
                )
            }
        }
        .padding(12)
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

    private func metricTile(label: String, value: String, metadata: String, state: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 4) {
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
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
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
    init(
        summary: EnergyBalanceOverviewSummary,
        userMarker: String?,
        generatedAt: Date,
        locale: Locale = .current
    ) {
        self.init(
            localDate: summary.date,
            userMarker: userMarker,
            generatedAtISO8601: Self.iso8601String(generatedAt),
            generatedAtText: Self.formattedGeneratedAt(generatedAt, locale: locale),
            lastSyncedText: Self.formattedLastSyncedText(generatedAt, locale: locale),
            consumedValue: summary.consumedValue,
            consumedCaption: summary.consumedCaption,
            burnedValue: summary.burnedValue,
            burnedCaption: summary.burnedCaption,
            netValue: summary.netTodayValue,
            netCaption: summary.netTodayCaption,
            netState: summary.net.map { _ in Self.widgetBalanceState(summary.netState) },
            sevenDayValue: summary.sevenDayAverageValue,
            sevenDayCaption: summary.sevenDayAverageCaption,
            sevenDayState: summary.sevenDayAverageState.map(Self.widgetBalanceState)
        )
    }

    static let placeholder = EnergyBalanceWidgetSnapshot(
        localDate: "2026-07-11",
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
        sevenDayState: "deficit"
    )

    private static func widgetBalanceState(_ state: DailyCalorieBalanceState) -> String {
        switch state {
        case .deficit: "deficit"
        case .surplus: "surplus"
        case .balanced: "balanced"
        case .intakeOnly: "unavailable"
        }
    }
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
                date: .now,
                snapshot: .placeholder,
                isPlaceholder: true,
                refreshDecision: .liveSnapshot
            ))
            .previewDisplayName("Live or cached data")

            EnergyBalanceWidgetView(entry: EnergyBalanceTimelineEntry(
                date: .now,
                snapshot: nil,
                isPlaceholder: false,
                refreshDecision: .emptyState
            ))
            .previewDisplayName("Empty state")
        }
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
#endif
