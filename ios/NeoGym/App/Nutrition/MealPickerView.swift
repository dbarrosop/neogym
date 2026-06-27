import NeoGymKit
import SwiftUI

struct MealPickerView: View {
    let meals: [Meal]
    @Binding var mealId: String
    var disabled = false

    @State private var query = ""

    private var selectedMeal: Meal? {
        meals.first { $0.id == mealId }
    }

    private var visibleMeals: [Meal] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return meals }
        return meals.filter { meal in
            meal.name.lowercased().contains(trimmed)
                || (meal.description?.lowercased().contains(trimmed) ?? false)
                || meal.mealIngredients.contains { ingredient in
                    ingredient.food?.name.lowercased().contains(trimmed) ?? false
                }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(NeoGymTheme.mutedText)
                TextField(selectedMeal?.name ?? "Search your meals…", text: $query)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .disabled(disabled)
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .nutritionGlassCard(cornerRadius: 12)

            if let selectedMeal {
                selectedRow(meal: selectedMeal)
            }

            if meals.isEmpty {
                Text("No meal templates are available yet. Create a private meal first.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            } else if visibleMeals.isEmpty {
                Text("No meals match this search.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            } else {
                VStack(spacing: 0) {
                    ForEach(visibleMeals.prefix(8)) { meal in
                        Button {
                            mealId = meal.id
                            query = ""
                        } label: {
                            MealPickerRow(meal: meal, isSelected: meal.id == mealId)
                        }
                        .buttonStyle(.plain)
                        .disabled(disabled)
                        if meal.id != visibleMeals.prefix(8).last?.id { Divider() }
                    }
                }
                .nutritionGlassCard(cornerRadius: 12)
            }
        }
    }

    private func selectedRow(meal: Meal) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.accentColor)
            Text(meal.name)
                .font(.caption.weight(.semibold))
            Spacer()
            Text("Selected")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .foregroundColor(.accentColor)
                .glassSurface(
                    cornerRadius: NeoGymTheme.radiusPill,
                    material: .ultraThin,
                    tint: NeoGymTheme.accentMuted,
                    stroke: Color.accentColor.opacity(0.25),
                    shadow: false
                )
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.accentMuted, stroke: Color.accentColor.opacity(0.25))
    }
}

private struct MealPickerRow: View {
    let meal: Meal
    let isSelected: Bool

    var body: some View {
        let totals = meal.macroTotals
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "fork.knife.circle")
                .foregroundColor(isSelected ? .accentColor : NeoGymTheme.mutedText)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 4) {
                Text(meal.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("\(meal.mealIngredients.count) ingredient\(meal.mealIngredients.count == 1 ? "" : "s") · "
                    + NutritionMath.macroTotalsSummary(totals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(2)
                if let description = meal.description, !description.isEmpty {
                    Text(description)
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(1)
                }
            }
            Spacer()
        }
        .padding(10)
    }
}
