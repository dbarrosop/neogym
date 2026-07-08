import NeoGymKit
import SwiftUI

struct DailyEnergyNavigationView: View {
    let repository: any DailyEnergyRepositoryProtocol
    let healthImporter: (any DailyEnergyHealthImporting)?

    init(
        repository: any DailyEnergyRepositoryProtocol,
        healthImporter: (any DailyEnergyHealthImporting)? = nil
    ) {
        self.repository = repository
        self.healthImporter = healthImporter
    }

    var body: some View {
        NavigationView {
            DailyEnergyListView(repository: repository, healthImporter: healthImporter)
        }
        .navigationViewStyle(.stack)
    }
}

struct DailyEnergyListView: View {
    @StateObject private var viewModel: DailyEnergyListViewModel
    let repository: any DailyEnergyRepositoryProtocol
    let healthImporter: (any DailyEnergyHealthImporting)?

    @State private var navigatedEntryId: String?
    @State private var isNavigatingToEntry = false

    init(
        repository: any DailyEnergyRepositoryProtocol,
        healthImporter: (any DailyEnergyHealthImporting)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: DailyEnergyListViewModel(
            repository: repository,
            healthImporter: healthImporter
        ))
        self.repository = repository
        self.healthImporter = healthImporter
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding + NeoGymTheme.dockRootContentClearance)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Energy")
        .background(pendingNavigationLink)
        .task {
            if case .idle = viewModel.state {
                await viewModel.load(shouldSyncHealthEnergy: true)
            }
        }
        .refreshable { await viewModel.load(shouldSyncHealthEnergy: true) }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingMD) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Tracking")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text("Energy")
                    .font(.largeTitle.bold())
                    .tracking(-0.8)
                Text("Log active and resting calories burned over time.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer(minLength: 0)
            NavigationLink {
                DailyEnergyCreateView(
                    repository: repository,
                    onCreated: { id in
                        Task { await viewModel.load() }
                        navigatedEntryId = id
                        isNavigatingToEntry = true
                    },
                    onFinished: { Task { await viewModel.load() } }
                )
            } label: {
                HeaderActionButtonLabel()
            }
            .accessibilityLabel("New energy entry")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading energy") {
                AppLoadingStateView(title: "Loading energy entries")
            }
        case .loading where viewModel.entries.isEmpty:
            SectionShell(title: "Loading energy") {
                AppLoadingStateView(title: "Loading energy entries")
            }
        case let .failed(message, _) where viewModel.entries.isEmpty:
            SectionShell(title: "Energy") {
                AppErrorStateView(title: "Failed to load energy entries", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.entries.isEmpty {
                SectionShell(title: "No energy entries") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: "No energy entries yet",
                            message: "Log active or resting energy to start seeing trends.",
                            systemImage: "flame"
                        )
                        NavigationLink {
                            DailyEnergyCreateView(
                                repository: repository,
                                onCreated: { id in
                                    Task { await viewModel.load() }
                                    navigatedEntryId = id
                                    isNavigatingToEntry = true
                                },
                                onFinished: { Task { await viewModel.load() } }
                            )
                        } label: {
                            Label("Log your first energy entry", systemImage: "plus")
                        }
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                    }
                }
            } else {
                VStack(spacing: 14) {
                    healthSyncStatus
                    if viewModel.trendData.shouldShowChart {
                        SectionShell(title: "Energy over time", subtitle: "Trend") {
                            DailyEnergyTrendChartView(trendData: viewModel.trendData)
                        }
                    }
                    SectionShell(title: "Energy", subtitle: "Newest first") {
                        VStack(spacing: 0) {
                            ForEach(viewModel.entries) { entry in
                                NavigationLink {
                                    DailyEnergyDetailView(
                                        entryId: entry.id,
                                        repository: repository,
                                        onDeleted: { Task { await viewModel.load() } },
                                        onMutated: { Task { await viewModel.load() } }
                                    )
                                } label: {
                                    DailyEnergyListRow(entry: entry)
                                }
                                if entry.id != viewModel.entries.last?.id { Divider() }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var healthSyncStatus: some View {
        switch viewModel.healthSyncState {
        case let .failed(message, _):
            FeedbackBanner(message: message)
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var pendingNavigationLink: some View {
        if let entryId = navigatedEntryId {
            NavigationLink(
                destination: DailyEnergyDetailView(
                    entryId: entryId,
                    repository: repository,
                    onDeleted: { Task { await viewModel.load() } },
                    onMutated: { Task { await viewModel.load() } }
                ),
                isActive: $isNavigatingToEntry
            ) {
                EmptyView()
            }
            .hidden()
        }
    }
}

private struct DailyEnergyListRow: View {
    let entry: DailyEnergy

    var body: some View {
        HStack(spacing: 12) {
            DailyEnergyDateBadge(energyOn: entry.energyOn)
            VStack(alignment: .leading, spacing: 4) {
                Text(DateOnly.formatLong(entry.energyOn))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                Text(DailyEnergyFormatters.values(activeKcal: entry.activeKcal, restingKcal: entry.restingKcal))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                if let notes = entry.notes, !notes.isEmpty {
                    Text(notes)
                        .lineLimit(1)
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.vertical, 10)
    }
}

private struct DailyEnergyDateBadge: View {
    let energyOn: String

    var body: some View {
        VStack(spacing: 0) {
            Text(month)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(day)
                .font(.title3.weight(.bold))
                .foregroundColor(.primary)
        }
        .frame(width: 52, height: 52)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }

    private var date: Date? { DateOnly.parse(energyOn) }

    private var month: String {
        guard let date else { return "—" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter.string(from: date)
    }

    private var day: String {
        guard let date else { return "—" }
        return String(Calendar.current.component(.day, from: date))
    }
}
