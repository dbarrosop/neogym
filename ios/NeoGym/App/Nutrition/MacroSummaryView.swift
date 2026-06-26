import NeoGymKit
import SwiftUI

struct MacroSummaryView: View {
    let totals: MacroTotals
    var title = "Totals"
    var description: String?
    var compact = false

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
                    macroTile(label: "Calories", value: totals.kcal, unit: "kcal")
                    macroTile(label: "Fat", value: totals.fat, unit: "g")
                    macroTile(label: "Carbs", value: totals.carbs, unit: "g")
                    macroTile(label: "Protein", value: totals.protein, unit: "g")
                    macroTile(label: "Fiber", value: totals.fiber, unit: "g")
                    macroTile(label: "Sugar", value: totals.sugar, unit: "g")
                }
            }
            .padding(14)
            .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(NeoGymTheme.border))
        }
    }

    private func macroTile(label: String, value: Double, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(NutritionMath.formatMacro(value, unit: unit))
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
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
            .background(isPublic ? Color.accentColor.opacity(0.12) : NeoGymTheme.cardFill, in: Capsule())
            .overlay(Capsule().stroke(isPublic ? Color.accentColor.opacity(0.25) : NeoGymTheme.border))
    }
}
