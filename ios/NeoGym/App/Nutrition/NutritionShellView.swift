import NeoGymKit
import SwiftUI

enum NutritionSection: String, CaseIterable, Identifiable {
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
    @Binding var areaSelection: AppDestination

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
        List {
            ForEach(NutritionSection.allCases) { section in
                Button {
                    path.append(subsectionRoute(for: section))
                } label: {
                    NutritionHubRow(section: section)
                }
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets(
                    top: NeoGymTheme.spacingXS,
                    leading: NeoGymTheme.screenHorizontalPadding,
                    bottom: NeoGymTheme.spacingXS,
                    trailing: NeoGymTheme.screenHorizontalPadding
                ))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .accessibilityLabel(section.title)
                .accessibilityHint("Opens \(section.title)")
                .accessibilityAddTraits(.isButton)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .navigationTitle("Nutrition")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Area", selection: $areaSelection) {
                    ForEach(AppDestination.allCases) { destination in
                        Text(destination.title).tag(destination)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Primary area")
            }
        }
    }

    private func subsectionRoute(for section: NutritionSection) -> NutritionRoute {
        switch section {
        case .overview: .overview
        case .days: .daysList
        case .plans: .plansList
        case .foods: .foodsList
        case .meals: .mealsList
        }
    }

    @ViewBuilder
    private func routeDestination(for route: NutritionRoute) -> some View {
        switch route {
        case .overview, .daysList, .plansList, .foodsList, .mealsList:
            subsectionListDestination(for: route)
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

    @ViewBuilder
    private func subsectionListDestination(for route: NutritionRoute) -> some View {
        switch route {
        case .overview:
            NutritionOverviewView(
                repository: repository,
                openSection: { section in
                    path.append(subsectionRoute(for: section))
                },
                openDay: { date in
                    path.append(.day(date))
                }
            )
            .navigationTitle("Overview")
            .navigationBarTitleDisplayMode(.inline)
        case .daysList:
            NutritionDaysView(
                repository: repository,
                reloadToken: reloadToken,
                openRoute: openRoute
            )
            .navigationTitle("Days")
            .navigationBarTitleDisplayMode(.inline)
        case .plansList:
            PlansListView(repository: repository, reloadToken: reloadToken)
                .navigationTitle("Plans")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    RootPrimaryActionToolbar(
                        title: "New plan",
                        systemImage: "plus",
                        action: openPlanCreate
                    )
                }
        case .foodsList:
            FoodsListView(
                repository: repository,
                currentUserId: currentUserId,
                reloadToken: reloadToken
            )
            .navigationTitle("Foods")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                RootPrimaryActionToolbar(
                    title: "New food",
                    systemImage: "plus",
                    action: openFoodCreate
                )
            }
        case .mealsList:
            MealsListView(repository: repository, reloadToken: reloadToken)
                .navigationTitle("Meals")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    RootPrimaryActionToolbar(
                        title: "New meal",
                        systemImage: "plus",
                        action: openMealCreate
                    )
                }
        case .day, .planDetail, .planCreate, .foodDetail, .foodCreate, .mealDetail, .mealCreate:
            EmptyView()
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
        // The create view calls `dismiss()` right after `onCreated`, which pops the
        // create route synchronously; deferring the append to the next runloop tick
        // lands the new detail above its subsection list (Back returns to the list).
        DispatchQueue.main.async {
            path.append(route)
        }
    }

    private func popRoute() {
        if !path.isEmpty { path.removeLast() }
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}

private struct NutritionHubRow: View {
    let section: NutritionSection

    var body: some View {
        GlassPanel(
            contentPadding: EdgeInsets(
                top: NeoGymTheme.spacingMD,
                leading: NeoGymTheme.spacingLG,
                bottom: NeoGymTheme.spacingMD,
                trailing: NeoGymTheme.spacingLG
            )
        ) {
            HStack(spacing: NeoGymTheme.spacingMD) {
                Image(systemName: section.systemImage ?? "circle")
                    .font(.title3)
                    .foregroundStyle(NeoGymTheme.accent)
                    .frame(width: 32)
                Text(section.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.primaryText)
                Spacer(minLength: NeoGymTheme.spacingSM)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.mutedText)
            }
            .frame(minHeight: 44)
        }
    }
}

#Preview("Nutrition") {
    NutritionNavigationView(
        repository: PreviewNutritionFoodMealRepository(),
        currentUserId: "user-1",
        areaSelection: .constant(.nutrition)
    )
}
