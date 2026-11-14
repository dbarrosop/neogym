import NeoGymKit
import SwiftUI

struct WorkoutDetailView: View {
    @StateObject private var viewModel: WorkoutDetailViewModel
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let currentUserId: String?
    var onSessionStarted: (String) -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        workoutId: String,
        workoutsRepository: any WorkoutsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        currentUserId: String?,
        onSessionStarted: @escaping (String) -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _viewModel = StateObject(
            wrappedValue: WorkoutDetailViewModel(workoutId: workoutId, repository: workoutsRepository)
        )
        self.workoutsRepository = workoutsRepository
        self.exercisesRepository = exercisesRepository
        self.currentUserId = currentUserId
        self.onSessionStarted = onSessionStarted
        self.onDeleted = onDeleted
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.spacingXS)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle(viewModel.workout?.name ?? "Workout")
        .navigationBarTitleDisplayMode(.inline)
        // The name is the content's Title 2; keep it for Back labels only.
        .toolbar(removing: .title)
        .toolbar { editToolbar }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    @ToolbarContentBuilder
    private var editToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            if viewModel.workout?.canEdit(currentUserId: currentUserId) == true {
                NavigationLink {
                    WorkoutEditView(
                        workoutId: viewModel.workoutId,
                        workoutsRepository: workoutsRepository,
                        exercisesRepository: exercisesRepository,
                        currentUserId: currentUserId,
                        onSaved: { Task { await viewModel.load() } },
                        onDeleted: {
                            onDeleted()
                            presentationMode.wrappedValue.dismiss()
                        }
                    )
                } label: {
                    Text("Edit")
                }
                .accessibilityLabel("Edit workout")
            }
        }
    }

    private var startSessionButton: some View {
        Button(action: startSession) {
            Label(viewModel.startState.isLoading ? "Starting…" : "Start session", systemImage: "play.fill")
        }
        .buttonStyle(NeoGymPrimaryButtonStyle())
        .disabled(viewModel.startState.isLoading)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading workout")
        case .loading where viewModel.workout == nil:
            AppLoadingStateView(title: "Loading workout")
        case let .failed(message, _) where viewModel.workout == nil:
            AppErrorStateView(title: "Couldn't load workout", message: message) {
                Task { await viewModel.load() }
            }
            .padding(NeoGymTheme.spacingMD)
            .cardSurface()
        default:
            if let workout = viewModel.workout {
                header(workout)
                startSessionButton
                    .padding(.top, NeoGymTheme.spacingMD)
                if let error = viewModel.startState.errorMessage {
                    FeedbackBanner(message: error)
                        .padding(.top, NeoGymTheme.spacingXS)
                }
                if let bars = viewModel.insights?.volumeBars, !bars.isEmpty {
                    sectionTitle("Volume by session")
                    WorkoutVolumeBarsCard(bars: bars)
                }
                sectionTitle("Exercises")
                exercises(workout)
                if let description = workout.description?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !description.isEmpty {
                    sectionTitle("Notes")
                    WorkoutNotesCard(markdown: description)
                }
            }
        }
    }

    private func header(_ workout: WorkoutDetailModel) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            Text(workout.name)
                .font(.title2.bold())
                .foregroundStyle(NeoGymTheme.text)
                .accessibilityAddTraits(.isHeader)
            if workout.isPublic || !workout.workoutLabels.isEmpty {
                FlowRow(spacing: 6) {
                    if workout.isPublic {
                        WorkoutTag(text: "Public", isLabel: false)
                    }
                    ForEach(workout.workoutLabels) { label in
                        WorkoutTag(text: label.label.name, isLabel: true)
                    }
                }
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingXXS)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.title3.bold())
            .foregroundStyle(NeoGymTheme.text)
            .padding(.horizontal, NeoGymTheme.spacingXXS)
            .padding(.top, NeoGymTheme.spacingLG)
            .padding(.bottom, NeoGymTheme.spacingXS)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private func exercises(_ workout: WorkoutDetailModel) -> some View {
        if workout.workoutExercises.isEmpty {
            AppEmptyStateView(
                title: "No exercises yet",
                message: "Edit this workout to add exercises.",
                systemImage: "dumbbell"
            )
        } else {
            VStack(spacing: 0) {
                ForEach(Array(workout.workoutExercises.enumerated()), id: \.element.id) { index, row in
                    if index > 0 { RowSeparator(leadingInset: 52) }
                    NavigationLink(value: TrainRoute.exerciseDetail(row.exercise.id)) {
                        WorkoutExerciseDetailRow(
                            row: row,
                            index: index,
                            lastTopSet: viewModel.insights?.lastTopSetByExercise[row.exercise.id]
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .cardSurface()
        }
    }

    private func startSession() {
        Task {
            if let id = await viewModel.startSession() {
                onSessionStarted(id)
            }
        }
    }
}

private struct WorkoutExerciseDetailRow: View {
    let row: WorkoutExerciseRow
    let index: Int
    let lastTopSet: String?

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            Text("\(index + 1)")
                .font(.footnote.bold())
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
                .frame(width: 24, height: 24)
                .background(Circle().fill(NeoGymTheme.fill))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(row.exercise.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.text)
                    .multilineTextAlignment(.leading)
                Text(ExerciseFormatters.enumValue(row.exercise.primaryMuscleGroup))
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            Spacer(minLength: NeoGymTheme.spacingXS)
            if let lastTopSet {
                Text(lastTopSet)
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .accessibilityLabel("Last top set \(lastTopSet)")
            }
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NeoGymTheme.textTertiary)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 10)
        .frame(minHeight: 48)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// A workout label (accent soft) or the Public marker (neutral).
private struct WorkoutTag: View {
    let text: String
    let isLabel: Bool

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, NeoGymTheme.spacingXS)
            .padding(.vertical, 3)
            .foregroundStyle(isLabel ? NeoGymTheme.accentText : NeoGymTheme.textSecondary)
            .background(Capsule().fill(isLabel ? NeoGymTheme.accentSoft : NeoGymTheme.fill))
    }
}

