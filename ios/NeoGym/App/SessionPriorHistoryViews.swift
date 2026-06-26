import NeoGymKit
import SwiftUI

struct CardioMissingSchemaNotice: View {
    var body: some View {
        Text(
            "This cardio exercise is missing its metrics schema, so entries can't be logged here. "
                + "An admin needs to configure it before this exercise can be used."
        )
            .font(.caption)
            .foregroundColor(NeoGymTheme.mutedText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct StrengthPriorSummary: View {
    let entries: [SessionPriorStrengthEntry]
    let doubleWeight: Bool

    var body: some View {
        if entries.isEmpty == false {
            VStack(alignment: .leading, spacing: 6) {
                Label("Recent", systemImage: "clock.arrow.circlepath")
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                ForEach(entries) { entry in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(shortPriorDate(entry.startedAt))
                            .font(.caption2)
                            .foregroundColor(NeoGymTheme.mutedText)
                            .frame(width: 54, alignment: .leading)
                        Text(Self.setSummary(entry.sets, doubleWeight: doubleWeight))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(NeoGymTheme.mutedText)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(10)
            .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private static func setSummary(_ sets: [SessionStrengthSet], doubleWeight: Bool) -> String {
        guard sets.isEmpty == false else { return "no sets" }
        let hasWeight = sets.contains { $0.weight > 0 }
        let summary = sets.map { set in
            set.weight == 0 ? "\(set.reps)×BW" : "\(set.reps)×\(formatWeight(set.weight))kg"
        }.joined(separator: ", ")
        return summary + (doubleWeight && hasWeight ? " /side" : "")
    }

    private static func formatWeight(_ weight: Double) -> String {
        weight.rounded() == weight ? String(format: "%.0f", weight) : String(format: "%.1f", weight)
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
                    .foregroundColor(NeoGymTheme.mutedText)
                ForEach(filtered) { entry in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(shortPriorDate(entry.startedAt))
                            .font(.caption2)
                            .foregroundColor(NeoGymTheme.mutedText)
                            .frame(width: 54, alignment: .leading)
                        Text(Self.cardioSummary(entry.entries, primary: primary))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(NeoGymTheme.mutedText)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(10)
            .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
