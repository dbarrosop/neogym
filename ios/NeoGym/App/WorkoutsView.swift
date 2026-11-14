import NeoGymKit
import SwiftUI

struct WorkoutsListView: View {
    @StateObject private var viewModel: WorkoutsListViewModel
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let reloadToken: Int
    var onSessionStarted: (String) -> Void

    init(
        workoutsRepository: any WorkoutsRepositoryProtocol,
        reloadToken: Int,
        onSessionStarted: @escaping (String) -> Void
    ) {
        _viewModel = StateObject(wrappedValue: WorkoutsListViewModel(repository: workoutsRepository))
        self.workoutsRepository = workoutsRepository
        self.reloadToken = reloadToken
        self.onSessionStarted = onSessionStarted
    }

    @State private var startingWorkoutId: String?
    @State private var startError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                filters
                if let startError {
                    FeedbackBanner(message: startError)
                }
                results
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task { await viewModel.load() }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                FilterChip(title: "All", isSelected: !viewModel.isFiltered) { viewModel.clearFilters() }
                FilterChip(title: "Mine", isSelected: viewModel.visibility == .mine) { viewModel.toggleVisibility(.mine) }
                FilterChip(title: "Public", isSelected: viewModel.visibility == .public) { viewModel.toggleVisibility(.public) }
                ForEach(viewModel.labels) { label in
                    FilterChip(title: label.name, isSelected: viewModel.selectedLabelIds.contains(label.id)) {
                        viewModel.toggleLabel(label.id)
                    }
                }
            }
        }
        .accessibilityLabel("Filter workouts")
    }

    @ViewBuilder
    private var results: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading workouts")
        case .loading where viewModel.workouts.isEmpty:
            AppLoadingStateView(title: "Loading workouts")
        case let .failed(message, _) where viewModel.workouts.isEmpty:
            AppErrorStateView(title: "Couldn't load workouts", message: message) {
                Task { await viewModel.load() }
            }
            .cardSurface()
        default:
            if viewModel.filteredWorkouts.isEmpty {
                AppEmptyStateView(
                    title: viewModel.isFiltered ? "No workouts match these filters" : "No workouts yet",
                    message: viewModel.isFiltered
                        ? "Clear filters to see all available routines."
                        : "Create your first workout template with the + button.",
                    systemImage: "dumbbell",
                    actionTitle: viewModel.isFiltered ? "Clear filters" : nil,
                    action: viewModel.clearFilters
                )
            } else {
                ForEach(viewModel.filteredWorkouts) { workout in
                    WorkoutCard(
                        workout: workout,
                        isStarting: startingWorkoutId == workout.id,
                        isStartDisabled: startingWorkoutId != nil,
                        onStart: { start(workout) }
                    )
                }
            }
        }
    }

    /// Starts a session from the list: loads the template, then copies its exercises.
    private func start(_ workout: WorkoutListItem) {
        guard startingWorkoutId == nil else { return }
        startingWorkoutId = workout.id
        startError = nil
        Task {
            defer { startingWorkoutId = nil }
            let model = WorkoutDetailViewModel(workoutId: workout.id, repository: workoutsRepository)
            await model.load(includeInsights: false)
            if let sessionId = await model.startSession() {
                onSessionStarted(sessionId)
            } else {
                startError = model.startState.errorMessage ?? model.state.errorMessage ?? "Couldn't start \(workout.name)."
            }
        }
    }
}

private struct WorkoutCard: View {
    let workout: WorkoutListItem
    let isStarting: Bool
    let isStartDisabled: Bool
    let onStart: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingSM) {
            NavigationLink(value: TrainRoute.workoutDetail(workout.id)) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(workout.name)
                        .font(.headline)
                        .foregroundStyle(NeoGymTheme.text)
                        .multilineTextAlignment(.leading)
                    if let description = workout.description, !description.isEmpty {
                        Text(MarkdownRendering.stripMarkdown(description))
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    WrappingTags(items: tags)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the workout")
            Button(action: onStart) {
                HStack(spacing: 6) {
                    if isStarting {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "play.fill").font(.caption)
                    }
                    Text("Start")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NeoGymTheme.accentText)
                .padding(.horizontal, 14)
                .frame(minHeight: NeoGymTheme.minimumTapTarget)
                .background(Capsule().fill(NeoGymTheme.accentSoft).padding(.vertical, 5))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(isStartDisabled)
            .accessibilityLabel("Start \(workout.name)")
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingSM)
        .cardSurface()
    }

    private var tags: [String] {
        var items = ["\(workout.exerciseCount) exercise\(workout.exerciseCount == 1 ? "" : "s")"]
        if workout.isPublic { items.append("Public") }
        items += workout.workoutLabels.map(\.label.name)
        return items
    }
}

/// Selectable capsule used in filter rows. Unselected chips sit on the
/// surface token over the page background; pass `fill` where the row sits on
/// a sheet beside other fill-token controls (Add exercises).
struct FilterChip: View {
    let title: String
    let isSelected: Bool
    var unselectedFill: Color = NeoGymTheme.surface
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? NeoGymTheme.onFill : NeoGymTheme.text)
                .padding(.horizontal, 14)
                .frame(minHeight: 36)
                .background(Capsule().fill(isSelected ? NeoGymTheme.accent : unselectedFill))
                .frame(minHeight: NeoGymTheme.minimumTapTarget)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Small metadata tags that wrap onto new lines.
struct WrappingTags: View {
    let items: [String]

    var body: some View {
        FlowRow(spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                if index == 0 {
                    Text(item)
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                } else {
                    Text(item)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(NeoGymTheme.textSecondary)
                        .padding(.horizontal, NeoGymTheme.spacingXS)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(NeoGymTheme.fill))
                }
            }
        }
    }
}

/// Minimal wrapping layout for chips and tags.
struct FlowRow: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: min(maxX, width), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

#Preview("Workouts") {
    ScreenScaffold {
        NavigationStack {
            WorkoutsListView(
                workoutsRepository: PreviewWorkoutsRepository(),
                reloadToken: 0,
                onSessionStarted: { _ in }
            )
        }
    }
}