/// Strength volume of the workout's latest sessions; the latest bar is accent.
private struct WorkoutVolumeBarsCard: View {
    let bars: [WorkoutVolumeBar]

    private var maxVolume: Double { max(bars.map(\.volume).max() ?? 0, 1) }

    var body: some View {
        VStack(spacing: NeoGymTheme.spacingXS) {
            HStack(alignment: .bottom, spacing: 14) {
                ForEach(Array(bars.enumerated()), id: \.element.id) { index, bar in
                    VStack(spacing: 6) {
                        Spacer(minLength: 0)
                        Text(Self.compact(bar.volume))
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(NeoGymTheme.textSecondary)
                        UnevenRoundedRectangle(
                            topLeadingRadius: 6, bottomLeadingRadius: 2,
                            bottomTrailingRadius: 2, topTrailingRadius: 6, style: .continuous
                        )
                        .fill(index == bars.count - 1 ? NeoGymTheme.accent : NeoGymTheme.accent.opacity(0.45))
                        .frame(height: max(8, 72 * bar.volume / maxVolume))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 96)
            HStack(spacing: 14) {
                ForEach(bars) { bar in
                    Text(bar.startedAtDate?.formatted(.dateTime.day().month(.abbreviated)) ?? "—")
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 14)
        .cardSurface()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        let points = bars.map { bar in
            let day = bar.startedAtDate?.formatted(.dateTime.day().month(.wide)) ?? "unknown date"
            return "\(MetricFormat.whole(bar.volume)) kilograms on \(day)"
        }
        return "Volume by session, oldest to latest: " + points.joined(separator: ", ")
    }

    private static func compact(_ volume: Double) -> String {
        volume >= 1_000
            ? (volume / 1_000).formatted(.number.precision(.fractionLength(1))) + "k"
            : MetricFormat.whole(volume)
    }
}

/// The workout's markdown description, collapsed to a few lines with Show all.
private struct WorkoutNotesCard: View {
    let markdown: String
    @State private var isExpanded = false

    private var blocks: [MarkdownBlock] { MarkdownRendering.parseBlocks(markdown) }
    private var isLong: Bool { blocks.count > 2 || markdown.count > 240 }

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
                ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                    blockView(block)
                }
            }
            .lineLimit(isExpanded || !isLong ? nil : 3)
            .frame(maxHeight: isExpanded || !isLong ? nil : 96, alignment: .top)
            .clipped()
            if isLong {
                Button(isExpanded ? "Show less" : "Show all") {
                    withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
                }
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.accentText)
                .frame(minHeight: 32)
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block {
        case let .heading(_, text):
            Text(text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NeoGymTheme.text)
        case let .paragraph(text):
            Text(text)
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.text)
        case let .unorderedList(items):
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("•")
                    Text(item)
                }
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.text)
            }
        case let .orderedList(items):
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(index + 1).").monospacedDigit()
                    Text(item)
                }
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.text)
            }
        }
    }
}
