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

    private var mealIds: [String] {
        meals.map(\.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            searchField

            if meals.isEmpty {
                message("No meal templates are available yet. Create a private meal first.")
            } else if visibleMeals.isEmpty {
                message("No meals match this search.")
            } else {
                Picker("Meal", selection: $mealId) {
                    ForEach(visibleMeals) { meal in
                        MealPickerWheelRow(meal: meal)
                            .tag(meal.id)
                    }
                }
                .pickerStyle(.wheel)
                .labelsHidden()
                .frame(height: 88)
                .clipped()
                .disabled(disabled)
            }
        }
        .onAppear(perform: syncSelectionWithFilter)
        .onChange(of: query) { _ in syncSelectionWithFilter() }
        .onChange(of: mealIds) { _ in syncSelectionWithFilter() }
    }

    private var searchField: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField(selectedMeal?.name ?? "Filter meals…", text: $query)
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
                .accessibilityLabel("Clear search")
            }
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundColor(NeoGymTheme.mutedText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func syncSelectionWithFilter() {
        guard let firstVisible = visibleMeals.first else { return }
        if mealId.isEmpty || !visibleMeals.contains(where: { $0.id == mealId }) {
            mealId = firstVisible.id
        }
    }
}

private struct MealPickerWheelRow: View {
    let meal: Meal

    var body: some View {
        HStack(spacing: 4) {
            Text(meal.name)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
            Text("· \(meal.mealIngredients.count) ingredient\(meal.mealIngredients.count == 1 ? "" : "s") · "
                + NutritionMath.macroTotalsSummary(meal.macroTotals))
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
    }
}
