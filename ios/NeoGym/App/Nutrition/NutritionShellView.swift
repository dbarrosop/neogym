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

    var body: some View {
        NavigationView {
            sectionPages
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        SecondarySectionBar(selection: $selection)
                    }
                }
        }
        .navigationViewStyle(.stack)
    }

    @ViewBuilder
    private var sectionPages: some View {
        switch selection {
        case .overview:
            NutritionOverviewView(
                repository: repository,
                openSection: { section in
                    selection = section
                    if section != .days { selectedDate = nil }
                },
                openDay: { date in
                    selectedDate = date
                    selection = .days
                }
            )
        case .days:
            NutritionDaysView(repository: repository, selectedDate: $selectedDate)
        case .plans:
            PlansListView(repository: repository)
        case .foods:
            FoodsListView(repository: repository, currentUserId: currentUserId)
        case .meals:
            MealsListView(repository: repository)
        }
    }
}

private struct NutritionPlaceholderView: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        ScrollView {
            SectionShell(title: title, subtitle: "Nutrition") {
                AppEmptyStateView(title: "Coming next", message: message, systemImage: systemImage)
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, 20)
            .padding(.vertical, 40)
            .frame(maxWidth: .infinity)
        }
    }
}

#Preview("Nutrition") {
    NutritionNavigationView(repository: PreviewNutritionFoodMealRepository(), currentUserId: "user-1")
}
