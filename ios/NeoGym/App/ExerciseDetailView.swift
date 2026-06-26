import NeoGymKit
import SwiftUI

struct ExerciseDetailView: View {
    @StateObject private var viewModel: ExerciseDetailViewModel
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    @State private var selectedTab = ExerciseDetailTab.progress
    @State private var startedSessionId: String?

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
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .navigationTitle(viewModel.exercise?.name ?? "Exercise")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .refreshable { await viewModel.load() }
        .alert(
            "Session started",
            isPresented: Binding(get: { startedSessionId != nil }, set: { if !$0 { startedSessionId = nil } })
        ) {
            Button("View Sessions") {
                if let startedSessionId {
                    onSessionStarted(startedSessionId)
                }
                startedSessionId = nil
            }
            Button("Stay here", role: .cancel) { startedSessionId = nil }
        } message: {
            Text("Your ad-hoc session was created. Open it now or keep browsing this exercise.")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading where viewModel.exercise == nil:
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
                    isStarting: viewModel.startState.isLoading,
                    startError: viewModel.startState.errorMessage
                ) {
                    Task {
                        if let id = await viewModel.startAdHocSession() {
                            startedSessionId = id
                        }
                    }
                }
                Picker("Detail", selection: $selectedTab) {
                    Text("Progress").tag(ExerciseDetailTab.progress)
                    Text("History").tag(ExerciseDetailTab.history)
                }
                .pickerStyle(.segmented)
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
}

private enum ExerciseDetailTab {
    case progress
    case history
}
