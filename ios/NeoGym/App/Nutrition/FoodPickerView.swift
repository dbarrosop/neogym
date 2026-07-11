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

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            searchField

            pickerContent
        }
        .onAppear(perform: syncSelectionWithFilter)
        .onChange(of: query) {
            revealWheelIfSearching()
            syncSelectionWithFilter()
        }
        .onChange(of: foodIds) { syncSelectionWithFilter() }
        .onChange(of: searchFocused) { _, isFocused in
            if isFocused { revealWheel() }
        }
        .onChange(of: disabled) { revealWheelIfSearching() }
    }

    @ViewBuilder
    private var pickerContent: some View {
        if foods.isEmpty {
            message("No foods are available yet. Create a private food first.")
        } else if visibleFoods.isEmpty {
            message("No foods match this search.")
        } else if shouldShowWheel {
            Picker("Food", selection: $foodId) {
                ForEach(visibleFoods) { food in
                    FoodPickerWheelRow(food: food)
                        .tag(food.id)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
            .frame(height: 88)
            .clipped()
            .disabled(disabled)
        }
    }

    private var searchField: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField(selectedFood?.name ?? "Filter foods…", text: $query)
                .focused($searchFocused)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .submitLabel(.search)
                .disabled(disabled)
                .onTapGesture(perform: revealWheel)
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
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundColor(NeoGymTheme.mutedText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var shouldShowWheel: Bool {
        !revealWheelOnDemand || wheelRevealed
    }

    private func revealWheel() {
        guard revealWheelOnDemand, !disabled else { return }
        wheelRevealed = true
    }

    private func revealWheelIfSearching() {
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            revealWheel()
        }
    }

    private func syncSelectionWithFilter() {
        guard let firstVisible = visibleFoods.first else { return }
        if foodId.isEmpty || !visibleFoods.contains(where: { $0.id == foodId }) {
            foodId = firstVisible.id
        }
    }

}

private struct FoodPickerWheelRow: View {
    let food: Food

    var body: some View {
        HStack(spacing: 4) {
            Text(food.name)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
            Text("· " + NutritionMath.macroSummary(food.macroFields))
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
