import NeoGymKit
import SwiftUI
import WidgetKit

/// Nutrition tab: Log · Plans · Foods · Meals. Log opens today's day; its
/// date controls replace the old Days list, and Today replaces Overview.
struct NutritionNavigationView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let currentUserId: String?
    @Binding var path: [NutritionRoute]
    @Binding var section: NutritionSection
    @Binding var logDate: NutritionLogDateSelection
    /// Bumped by the shell when another tab logged nutrition.
    let nutritionRevision: Int
    let onNutritionMutated: () -> Void

    @State private var reloadToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            sectionContent
                .environment(\.areaSectionHeader, AnyView(AreaSectionPicker(label: "Nutrition sections", selection: $section)))
                .areaRoot(title: "Nutrition")
                .toolbar { primaryAction }
                .navigationDestination(for: NutritionRoute.self) { route in
                    routeDestination(for: route)
                        .screenBackground()
                }
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .log:
            DailyIntakeView(
                repository: repository,
                date: logDate.date,
                reloadToken: reloadToken + nutritionRevision,
                onDateSelected: { logDate.select($0) },
                onMutated: invalidateLists
            )
            // A new day gets its own model and sheets, so an older in-flight
            // read cannot supply a day ID to the newly selected date's writes.
            .id(logDate.date)
        case .plans:
            PlansListView(repository: repository, reloadToken: reloadToken)
        case .foods:
            FoodsListView(repository: repository, currentUserId: currentUserId, reloadToken: reloadToken)
        case .meals:
            MealsListView(repository: repository, reloadToken: reloadToken)
        }
    }

    @ToolbarContentBuilder
    private var primaryAction: some ToolbarContent {
        switch section {
        case .log:
            // The day view owns its log sheet and adds its own `+`.
            ToolbarItem(placement: .topBarTrailing) { EmptyView() }
        case .plans:
            AreaPrimaryAction(title: "New plan") { path.append(.planCreate) }
        case .foods:
            AreaPrimaryAction(title: "New food") { path.append(.foodCreate) }
        case .meals:
            AreaPrimaryAction(title: "New meal") { path.append(.mealCreate) }
        }
    }

    @ViewBuilder
    private func routeDestination(for route: NutritionRoute) -> some View {
        switch route {
        case let .planDetail(planId):
            NutritionPlanDetailView(
                planId: planId,
                repository: repository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .planCreate:
            NutritionPlanCreateView(
                repository: repository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.planDetail(id))
                },
                onFinished: invalidateLists
            )
        case let .foodDetail(foodId):
            FoodDetailView(
                foodId: foodId,
                repository: repository,
                currentUserId: currentUserId,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .foodCreate:
            FoodCreateView(
                repository: repository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.foodDetail(id))
                },
                onFinished: invalidateLists
            )
        case let .mealDetail(mealId):
            MealDetailView(
                mealId: mealId,
                repository: repository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .mealCreate:
            MealCreateView(
                repository: repository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.mealDetail(id))
                },
                onFinished: invalidateLists
            )
        }
    }

    private func openRouteAfterCurrentTransition(_ route: NutritionRoute) {
        // The create view calls `dismiss()` right after `onCreated`, which pops the
        // create route synchronously; deferring the append to the next runloop tick
        // lands the new detail above the section root (Back returns to the list).
        DispatchQueue.main.async {
            path.append(route)
        }
    }

    private func invalidateLists() {
        reloadToken += 1
        onNutritionMutated()
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
    }
}
