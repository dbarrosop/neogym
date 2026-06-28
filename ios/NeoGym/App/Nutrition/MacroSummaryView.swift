import NeoGymKit
import SwiftUI

struct MacroSummaryView: View {
    let totals: MacroTotals
    var title = "Totals"
    var description: String?
    var compact = false
    var targetTotals: MacroTotals?

    var body: some View {
        if compact {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.primary)
                if let description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                Text(NutritionMath.macroTotalsSummary(totals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                    if let description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    macroTile(label: "Calories", value: totals.kcal, target: targetTotals?.kcal, unit: "kcal")
                    macroTile(label: "Fat", value: totals.fat, target: targetTotals?.fat, unit: "g")
                    macroTile(label: "Carbs", value: totals.carbs, target: targetTotals?.carbs, unit: "g")
                    macroTile(label: "Protein", value: totals.protein, target: targetTotals?.protein, unit: "g")
                    macroTile(label: "Fiber", value: totals.fiber, target: targetTotals?.fiber, unit: "g")
                    macroTile(label: "Sugar", value: totals.sugar, target: targetTotals?.sugar, unit: "g")
                }
            }
            .padding(14)
            .nutritionGlassCard(cornerRadius: 16, tint: NeoGymTheme.glassSubtleFill)
        }
    }

    private func formatMacroNumber(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = value.rounded() == value ? 0 : 1
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    private func macroTile(label: String, value: Double, target: Double? = nil, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(target.map { "\(formatMacroNumber(value)) / \(formatMacroNumber($0)) \(unit)" }
                ?? NutritionMath.formatMacro(value, unit: unit))
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12)
    }
}

struct FoodVisibilityBadge: View {
    let isPublic: Bool

    var body: some View {
        Label(isPublic ? "Public" : "Mine", systemImage: isPublic ? "globe" : "person.fill")
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundColor(isPublic ? .accentColor : NeoGymTheme.mutedText)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusPill,
                material: .ultraThin,
                tint: isPublic ? NeoGymTheme.accentMuted : NeoGymTheme.glassSubtleFill,
                stroke: isPublic ? Color.accentColor.opacity(0.25) : NeoGymTheme.glassStrokeSecondary,
                shadow: false
            )
    }
}
