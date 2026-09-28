import NeoGymKit
import SwiftUI
import WidgetKit

@main
struct NeoGymWatchWidgetBundle: WidgetBundle {
    var body: some Widget { WatchEnergyComplication() }
}

private struct EnergyEntry: TimelineEntry {
    let date: Date
    let snapshot: WatchEnergySnapshot?
}

private struct EnergyProvider: TimelineProvider {
    func placeholder(in context: Context) -> EnergyEntry {
        EnergyEntry(date: .now, snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyEntry) -> Void) {
        completion(entry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyEntry>) -> Void) {
        let date = Date()
        completion(Timeline(entries: [entry(at: date)], policy: .after(date.addingTimeInterval(30 * 60))))
    }

    private func entry(at date: Date) -> EnergyEntry {
        EnergyEntry(date: date,
                    snapshot: WatchEnergySnapshotStore.shared.load(for: DateOnly.formatLocalISO(date)))
    }
}

private struct WatchEnergyComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WatchEnergySnapshotStore.widgetKind, provider: EnergyProvider()) { entry in
            VStack(alignment: .leading, spacing: 3) {
                Text("ENERGY · TODAY").font(.caption2).foregroundStyle(.secondary)
                if let snapshot = entry.snapshot {
                    HStack(spacing: 12) {
                        Label("\(snapshot.consumedKcal.formatted(.number.precision(.fractionLength(0)))) in", systemImage: "fork.knife")
                        Label(snapshot.burnedKcal.map { "\($0.formatted(.number.precision(.fractionLength(0)))) out" } ?? "— out",
                              systemImage: "flame")
                    }
                    .font(.caption.bold())
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                } else {
                    Text("Open NeoGym to sync").font(.caption2)
                }
            }
            .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Energy")
        .description("Today's consumed and burned calories from NeoGym.")
        .supportedFamilies([.accessoryRectangular])
    }
}
