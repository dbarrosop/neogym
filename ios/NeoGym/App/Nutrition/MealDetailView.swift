import NeoGymKit
import SwiftUI

struct MealDetailView: View {
    @StateObject private var viewModel: MealDetailViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        mealId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: MealDetailViewModel(mealId: mealId, repository: repository))
        self.repository = repository
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: 680)
                .padding(.horizontal, 20)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .navigationTitle("Meal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if let meal = viewModel.meal {
                    NavigationLink {
                        MealEditView(
                            mealId: meal.id,
                            repository: repository,
                            onSaved: {
                                onMutated()
                                Task { await viewModel.load() }
                            },
                            onDeleted: {
                                onDeleted()
                                presentationMode.wrappedValue.dismiss()
                            }
                        )
                    } label: { Image(systemName: "pencil") }
                        .accessibilityLabel("Edit meal")
                }
            }
        }
        .task { if case .idle = viewModel.state { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading meal") { AppLoadingStateView(title: "Loading meal") }
        case .loading where viewModel.meal == nil:
            SectionShell(title: "Loading meal") { AppLoadingStateView(title: "Loading meal") }
        case let .failed(message, _) where viewModel.meal == nil:
            SectionShell(title: "Meal") {
                AppErrorStateView(title: "Failed to load meal", message: message) { Task { await viewModel.load() } }
            }
        default:
            if let meal = viewModel.meal {
                SectionShell(
                    title: meal.name,
                    subtitle: meal.description?.isEmpty == false ? meal.description : "Meal template"
                ) {
                    VStack(alignment: .leading, spacing: 18) {
                        MacroSummaryView(
                            totals: meal.macroTotals,
                            title: "Meal totals",
                            description: "Live food edits update this template's display."
                        )
                        ingredientsList(meal)
                    }
                }
            }
        }
    }

    private func ingredientsList(_ meal: Meal) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ingredients")
                .font(.subheadline.weight(.semibold))
            Text(
                "Deleting this reusable meal does not delete historical day logs; "
                    + "logged meal provenance is detached by the database."
            )
            .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
            if meal.mealIngredients.isEmpty {
                Text("This meal does not have ingredients yet.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                VStack(spacing: 0) {
                    ForEach(meal.mealIngredients) { ingredient in
                        IngredientDetailRow(ingredient: ingredient)
                        if ingredient.id != meal.mealIngredients.last?.id { Divider() }
                    }
                }
                .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
            }
        }
    }
}

private struct IngredientDetailRow: View {
    let ingredient: MealIngredient

    var body: some View {
        let totals = ingredient.food.map {
            NutritionMath.macrosForGrams(input: $0.macroFields, grams: ingredient.grams)
        } ?? .empty
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(ingredient.food?.name ?? "Unknown food")
                    .font(.subheadline.weight(.semibold))
                Text(NutritionMath.formatMacro(ingredient.grams, unit: "g"))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(NutritionMath.formatMacro(totals.kcal, unit: "kcal"))
                    .font(.caption.weight(.semibold))
                Text("\(NutritionMath.formatMacro(totals.protein, unit: "g")) protein · "
                    + "\(NutritionMath.formatMacro(totals.carbs, unit: "g")) carbs · "
                    + "\(NutritionMath.formatMacro(totals.fat, unit: "g")) fat")
                    .font(.caption2)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(12)
    }
}

