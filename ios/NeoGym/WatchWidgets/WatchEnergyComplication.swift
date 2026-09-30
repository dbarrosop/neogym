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
                        HStack(spacing: 3) {
                            Image(systemName: "fork.knife").foregroundStyle(.green)
                            Text(kcal(snapshot.consumedKcal))
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Consumed \(kcal(snapshot.consumedKcal)) kilocalories")
                        Spacer(minLength: 0)
                        HStack(spacing: 3) {
                            Image(systemName: "flame").foregroundStyle(.red)
                            Text(kcal(snapshot.burnedKcal))
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(snapshot.burnedKcal == nil
                            ? "Burned calories unavailable" : "Burned \(kcal(snapshot.burnedKcal)) kilocalories")
                    }
                    .font(.caption2.bold())
                    .monospacedDigit()
                    Text("Active \(kcal(snapshot.activeKcal)) · Rest \(kcal(snapshot.restingKcal))")
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(
                            "\(metricAccessibility("Active", snapshot.activeKcal)), "
                                + metricAccessibility("Resting", snapshot.restingKcal)
                        )
                    HStack(spacing: 3) {
                        BalanceScaleIcon()
                            .stroke(.teal, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                            .frame(width: 16, height: 16)
                        Text(signedKcal(snapshot.netKcal)).monospacedDigit()
                        Spacer(minLength: 1)
                        Image(systemName: snapshot.pendingBackend == true ? "waveform.path.ecg" : "clock")
                            .font(.system(size: 9)).foregroundStyle(.secondary)
                        Text(snapshot.updatedAt, style: .relative)
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                    .font(.caption2.bold())
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(netAccessibility(snapshot))
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

    private func netAccessibility(_ snapshot: WatchEnergySnapshot) -> String {
        let net = snapshot.netKcal == nil
            ? "Net calories unavailable" : "Net \(signedKcal(snapshot.netKcal)) kilocalories"
        let time = snapshot.updatedAt.formatted(date: .abbreviated, time: .shortened)
        return "\(net). \(snapshot.pendingBackend == true ? "Apple Health estimate awaiting server sync" : "Backend snapshot") from \(time)"
    }
}

/// A compact two-pan balance, rather than SF Symbols' mass/weight icon.
private struct BalanceScaleIcon: Shape {
    func path(in rect: CGRect) -> Path {
        let unit = min(rect.width, rect.height) / 24
        func point(_ horizontal: CGFloat, _ vertical: CGFloat) -> CGPoint {
            CGPoint(x: rect.midX + (horizontal - 12) * unit,
                    y: rect.midY + (vertical - 12) * unit)
        }

        var path = Path()
        path.move(to: point(3, 6))
        path.addLine(to: point(21, 6)) // beam
        path.move(to: point(12, 7))
        path.addLine(to: point(12, 21)) // post
        path.move(to: point(8, 21))
        path.addLine(to: point(16, 21)) // base
        path.addEllipse(in: CGRect(x: point(10, 3).x, y: point(10, 3).y,
                                   width: 4 * unit, height: 4 * unit))

        for (hook, left, right) in [(4.0, 2.0, 10.0), (20.0, 14.0, 22.0)] {
            path.move(to: point(hook, 6))
            path.addLine(to: point(left, 14))
            path.move(to: point(hook, 6))
            path.addLine(to: point(right, 14))
            path.move(to: point(left, 14))
            path.addLine(to: point(right, 14))
            path.addQuadCurve(to: point(left, 14), control: point((left + right) / 2, 19))
        }
        return path
    }
}
