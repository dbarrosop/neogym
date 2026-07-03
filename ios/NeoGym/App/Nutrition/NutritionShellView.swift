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

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
        .navigationTitle(selection.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            rootSectionToolbar
            rootActionToolbar
        }
    }

    @ToolbarContentBuilder
    private var rootSectionToolbar: some ToolbarContent {
        if path.isEmpty {
            ToolbarItem(placement: .principal) {
                SectionTitleMenu(selection: $selection)
            }
        }
    }

    @ToolbarContentBuilder
    private var rootActionToolbar: some ToolbarContent {
        if path.isEmpty, selection == .plans {
            RootPrimaryActionToolbar(
                title: "New plan",
                systemImage: "plus",
                action: openPlanCreate
            )
        }
        if path.isEmpty, selection == .foods {
            RootPrimaryActionToolbar(
                title: "New food",
                systemImage: "plus",
                action: openFoodCreate
            )
        }
        if path.isEmpty, selection == .meals {
            RootPrimaryActionToolbar(
                title: "New meal",
                systemImage: "plus",
                action: openMealCreate
            )
        }
    }

    @ViewBuilder
    private func sectionPage(for section: NutritionSection) -> some View {
        switch section {
        case .overview:
            NutritionOverviewView(
                repository: repository,
                openSection: { section in
                    setSection(section)
                    if section != .days { selectedDate = nil }
                },
                openDay: { date in
                    selectedDate = date
                    setSection(.days)
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

    private func openPlanCreate() {
        path.append(.planCreate)
    }

    private func openFoodCreate() {
        path.append(.foodCreate)
    }

    private func openMealCreate() {
        path.append(.mealCreate)
    }

    private func openRoute(_ route: NutritionRoute) {
        path.append(route)
    }

    private func openRouteAfterCurrentTransition(_ route: NutritionRoute) {
        DispatchQueue.main.async {
            path = [route]
        }
    }

    private var sectionTransitionAnimation: Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.24)
    }

    private func setSection(_ section: NutritionSection) {
        withAnimation(sectionTransitionAnimation) {
            selection = section
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
