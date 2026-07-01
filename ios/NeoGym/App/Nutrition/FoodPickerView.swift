import NeoGymKit
import SwiftUI

struct FoodPickerView: View {
    let foods: [Food]
    @Binding var foodId: String
    var disabled = false
    var revealWheelOnDemand = false

    @State private var query = ""
    @State private var wheelRevealed = false
    @FocusState private var searchFocused: Bool

    private var selectedFood: Food? {
        foods.first { $0.id == foodId }
    }

    private var visibleFoods: [Food] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return foods }
        return foods.filter { $0.name.lowercased().contains(trimmed) }
    }

    private var foodIds: [String] {
        foods.map(\.id)
    }

    private var shouldShowWheel: Bool {
        !revealWheelOnDemand || wheelRevealed
    }

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            searchField

            if revealWheelOnDemand, let selectedFood {
                selectedSummary(food: selectedFood)
            }

            pickerContent
        }
        .onAppear(perform: syncSelectionWithFilter)
        .onChange(of: query) { _ in
            if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                revealWheelIfEnabled()
            }
            syncSelectionWithFilter()
        }
        .onChange(of: foodIds) { _ in syncSelectionWithFilter() }
        .onChange(of: searchFocused) { focused in
            if focused {
                revealWheelIfEnabled()
            }
        }
    }

    @ViewBuilder
    private var pickerContent: some View {
        if foods.isEmpty {
            message("No foods are available yet. Create a private food first.")
        } else if visibleFoods.isEmpty {
            if !revealWheelOnDemand || wheelRevealed || !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                message("No foods match this search.")
            }
        } else if shouldShowWheel {
            if revealWheelOnDemand {
                Button("Done") { collapseWheel() }
                    .buttonStyle(.plain)
                    .font(.caption.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .disabled(disabled)
            }

            Picker("Food", selection: $foodId) {
                ForEach(visibleFoods) { food in
                    FoodWheelRow(food: food)
                        .tag(food.id)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
            .frame(height: 176)
            .clipped()
            .disabled(disabled)

            if !revealWheelOnDemand, let selectedFood {
                selectedSummary(food: selectedFood)
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField(selectedFood?.name ?? "Filter foods…", text: $query)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .submitLabel(.done)
                .focused($searchFocused)
                .disabled(disabled)
                .onSubmit { searchFocused = false }
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .accessibilityLabel("Clear search")
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { revealWheelIfEnabled() }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { searchFocused = false }
            }
        }
    }

    private func selectedSummary(food: Food) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.accentColor)
                Text(food.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                FoodVisibilityBadge(isPublic: food.isPublic)
            }
            Text(NutritionMath.macroSummary(food.macroFields) + " per 100g")
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundColor(NeoGymTheme.mutedText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func syncSelectionWithFilter() {
        guard let firstVisible = visibleFoods.first else { return }
        if foodId.isEmpty || !visibleFoods.contains(where: { $0.id == foodId }) {
            foodId = firstVisible.id
        }
    }

    private func revealWheelIfEnabled() {
        guard revealWheelOnDemand, !disabled else { return }
        wheelRevealed = true
    }

    private func collapseWheel() {
        guard revealWheelOnDemand else { return }
        wheelRevealed = false
        searchFocused = false
        query = ""
    }
}

private struct FoodWheelRow: View {
    let food: Food

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "apple.logo")
                .foregroundColor(NeoGymTheme.mutedText)
            Text(food.name)
                .font(.body.weight(.semibold))
                .lineLimit(1)
        }
    }
}
