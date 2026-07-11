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

    var displaySnapshot: EnergyBalanceWidgetSnapshot? {
        snapshot ?? (isPlaceholder ? .placeholder : nil)
    }
}

struct EnergyBalanceTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> EnergyBalanceTimelineEntry {
        EnergyBalanceTimelineEntry(date: Date(), snapshot: .placeholder, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyBalanceTimelineEntry) -> Void) {
        let snapshot = context.isPreview ? EnergyBalanceWidgetSnapshot.placeholder : EnergyBalanceWidgetSnapshotStore.shared.load()
        completion(EnergyBalanceTimelineEntry(date: Date(), snapshot: snapshot, isPlaceholder: context.isPreview))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyBalanceTimelineEntry>) -> Void) {
        let now = Date()
        let snapshot = EnergyBalanceWidgetSnapshotStore.shared.load()
        let entry = EnergyBalanceTimelineEntry(date: now, snapshot: snapshot, isPlaceholder: false)

        // WidgetKit treats timeline policies as best-effort hints. The widget cannot fetch live
        // server data in this phase, so scheduled reloads only re-read the app-written cache when
        // iOS decides to grant the extension time.
        let reloadInterval: TimeInterval = snapshot == nil ? 15 * 60 : 30 * 60
        completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(reloadInterval))))
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
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Energy balance")
                        .font(.headline.weight(.semibold))
                        .lineLimit(1)
                    Text(snapshot.lastSyncedText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: "bolt.heart.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.orange)
                    .accessibilityHidden(true)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                metricTile(label: "Consumed", value: snapshot.consumedValue, caption: snapshot.consumedCaption)
                metricTile(label: "Burned", value: snapshot.burnedValue, caption: snapshot.burnedCaption)
                metricTile(label: "Net today", value: snapshot.netValue, caption: snapshot.netCaption, state: snapshot.netState)
                metricTile(label: "7-day avg net", value: snapshot.sevenDayValue, caption: snapshot.sevenDayCaption, state: snapshot.sevenDayState)
            }

            Text("Generated \(snapshot.generatedAtText) · Tap to open NeoGym")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(14)
        .accessibilityElement(children: .combine)
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
                Text("Load the Nutrition overview to refresh your cached energy balance.")
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

    private func metricTile(label: String, value: String, caption: String, state: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                if let state, state != "unavailable" {
                    Circle()
                        .fill(color(for: state))
                        .frame(width: 6, height: 6)
                        .accessibilityLabel(Text(state.capitalized))
                }
            }
            Text(value)
                .font(.system(.headline, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(caption)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func color(for state: String) -> Color {
        switch state {
        case "deficit": .green
        case "surplus": .orange
        case "balanced": .blue
        default: .secondary
        }
    }
}

private extension EnergyBalanceWidgetSnapshot {
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
                isPlaceholder: true
            ))
            .previewDisplayName("Cached data")

            EnergyBalanceWidgetView(entry: EnergyBalanceTimelineEntry(
                date: .now,
                snapshot: nil,
                isPlaceholder: false
            ))
            .previewDisplayName("Empty state")
        }
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
#endif
