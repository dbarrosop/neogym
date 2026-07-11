import NeoGymKit
import SwiftUI

struct ExerciseDetailView: View {
    @StateObject private var viewModel: ExerciseDetailViewModel
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    @State private var selectedTab = ExerciseDetailTab.progress

    init(
        exerciseId: String,
        repository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        onSessionStarted: @escaping (String) -> Void
    ) {
        _viewModel = StateObject(wrappedValue: ExerciseDetailViewModel(exerciseId: exerciseId, repository: repository))
        self.storageBaseURL = storageBaseURL
        self.onSessionStarted = onSessionStarted
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                content
            }
            .frame(maxWidth: 700)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle(viewModel.exercise?.name ?? "Exercise")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Spacer()
                if viewModel.exercise != nil {
                    Button(action: startSession) {
                        Label(
                            viewModel.startState.isLoading ? "Starting…" : "Start session",
                            systemImage: "play.fill"
                        )
                    }
                    .fontWeight(.semibold)
                    .disabled(viewModel.startState.isLoading)
                }
            }
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading exercise") {
                AppLoadingStateView(title: "Loading exercise")
            }
        case .loading where viewModel.exercise == nil:
            SectionShell(title: "Loading exercise") {
                AppLoadingStateView(title: "Loading exercise")
            }
        case let .failed(message, _) where viewModel.exercise == nil:
            SectionShell(title: "Exercise") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let exercise = viewModel.exercise {
                ExerciseSummaryCard(
                    exercise: exercise,
                    storageBaseURL: storageBaseURL,
                    startError: viewModel.startState.errorMessage
                )
                GlassPanel(
                    cornerRadius: NeoGymTheme.radiusLG,
                    material: .thin,
                    tint: NeoGymTheme.glassSubtleFill,
                    shadow: false,
                    contentPadding: EdgeInsets(
                        top: NeoGymTheme.spacingSM,
                        leading: NeoGymTheme.spacingSM,
                        bottom: NeoGymTheme.spacingSM,
                        trailing: NeoGymTheme.spacingSM
                    )
                ) {
                    Picker("Detail", selection: $selectedTab) {
                        Text("Progress").tag(ExerciseDetailTab.progress)
                        Text("History").tag(ExerciseDetailTab.history)
                    }
                    .pickerStyle(.segmented)
                }
                detailTab
            }
        }
    }

    @ViewBuilder
    private var detailTab: some View {
        switch selectedTab {
        case .progress:
            if viewModel.exercise?.isCardio == true {
                if viewModel.isCardioSchemaMissing {
                    CardioSchemaMissingCard()
                } else if let primary = viewModel.primaryCardioMetric {
                    CardioProgressSummary(points: viewModel.cardioProgressPoints, primary: primary)
                }
            } else {
                StrengthProgressSummary(
                    points: viewModel.strengthProgressPoints,
                    doubleWeight: viewModel.exercise?.strength?.doubleWeight ?? false
                )
            }
        case .history:
            if viewModel.exercise?.isCardio == true {
                if viewModel.isCardioSchemaMissing {
                    CardioSchemaMissingCard()
                } else if let schema = viewModel.cardioMetricsSchema, let name = viewModel.exercise?.name {
                    CardioHistoryList(entries: viewModel.history, schema: schema, exerciseName: name)
                }
            } else if let name = viewModel.exercise?.name {
                StrengthHistoryList(
                    entries: viewModel.history,
                    doubleWeight: viewModel.exercise?.strength?.doubleWeight ?? false,
                    exerciseName: name
                )
            }
        }
    }

    private func startSession() {
        Task {
            if let id = await viewModel.startAdHocSession() {
                onSessionStarted(id)
            }
        }
    }
}

private enum ExerciseDetailTab {
    case progress
    case history
}
