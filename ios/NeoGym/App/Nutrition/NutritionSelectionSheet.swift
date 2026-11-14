import NeoGymKit
import SwiftUI

/// Searchable list sheet that picks one food or meal for an editor row, with
/// a top-trailing action that pushes a create form in the same sheet.
struct NutritionSelectionSheet<Item: Identifiable, NewItemForm: View>: View where Item.ID == String {
    let title: String
    let searchPrompt: String
    let items: [Item]
    let name: (Item) -> String
    let caption: (Item) -> String
    let newItemTitle: String
    let onSelect: (Item) -> Void
    @ViewBuilder let newItemForm: () -> NewItemForm

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var filteredItems: [Item] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return items }
        return items.filter { name($0).localizedCaseInsensitiveContains(trimmed) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                    SearchField(placeholder: searchPrompt, text: $query)
                    if filteredItems.isEmpty {
                        Text(items.isEmpty ? "Nothing to choose yet." : "No matches for “\(query)”.")
                            .font(.subheadline)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, NeoGymTheme.spacingXL)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(filteredItems.enumerated()), id: \.element.id) { index, item in
                                if index > 0 { RowSeparator() }
                                Button {
                                    onSelect(item)
                                    dismiss()
                                } label: {
                                    selectionRow(item)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .cardSurface()
                    }
                }
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.spacingXS)
            }
            .scrollDismissesKeyboard(.interactively)
            .screenBackground()
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        newItemForm()
                            .screenBackground()
                    } label: {
                        Text(newItemTitle)
                    }
                }
            }
        }
    }

    private func selectionRow(_ item: Item) -> some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name(item))
                    .foregroundStyle(NeoGymTheme.text)
                    .multilineTextAlignment(.leading)
                Text(caption(item))
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            Spacer(minLength: NeoGymTheme.spacingXS)
            Image(systemName: "plus.circle.fill")
                .font(.title3)
                .foregroundStyle(NeoGymTheme.accentText)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 10)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Adds this item")
    }
}

/// Captions shared by the food and meal selection lists.
enum NutritionSelectionCaption {
    static func food(_ food: Food) -> String {
        let per100 = NutritionMath.macrosForGrams(input: food.macroFields, grams: .number(100))
        let macros = "\(MetricFormat.whole(per100.kcal)) kcal · P \(MetricFormat.whole(per100.protein))"
            + " · C \(MetricFormat.whole(per100.carbs)) · F \(MetricFormat.whole(per100.fat)) per 100 g"
        return food.isPublic ? macros + " · Public" : macros
    }

    static func meal(_ meal: Meal) -> String {
        let totals = meal.macroTotals
        let count = meal.mealIngredients.count
        return "\(MetricFormat.whole(totals.kcal)) kcal · P \(MetricFormat.whole(totals.protein))"
            + " · \(count) ingredient\(count == 1 ? "" : "s")"
    }
}
