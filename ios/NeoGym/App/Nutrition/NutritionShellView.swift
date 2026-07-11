import NeoGymKit
import SwiftUI

enum NutritionSection: String, CaseIterable, Identifiable {
    case overview
    case days
    case plans
    case foods
    case meals
    case body
    case energy

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: "Overview"
        case .days: "Days"
        case .plans: "Plans"
        case .foods: "Foods"
        case .meals: "Meals"
        case .body: "Body"
        case .energy: "Energy"
        }
    }

    var systemImage: String? {
        switch self {
        case .overview: "chart.pie"
        case .days: "calendar"
        case .plans: "list.bullet.rectangle.portrait"
        case .foods: "carrot"
        case .meals: "fork.knife"
        case .body: "scalemass"
        case .energy: "flame"
        }
    }
}

struct NutritionNavigationView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let bodyRepository: any BodyMeasurementsRepositoryProtocol
    let bodyHealthImporter: (any BodyMeasurementsHealthImporting)?
    let energyRepository: any DailyEnergyRepositoryProtocol
    let energyHealthImporter: (any DailyEnergyHealthImporting)?
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
        case .body: .bodyList
        case .energy: .energyList
        }
    }

    @ViewBuilder
    private func routeDestination(for route: NutritionRoute) -> some View {
        switch route {
        case .overview, .daysList, .plansList, .foodsList, .mealsList, .bodyList, .energyList:
            subsectionListDestination(for: route)
        case let .day(date):
            DailyIntakeView(repository: repository, date: date, onClose: popRoute, onMutated: invalidateLists)
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
        case let .bodyMeasurementDetail(measurementId):
            BodyMeasurementDetailView(
                measurementId: measurementId,
                repository: bodyRepository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .bodyMeasurementCreate:
            BodyMeasurementCreateView(
                repository: bodyRepository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.bodyMeasurementDetail(id))
                },
                onFinished: invalidateLists
            )
        case let .energyDetail(entryId):
            dailyEnergyDetailDestination(entryId: entryId)
        case .energyCreate:
            dailyEnergyCreateDestination()
        }
    }

    @ViewBuilder
    private func subsectionListDestination(for route: NutritionRoute) -> some View {
        switch route {
        case .overview:
            NutritionOverviewView(
                repository: repository,
                bodyRepository: bodyRepository,
                bodyHealthImporter: bodyHealthImporter,
                energyRepository: energyRepository,
                energyHealthImporter: energyHealthImporter
            )
            .navigationTitle("Overview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { openTodayToolbar }
        case .daysList:
            NutritionDaysView(
                repository: repository,
                reloadToken: reloadToken
            )
            .navigationTitle("Days")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { openTodayToolbar }
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
        case .bodyList:
            BodyMeasurementsListView(
                repository: bodyRepository,
                healthImporter: bodyHealthImporter,
                reloadToken: reloadToken
            )
            .navigationTitle("Body")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                RootPrimaryActionToolbar(
                    title: "Log measurement",
                    systemImage: "plus",
                    action: openBodyMeasurementCreate
                )
            }
        case .energyList:
            dailyEnergyListDestination()
        case .day, .planDetail, .planCreate, .foodDetail, .foodCreate, .mealDetail, .mealCreate,
             .bodyMeasurementDetail, .bodyMeasurementCreate, .energyDetail, .energyCreate:
            EmptyView()
        }
    }

    @ToolbarContentBuilder
    private var openTodayToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                path.append(.day(IntakeGrouping.formatLocalDate()))
            } label: {
                Label("Open today", systemImage: "calendar.badge.plus")
            }
            .accessibilityLabel("Open today")
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

    private func dailyEnergyListDestination() -> some View {
        DailyEnergyListView(
            repository: energyRepository,
            healthImporter: energyHealthImporter,
            reloadToken: reloadToken
        )
        .navigationTitle("Energy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            RootPrimaryActionToolbar(
                title: "Log energy",
                systemImage: "plus",
                action: openDailyEnergyCreate
            )
        }
    }

    private func dailyEnergyDetailDestination(entryId: String) -> some View {
        DailyEnergyDetailView(
            entryId: entryId,
            repository: energyRepository,
            onDeleted: invalidateLists,
            onMutated: invalidateLists
        )
    }

    private func dailyEnergyCreateDestination() -> some View {
        DailyEnergyCreateView(
            repository: energyRepository,
            onCreated: { id in
                invalidateLists()
                openRouteAfterCurrentTransition(.energyDetail(id))
            },
            onFinished: invalidateLists
        )
    }

    private func openBodyMeasurementCreate() {
        path.append(.bodyMeasurementCreate)
    }

    private func openDailyEnergyCreate() {
        path.append(.energyCreate)
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
    let environment = NhostClientFactory.makeEnvironment()
    NutritionNavigationView(
        repository: PreviewNutritionFoodMealRepository(),
        bodyRepository: BodyMeasurementsRepository(graphQL: environment.graphQLService),
        bodyHealthImporter: nil,
        energyRepository: DailyEnergyRepository(graphQL: environment.graphQLService),
        energyHealthImporter: nil,
        currentUserId: "user-1",
        areaSelection: .constant(.nutrition)
    )
}
