import NeoGymKit
import SwiftUI

struct CardioEntriesListView: View {
    let entries: [SessionCardioEntryShell]
    let schema: CardioMetricsSchema
    let onSelect: (SessionCardioEntryShell) -> Void

    var body: some View {
        if entries.isEmpty {
            Text("No entries logged yet.")
                .font(.caption.italic())
                .foregroundColor(NeoGymTheme.mutedText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
        } else {
            VStack(spacing: 0) {
                ForEach(entries) { entry in
                    Button { onSelect(entry) } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text("\(entry.entryNumber)")
                                .font(.caption.weight(.bold))
                                .frame(width: 28, height: 28)
                                .glassSurface(
                                    cornerRadius: NeoGymTheme.radiusPill,
                                    material: .ultraThin,
                                    tint: NeoGymTheme.glassSubtleFill,
                                    shadow: false
                                )
                            metricSummary(entry)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    if entry.id != entries.last?.id { Divider() }
                }
            }
            .padding(.horizontal, NeoGymTheme.spacingXS)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: NeoGymTheme.glassSubtleFill,
                shadow: false
            )
        }
    }

    private func metricSummary(_ entry: SessionCardioEntryShell) -> some View {
        FlowLayout(spacing: 10) {
            ForEach(CardioMetricsSchemaHelpers.iterateMetrics(schema), id: \.key) { spec in
                if let value = entry.metrics[spec.key] {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(spec.label.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(NeoGymTheme.mutedText)
                        Text(CardioMetricsSchemaHelpers.formatMetricValue(value, spec: spec))
                            .font(.subheadline.monospacedDigit().weight(.semibold))
                            .foregroundColor(.primary)
                    }
                }
            }
        }
    }
}

private struct FlowLayout<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder var content: Content

    init(spacing: CGFloat, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: spacing) {
            content
        }
    }
}
