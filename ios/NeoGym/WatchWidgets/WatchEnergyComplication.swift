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
        let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: date))!
        // WidgetKit can defer reloads, so expire today's values with an empty entry at local midnight.
        completion(Timeline(entries: [entry(at: date), EnergyEntry(date: midnight, snapshot: nil)],
                            policy: .after(date.addingTimeInterval(30 * 60))))
    }

    private func entry(at date: Date) -> EnergyEntry {
        EnergyEntry(date: date,
                    snapshot: WatchEnergySnapshotStore.shared.load(for: DateOnly.formatLocalISO(date)))
    }
}

private struct WatchEnergyComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WatchEnergySnapshotStore.widgetKind, provider: EnergyProvider()) { entry in
            VStack(alignment: .leading, spacing: 2) {
                if let snapshot = entry.snapshot {
                    HStack(spacing: 8) {
                        Label("\(kcal(snapshot.consumedKcal)) in", systemImage: "fork.knife")
                            .accessibilityLabel("Consumed \(kcal(snapshot.consumedKcal)) kilocalories")
                        Label("\(kcal(snapshot.burnedKcal)) out", systemImage: "flame")
                            .accessibilityLabel(snapshot.burnedKcal == nil
                                ? "Burned calories unavailable" : "Burned \(kcal(snapshot.burnedKcal)) kilocalories")
                    }
                    .font(.caption2.bold())
                    Text("Active \(kcal(snapshot.activeKcal)) · Rest \(kcal(snapshot.restingKcal))")
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(
                            "\(metricAccessibility("Active", snapshot.activeKcal)), "
                                + metricAccessibility("Resting", snapshot.restingKcal)
                        )
                    Label(signedKcal(snapshot.netKcal), systemImage: "scalemass")
                        .font(.caption2.bold())
                        .accessibilityLabel(snapshot.netKcal == nil
                            ? "Net calories unavailable" : "Net \(signedKcal(snapshot.netKcal)) kilocalories")
                } else {
                    Text("Open NeoGym to sync").font(.caption2)
                }
            }
            .font(.caption2)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Energy")
        .description("Today's consumed, total, active, resting, and net calories from NeoGym.")
        .supportedFamilies([.accessoryRectangular])
    }

    private func kcal(_ value: Double?) -> String {
        value.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "—"
    }

    private func signedKcal(_ value: Double?) -> String {
        guard let value else { return "—" }
        let formatted = kcal(value)
        return value > 0 ? "+\(formatted)" : formatted
    }

    private func metricAccessibility(_ name: String, _ value: Double?) -> String {
        guard let value else { return "\(name) energy unavailable" }
        return "\(name) \(kcal(value)) kilocalories"
    }
}
