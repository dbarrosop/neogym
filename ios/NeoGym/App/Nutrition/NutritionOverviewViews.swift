import NeoGymKit
import SwiftUI

struct NutritionOverviewView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let openSection: (NutritionSection) -> Void
    let openDay: (String) -> Void

    @StateObject private var viewModel: NutritionDaysListViewModel

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        openSection: @escaping (NutritionSection) -> Void,
        openDay: @escaping (String) -> Void
    ) {
        self.repository = repository
        self.openSection = openSection
        self.openDay = openDay
        _viewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                SectionShell(
                    title: "Nutrition",
                    subtitle: "Dashboard"
                ) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Create foods, build meal and plan templates, then log what you actually ate on local calendar days.")
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.mutedText)
                        HStack(spacing: 10) {
                            Button {
                                openDay(IntakeGrouping.formatLocalDate())
                            } label: {
                                Label("Open today", systemImage: "calendar.badge.plus")
                            }
                            .buttonStyle(.borderedProminent)

                            Button {
                                openSection(.days)
                            } label: {
                                Label("Browse days", systemImage: "calendar")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }

                navigationCards
                recentDays
            }
            .frame(maxWidth: 720)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding + NeoGymTheme.dockRootContentClearance)
            .frame(maxWidth: .infinity)
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private var navigationCards: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            overviewCard(
                title: "Foods",
                message: "Private foods and public catalog macros per 100g.",
                systemImage: "apple.logo",
                section: .foods
            )
            overviewCard(
                title: "Meals",
                message: "Reusable templates with live food totals.",
                systemImage: "fork.knife.circle",
                section: .meals
            )
            overviewCard(
                title: "Plans",
                message: "Timed meal suggestions, not binding schedules.",
                systemImage: "list.bullet.rectangle",
                section: .plans
            )
            overviewCard(
                title: "Daily logs",
                message: "Snapshot-based intake history by local date.",
                systemImage: "calendar",
                section: .days
            )
        }
    }

    private func overviewCard(title: String, message: String, systemImage: String, section: NutritionSection) -> some View {
        Button {
            openSection(section)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: systemImage)
                    .font(.title2)
                    .foregroundColor(.accentColor)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                Text(message)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(3)
            }
            .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
            .padding(14)
            .nutritionGlassCard(cornerRadius: 16)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var recentDays: some View {
        SectionShell(title: "Recent daily logs", subtitle: "Snapshot totals") {
            switch viewModel.state {
            case .idle, .loading:
                AppLoadingStateView(message: "Loading daily logs…")
            case let .failed(message, _):
                AppErrorStateView(title: "Failed to load daily logs", message: message) { Task { await viewModel.load() } }
            case .loaded:
                if viewModel.days.isEmpty {
                    AppEmptyStateView(
                        title: "No logged days yet",
                        message: "Open today to start logging foods and meals.",
                        systemImage: "calendar.badge.plus"
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(viewModel.days.prefix(5)) { day in
                            Button {
                                openDay(day.logDate)
                            } label: {
                                NutritionDayRow(day: day)
                            }
                            .buttonStyle(.plain)
                            if day.id != viewModel.days.prefix(5).last?.id { Divider() }
                        }
                    }
                    .nutritionGlassCard(cornerRadius: 16)
                }
            }
        }
    }
}

struct NutritionDayRow: View {
    let day: NutritionDay

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "calendar")
                .foregroundColor(.accentColor)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 5) {
                Text(IntakeGrouping.formatLocalDateLabel(day.logDate))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("\(day.allLogEntries.count) logged entr\(day.allLogEntries.count == 1 ? "y" : "ies")"
                    + (day.nutritionPlan.map { " · Plan: \($0.name)" } ?? ""))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                MacroSummaryView(totals: day.loggedTotals, title: "", compact: true)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(12)
    }
}
