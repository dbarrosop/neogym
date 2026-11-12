import NeoGymKit
import SwiftUI

struct CardioMissingSchemaNotice: View {
    var body: some View {
        Text(
            "This cardio exercise is missing its metrics schema, so entries can't be logged here. "
                + "An admin needs to configure it before this exercise can be used."
        )
            .font(.caption)
            .foregroundColor(NeoGymTheme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(NeoGymTheme.spacingSM)
            .cardSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                fill: NeoGymTheme.inset
            )
    }
}

struct CardioPriorSummary: View {
    let entries: [SessionPriorCardioEntry]
    let schema: CardioMetricsSchema

    var body: some View {
        let filtered = entries.filter { $0.entries.isEmpty == false }
        let specs = CardioMetricsSchemaHelpers.iterateMetrics(schema)
        if let primary = specs.first, filtered.isEmpty == false {
            VStack(alignment: .leading, spacing: 6) {
                Label("Recent", systemImage: "clock.arrow.circlepath")
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.textSecondary)
                ForEach(filtered) { entry in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(shortPriorDate(entry.startedAt))
                            .font(.caption2)
                            .foregroundColor(NeoGymTheme.textSecondary)
                            .frame(width: 54, alignment: .leading)
                        Text(Self.cardioSummary(entry.entries, primary: primary))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(NeoGymTheme.textSecondary)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(NeoGymTheme.spacingSM)
            .cardSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                fill: NeoGymTheme.inset
            )
        }
    }

    private static func cardioSummary(_ entries: [SessionCardioEntryShell], primary: CardioMetricSpec) -> String {
        entries
            .map { CardioMetricsSchemaHelpers.formatMetricValue($0.metrics[primary.key], spec: primary) }
            .joined(separator: ", ")
    }
}

private func shortPriorDate(_ iso: String) -> String {
    guard let date = ExerciseDateParser.parseTimestamp(iso) else { return "—" }
    let formatter = DateFormatter()
    let sameYear = Calendar.current.component(.year, from: date) == Calendar.current.component(.year, from: Date())
    formatter.dateFormat = sameYear ? "MMM d" : "MMM d, yyyy"
    return formatter.string(from: date)
}
