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
                NutritionSecondaryBar(selection: $selection)
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Nutrition")
            .navigationBarTitleDisplayMode(.inline)
        }
        .navigationViewStyle(.stack)
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

private struct NutritionSecondaryBar: View {
    @Binding var selection: NutritionSection

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                ForEach(NutritionSection.allCases) { section in
                    NutritionSecondaryBarItem(
                        section: section,
                        isSelected: selection == section
                    ) {
                        selection = section
                    }
                }
            }
            .padding(NeoGymTheme.spacingXS)
        }
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusXL,
            material: .thin,
            tint: NeoGymTheme.glassFill,
            stroke: NeoGymTheme.glassStroke,
            shadow: true
        )
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.top, NeoGymTheme.spacingSM)
        .padding(.bottom, NeoGymTheme.spacingXS)
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .accessibilityElement(children: .contain)
    }
}

private struct NutritionSecondaryBarItem: View {
    let section: NutritionSection
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(section.title, systemImage: section.icon)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .foregroundColor(isSelected ? .white : NeoGymTheme.primaryText)
                .padding(.horizontal, NeoGymTheme.spacingSM)
                .padding(.vertical, NeoGymTheme.spacingXS)
                .frame(minWidth: 88, minHeight: 44)
                .background(itemBackground)
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(section.title)
        .accessibilityValue(isSelected ? "Selected" : "")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var itemBackground: some View {
        if isSelected {
            Capsule(style: .continuous)
                .fill(NeoGymTheme.primaryActionGradient)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.32), lineWidth: NeoGymTheme.hairline)
                )
        } else {
            Capsule(style: .continuous)
                .fill(Color.clear)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
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
