import NeoGymKit
import SwiftUI

struct WorkoutsNavigationView: View {
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    var onSessionStarted: (String) -> Void

    var body: some View {
        NavigationView {
            WorkoutsListView(
                workoutsRepository: workoutsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                currentUserId: currentUserId,
                onSessionStarted: onSessionStarted
            )
        }
        .navigationViewStyle(.stack)
    }
}

struct WorkoutsListView: View {
    @StateObject private var viewModel: WorkoutsListViewModel
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    var onSessionStarted: (String) -> Void

    init(
        workoutsRepository: any WorkoutsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        currentUserId: String?,
        onSessionStarted: @escaping (String) -> Void
    ) {
        _viewModel = StateObject(wrappedValue: WorkoutsListViewModel(repository: workoutsRepository))
        self.workoutsRepository = workoutsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.currentUserId = currentUserId
        self.onSessionStarted = onSessionStarted
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                filters
                results
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding + NeoGymTheme.dockRootContentClearance)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Workouts")
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingMD) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Plans")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text("Workouts")
                    .font(.largeTitle.bold())
                    .tracking(-0.8)
                Text("Your routines and shared community templates.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer(minLength: 0)
            NavigationLink {
                WorkoutCreateView(
                    workoutsRepository: workoutsRepository,
                    exercisesRepository: exercisesRepository,
                    onFinished: { Task { await viewModel.load() } }
                )
            } label: {
                HeaderActionButtonLabel()
            }
            .accessibilityLabel("New workout")
        }
    }

    private var filters: some View {
        GlassPanel(
            cornerRadius: NeoGymTheme.radiusXL,
            material: .thin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false,
            contentPadding: EdgeInsets(
                top: NeoGymTheme.spacingMD,
                leading: NeoGymTheme.spacingMD,
                bottom: NeoGymTheme.spacingMD,
                trailing: NeoGymTheme.spacingMD
            )
        ) {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                HStack(spacing: NeoGymTheme.spacingXS) {
                    Text("Filter")
                        .font(.caption.weight(.bold))
                        .textCase(.uppercase)
                        .foregroundColor(NeoGymTheme.mutedText)
                    WorkoutFilterPill(
                        title: "Mine",
                        systemImage: "person",
                        active: viewModel.visibility == .mine
                    ) { viewModel.toggleVisibility(.mine) }
                    WorkoutFilterPill(
                        title: "Public",
                        systemImage: "globe",
                        active: viewModel.visibility == .public
                    ) { viewModel.toggleVisibility(.public) }
                    if viewModel.isFiltered {
                        Button("Clear") { viewModel.clearFilters() }
                            .font(.caption.weight(.semibold))
                    }
                }
                if !viewModel.labels.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: NeoGymTheme.spacingXS) {
                            ForEach(viewModel.labels) { label in
                                WorkoutFilterPill(
                                    title: label.name,
                                    systemImage: "tag",
                                    active: viewModel.selectedLabelIds.contains(label.id)
                                ) { viewModel.toggleLabel(label.id) }
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var results: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading workouts") {
                AppLoadingStateView(title: "Loading workouts")
            }
        case .loading where viewModel.workouts.isEmpty:
            SectionShell(title: "Loading workouts") {
                AppLoadingStateView(title: "Loading workouts")
            }
        case let .failed(message, _) where viewModel.workouts.isEmpty:
            SectionShell(title: "Workouts") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.filteredWorkouts.isEmpty {
                SectionShell(title: "No workouts") {
                    AppEmptyStateView(
                        title: viewModel.isFiltered ? "No workouts match these filters" : "No workouts yet",
                        message: viewModel.isFiltered
                            ? "Clear filters to see all available routines."
                            : "Create your first workout template to get started.",
                        systemImage: "figure.strengthtraining.traditional"
                    )
                }
            } else {
                SectionShell(title: "Routines", subtitle: "\(viewModel.filteredWorkouts.count) shown") {
                    VStack(spacing: 0) {
                        ForEach(viewModel.filteredWorkouts) { workout in
                            NavigationLink {
                                WorkoutDetailView(
                                    workoutId: workout.id,
                                    workoutsRepository: workoutsRepository,
                                    exercisesRepository: exercisesRepository,
                                    storageBaseURL: storageBaseURL,
                                    currentUserId: currentUserId,
                                    onSessionStarted: onSessionStarted,
                                    onDeleted: { Task { await viewModel.load() } }
                                )
                            } label: {
                                WorkoutListRow(workout: workout)
                            }
                            if workout.id != viewModel.filteredWorkouts.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }
}

private struct WorkoutListRow: View {
    let workout: WorkoutListItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: workout.isPublic ? "globe" : "person")
                .foregroundColor(workout.isPublic ? .accentColor : NeoGymTheme.mutedText)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(workout.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)
                    if workout.isPublic {
                        Text("Public")
                            .font(.caption2.weight(.bold))
                            .foregroundColor(.accentColor)
                    }
                }
                if let description = workout.description, !description.isEmpty {
                    Text(MarkdownRendering.stripMarkdown(description))
                        .lineLimit(1)
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                HStack(spacing: 6) {
                    Text("\(workout.exerciseCount) exercise\(workout.exerciseCount == 1 ? "" : "s")")
                    ForEach(workout.workoutLabels.prefix(3)) { label in
                        Text("#\(label.label.name)")
                    }
                }
                .font(.caption2.weight(.medium))
                .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.vertical, 10)
    }
}

private struct WorkoutFilterPill: View {
    let title: String
    let systemImage: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .frame(minHeight: 44)
                .foregroundColor(active ? .white : NeoGymTheme.primaryText)
                .background(pillBackground)
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityValue(active ? "Selected" : "")
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    @ViewBuilder
    private var pillBackground: some View {
        if active {
            Capsule(style: .continuous)
                .fill(NeoGymTheme.primaryActionGradient)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.32), lineWidth: NeoGymTheme.hairline)
                )
        } else {
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(Capsule(style: .continuous).fill(NeoGymTheme.glassSubtleFill))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
        }
    }
}

#Preview("Workouts") {
    ScreenScaffold {
        WorkoutsNavigationView(
            workoutsRepository: PreviewWorkoutsRepository(),
            exercisesRepository: PreviewExercisesRepository(),
            storageBaseURL: URL(string: "https://storage.example.test")!,
            currentUserId: "user-1",
            onSessionStarted: { _ in }
        )
    }
}
