import NeoGymKit
import SwiftUI

struct DailyEnergyDetailView: View {
    @StateObject private var viewModel: DailyEnergyDetailViewModel
    let repository: any DailyEnergyRepositoryProtocol
    let nutritionRepository: any NutritionFoodMealRepositoryProtocol
    @State private var estimateRefreshToken = 0
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        entryId: String,
        repository: any DailyEnergyRepositoryProtocol,
        nutritionRepository: any NutritionFoodMealRepositoryProtocol,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: DailyEnergyDetailViewModel(
            entryId: entryId,
            repository: repository
        ))
        self.repository = repository
        self.nutritionRepository = nutritionRepository
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                content
                if viewModel.entry?.energyOn == DateOnly.todayLocalISO() {
                    TodayEnergyEstimateSection(repository: nutritionRepository, refreshToken: estimateRefreshToken)
                }
            }
                .frame(maxWidth: 640)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.screenVerticalPadding)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle("Energy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Spacer()
                if let entry = viewModel.entry {
                    NavigationLink {
                        DailyEnergyEditView(
                            entryId: entry.id,
                            repository: repository,
                            onSaved: {
                                onMutated()
                                Task { await load() }
                            },
                            onDeleted: {
                                onDeleted()
                                presentationMode.wrappedValue.dismiss()
                            }
                        )
                    } label: {
                        Label("Edit energy", systemImage: "pencil")
                    }
                }
            }
        }
        .task {
            if case .idle = viewModel.state {
                await load()
            }
        }
        .refreshable { await load() }
    }

    private func load() async {
        await viewModel.load()
        estimateRefreshToken += 1
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading energy") {
                AppLoadingStateView(title: "Loading energy entry")
            }
        case .loading where viewModel.entry == nil:
            SectionShell(title: "Loading energy") {
                AppLoadingStateView(title: "Loading energy entry")
            }
        case let .failed(message, _) where viewModel.entry == nil:
            SectionShell(title: "Energy") {
                AppErrorStateView(title: "Failed to load energy entry", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let entry = viewModel.entry {
                SectionShell(title: DateOnly.formatLong(entry.energyOn), subtitle: "Energy") {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(spacing: 12) {
                            DailyEnergyStatCard(
                                label: "Active",
                                value: DailyEnergyFormatters.kcal(entry.activeKcal)
                            )
                            DailyEnergyStatCard(
                                label: "Resting",
                                value: DailyEnergyFormatters.kcal(entry.restingKcal)
                            )
                        }
                        if let notes = entry.notes, !notes.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Notes")
                                    .font(.caption.weight(.bold))
                                    .textCase(.uppercase)
                                    .foregroundColor(NeoGymTheme.mutedText)
                                Text(notes)
                                    .font(.body)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct DailyEnergyStatCard: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingMD)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }
}
