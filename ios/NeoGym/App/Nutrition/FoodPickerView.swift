import NeoGymKit
import SwiftUI

struct FoodPickerView: View {
    let foods: [Food]
    @Binding var foodId: String
    var disabled = false

    @State private var query = ""

    private var selectedFood: Food? {
        foods.first { $0.id == foodId }
    }

    private var visibleFoods: [Food] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return foods }
        return foods.filter { $0.name.lowercased().contains(trimmed) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(NeoGymTheme.mutedText)
                TextField(selectedFood?.name ?? "Search own and public foods…", text: $query)
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

            if let selectedFood {
                selectedRow(food: selectedFood)
            }

            if foods.isEmpty {
                Text("No foods are available yet. Create a private food first.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            } else if visibleFoods.isEmpty {
                Text("No foods match this search.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            } else {
                VStack(spacing: 0) {
                    ForEach(visibleFoods.prefix(8)) { food in
                        Button {
                            foodId = food.id
                            query = ""
                        } label: {
                            FoodPickerRow(food: food, isSelected: food.id == foodId)
                        }
                        .buttonStyle(.plain)
                        .disabled(disabled)
                        if food.id != visibleFoods.prefix(8).last?.id { Divider() }
                    }
                }
                .nutritionGlassCard(cornerRadius: 12)
            }
        }
        .onAppear {
            if query.isEmpty, foodId.isEmpty {
                query = ""
            }
        }
    }

    private func selectedRow(food: Food) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.accentColor)
            Text(food.name)
                .font(.caption.weight(.semibold))
            Spacer()
            FoodVisibilityBadge(isPublic: food.isPublic)
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.accentMuted, stroke: Color.accentColor.opacity(0.25))
    }
}

private struct FoodPickerRow: View {
    let food: Food
    let isSelected: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "apple.logo")
                .foregroundColor(isSelected ? .accentColor : NeoGymTheme.mutedText)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(food.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    FoodVisibilityBadge(isPublic: food.isPublic)
                }
                Text(NutritionMath.macroSummary(food.macroFields) + " per 100g")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(10)
    }
}
