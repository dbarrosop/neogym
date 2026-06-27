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

    var icon: String {
        switch self {
        case .overview: "chart.pie"
        case .days: "calendar"
        case .plans: "list.bullet.rectangle"
        case .foods: "apple.logo"
        case .meals: "fork.knife.circle"
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
            VStack(spacing: 0) {
                subNavigation
                Divider()
                content
            }
            .background(GridBackground())
            .navigationTitle("Nutrition")
            .navigationBarTitleDisplayMode(.inline)
        }
        .navigationViewStyle(.stack)
    }

    private var subNavigation: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NutritionSection.allCases) { section in
                    Button {
                        selection = section
                    } label: {
                        Label(section.title, systemImage: section.icon)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .foregroundColor(selection == section ? .white : .primary)
                            .background(
                                selection == section ? Color.accentColor : NeoGymTheme.cardFill,
                                in: Capsule(style: .continuous)
                            )
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(selection == section ? Color.clear : NeoGymTheme.border)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selection == section ? .isSelected : [])
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(.ultraThinMaterial)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .foods:
            FoodsListView(repository: repository, currentUserId: currentUserId)
        case .meals:
            MealsListView(repository: repository)
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
        .background(GridBackground())
    }
}

#Preview("Nutrition") {
    NutritionNavigationView(repository: PreviewNutritionFoodMealRepository(), currentUserId: "user-1")
}
