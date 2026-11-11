import NeoGymKit
import SwiftUI

/// Presentation shared by Energy, Overview and today's intake, not historical charts.
struct DailyEnergyProjectionView: View {
    let projection: DailyEnergyProjection
    @Environment(\.locale) private var locale

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], alignment: .leading, spacing: 10) {
                metric("Estimated burned today", projection.burnedValue(locale: locale))
                metric("Estimated net today", projection.netValue(locale: locale))
            }
            Text(projection.basisDescription + " " + DailyEnergyProjection.explanation)
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundColor(NeoGymTheme.mutedText)
            Text(value).font(.subheadline.weight(.semibold)).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12)
    }
}

struct TodayEnergyEstimateSection: View {
    @StateObject private var viewModel: NutritionDaysListViewModel
    @Environment(\.scenePhase) private var scenePhase
    let refreshToken: Int

    init(repository: any NutritionFoodMealRepositoryProtocol, refreshToken: Int) {
        _viewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: repository))
        self.refreshToken = refreshToken
    }

    var body: some View {
        SectionShell(title: "Estimated today") {
            if let projection = viewModel.energyBalanceOverviewSummary().projection {
                DailyEnergyProjectionView(projection: projection)
            } else if viewModel.state.isLoading {
                AppLoadingStateView(message: "Loading estimate…")
            } else if let message = viewModel.state.errorMessage {
                AppErrorStateView(title: "Could not load estimate", message: message) {
                    Task { await viewModel.load() }
                }
            } else {
                Text("Needs today's energy and resting energy from at least one of the previous 7 days.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        }
        .task(id: refreshToken) { await viewModel.load() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await viewModel.load() } }
        }
    }
}
