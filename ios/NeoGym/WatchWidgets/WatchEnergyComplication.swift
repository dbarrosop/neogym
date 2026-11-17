import NeoGymKit
import SwiftUI
import WidgetKit

#if !NEOGYM_GALLERY
@main
struct NeoGymWatchWidgetBundle: WidgetBundle {
    var body: some Widget { WatchEnergyComplication() }
}
#endif

/// The latest token-free snapshot (any date). Its presence tells "connected" apart
/// from "not connected"; the content is decided at each entry's date.
private struct EnergyEntry: TimelineEntry {
    let date: Date
    let snapshot: WatchEnergySnapshot?

    var content: WatchComplicationContent { WatchComplicationContent(latest: snapshot, at: date) }
}

private struct EnergyProvider: TimelineProvider {
    func placeholder(in context: Context) -> EnergyEntry {
        EnergyEntry(date: .now, snapshot: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (EnergyEntry) -> Void) {
        let date = Date()
        let current = EnergyEntry(date: date, snapshot: context.isPreview ? .sample : WatchEnergySnapshotStore.shared.loadLatest())
        recordProviderRead(.snapshot, entry: current)
        completion(current)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EnergyEntry>) -> Void) {
        let date = Date()
        let latest = WatchEnergySnapshotStore.shared.loadLatest()
        let current = EnergyEntry(date: date, snapshot: latest)
        recordProviderRead(.timeline, entry: current)
        // WidgetKit can defer reloads, so the same snapshot re-renders when it turns
        // stale (it then shows its time) and at local midnight (no data yet today).
        let later = WatchComplicationContent.transitionDates(for: latest, after: date)
            .map { EnergyEntry(date: $0, snapshot: latest) }
        completion(Timeline(entries: [current] + later, policy: .after(date.addingTimeInterval(30 * 60))))
    }

    /// Receipts keep their meaning: the update time of *today's* snapshot, if any.
    private func recordProviderRead(_ request: WatchWidgetProviderReceipt.Request, entry: EnergyEntry) {
        let localDate = DateOnly.formatLocalISO(entry.date)
        _ = WatchWidgetProviderReceiptStore.shared.append(.init(
            requestedAt: entry.date, request: request, localDate: localDate,
            snapshotUpdatedAt: entry.snapshot?.localDate == localDate ? entry.snapshot?.updatedAt : nil
        ))
    }
}

private struct WatchEnergyComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WatchEnergySnapshotStore.widgetKind, provider: EnergyProvider()) { entry in
            ComplicationView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Balance")
        .description("Today's balance so far with food in and energy out, or food in against your plan.")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular])
    }
}

private struct ComplicationView: View {
    let entry: EnergyEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if family == .accessoryCircular {
            CircularIntake(content: entry.content)
        } else {
            RectangularBalance(content: entry.content)
        }
    }
}

/// Mirrors the iPhone Lock Screen widget: balance so far, then in and out. Full
/// colour uses the accent for the title; tinted faces tint only the title, and the
/// numbers stay white.
private struct RectangularBalance: View {
    let content: WatchComplicationContent

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            switch content {
            case let .balance(display, isStale):
                title(display.watchTitle(isStale: isStale)) { balanceGlyph }
                Text(display.balanceWithUnit)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                Text(display.inOut)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            case .waitingForToday:
                title("Balance so far") { balanceGlyph }
                Text("\(KcalText.missing) kcal")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                Text("Open NeoGym to sync")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            case .notConnected:
                title("NeoGym") { Image(systemName: "dumbbell.fill").font(.system(size: 11)) }
                Text("Not connected")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Open the app on iPhone")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private func title(_ text: String, @ViewBuilder glyph: () -> some View) -> some View {
        HStack(spacing: 4) {
            glyph()
            Text(text)
        }
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(WatchPalette.accentText)
        .widgetAccentable()
    }

    private var balanceGlyph: some View {
        BalanceScaleIcon()
            .stroke(style: BalanceScaleIcon.stroke(for: 13))
            .frame(width: 13, height: 13)
    }

    private var accessibilityLabel: String {
        switch content {
        case let .balance(display, isStale):
            let time = isStale ? ". Last updated \(display.updatedTime)" : ""
            return "\(display.balanceAccessibility). \(display.inOutAccessibility)\(time)"
        case .waitingForToday:
            return "No balance yet today. Open NeoGym to sync"
        case .notConnected:
            return "NeoGym not connected. Open the app on iPhone"
        }
    }
}

/// Food in against the plan, compact ("1.5k"). The ring takes Chart 1 in full colour
/// and the face colour on tinted faces; numbers stay white.
private struct CircularIntake: View {
    let content: WatchComplicationContent

    var body: some View {
        switch content {
        case let .balance(display, _):
            ring(progress: display.planProgress ?? 0) {
                Text(display.compactConsumed).font(.system(size: 13, weight: .bold))
            }
            .accessibilityLabel(display.planAccessibility)
        case .waitingForToday:
            ring(progress: 0) {
                Text(KcalText.missing).font(.system(size: 13, weight: .bold))
            }
            .accessibilityLabel("Food in unavailable, not synced today. Open NeoGym to sync")
        case .notConnected:
            ZStack {
                Circle()
                    .stroke(.white.opacity(0.18), lineWidth: 4)
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(WatchPalette.accentText)
                    .widgetAccentable()
            }
            .padding(2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("NeoGym not connected")
        }
    }

    private func ring(progress: Double, @ViewBuilder value: () -> some View) -> some View {
        ZStack {
            Gauge(value: progress) { EmptyView() }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(WatchPalette.chart1)
                .widgetAccentable()
            VStack(spacing: 0) {
                value()
                Text("IN")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(.white)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        }
        .accessibilityElement(children: .ignore)
    }
}

private extension WatchEnergySnapshot {
    /// Face gallery and placeholder values; never written to the App Group.
    static var sample: WatchEnergySnapshot {
        WatchEnergySnapshot(
            userID: "preview", localDate: DateOnly.todayLocalISO(), consumedKcal: 1_461,
            burnedKcal: 1_210, activeKcal: 531, restingKcal: 679, updatedAt: .now,
            rowSource: .imported, pendingBackend: false, planKcal: 2_243
        )
    }
}

#if NEOGYM_GALLERY
/// Uses the production family views, not a widget provider or App Group read.
struct ComplicationGalleryView: View {
    let content: WatchComplicationContent
    let circular: Bool

    var body: some View {
        if circular { CircularIntake(content: content) }
        else { RectangularBalance(content: content) }
    }
}
#endif
