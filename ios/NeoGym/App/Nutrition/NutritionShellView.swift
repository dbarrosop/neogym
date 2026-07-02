import NeoGymKit
import SwiftUI

enum NutritionSection: String, CaseIterable, Identifiable, SecondaryTabSection {
    case overview
    case days
    case plans
    case foods
    case meals

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: "Overview"
        case .days: "Days"
        case .plans: "Plans"
        case .foods: "Foods"
        case .meals: "Meals"
        }
    }

    var systemImage: String? {
        switch self {
        case .overview: "chart.pie"
        case .days: "calendar"
        case .plans: "list.bullet.rectangle.portrait"
        case .foods: "carrot"
        case .meals: "fork.knife"
        }
    }
}

struct NutritionNavigationView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let currentUserId: String?

    @State private var selection: NutritionSection = .overview
    @State private var selectedDate: String?
    @State private var path: [NutritionRoute] = []
    @State private var reloadToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            rootContent
                .navigationDestination(for: NutritionRoute.self) { route in
                    routeDestination(for: route)
                }
        }
    }

    private var rootContent: some View {
        SecondarySectionContentHost(selection: $selection) { section in
            sectionPage(for: section)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if path.isEmpty {
                ToolbarItem(placement: .principal) {
                    SecondarySectionBar(selection: $selection)
                }
            }
        }
    }

    @ViewBuilder
    private func sectionPage(for section: NutritionSection) -> some View {
        switch section {
        case .overview:
            NutritionOverviewView(
                repository: repository,
                openSection: { section in
                    withAnimation(.easeInOut(duration: 0.28)) {
                        selection = section
                    }
                    if section != .days { selectedDate = nil }
                },
                openDay: { date in
                    selectedDate = date
                    withAnimation(.easeInOut(duration: 0.28)) {
                        selection = .days
                    }
                }
            )
        case .days:
            NutritionDaysView(
                repository: repository,
                selectedDate: $selectedDate,
                reloadToken: reloadToken,
                openRoute: openRoute
            )
        case .plans:
            PlansListView(repository: repository, reloadToken: reloadToken)
        case .foods:
            FoodsListView(
                repository: repository,
                currentUserId: currentUserId,
                reloadToken: reloadToken
            )
        case .meals:
            MealsListView(repository: repository, reloadToken: reloadToken)
        }
    }

    @ViewBuilder
    private func routeDestination(for route: NutritionRoute) -> some View {
        switch route {
        case let .day(date):
            DailyIntakeView(repository: repository, date: date) {
                popRoute()
                invalidateLists()
            }
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

    private func openRoute(_ route: NutritionRoute) {
        path.append(route)
    }

    private func openRouteAfterCurrentTransition(_ route: NutritionRoute) {
        DispatchQueue.main.async {
            path = [route]
        }
    }

    private func popRoute() {
        if !path.isEmpty { path.removeLast() }
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}

#Preview("Nutrition") {
    NutritionNavigationView(repository: PreviewNutritionFoodMealRepository(), currentUserId: "user-1")
}
