import NeoGymKit
import SwiftUI

struct WorkoutDetailView: View {
    @StateObject private var viewModel: WorkoutDetailViewModel
    let workoutsRepository: any WorkoutsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let currentUserId: String?
    var onSessionStarted: (String) -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        workoutId: String,
        workoutsRepository: any WorkoutsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        currentUserId: String?,
        onSessionStarted: @escaping (String) -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _viewModel = StateObject(
            wrappedValue: WorkoutDetailViewModel(workoutId: workoutId, repository: workoutsRepository)
        )
        self.workoutsRepository = workoutsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.currentUserId = currentUserId
        self.onSessionStarted = onSessionStarted
        self.onDeleted = onDeleted
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
        .navigationTitle(viewModel.workout?.name ?? "Workout")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { bottomActionToolbar }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    @ToolbarContentBuilder
    private var bottomActionToolbar: some ToolbarContent {
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
            SectionShell(title: "Loading workout") {
                AppLoadingStateView(title: "Loading workout")
            }
        case .loading where viewModel.workout == nil:
            SectionShell(title: "Loading workout") {
                AppLoadingStateView(title: "Loading workout")
            }
        case let .failed(message, _) where viewModel.workout == nil:
            SectionShell(title: "Workout") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let workout = viewModel.workout {
                SectionShell(title: workout.name) {
                    VStack(alignment: .leading, spacing: 16) {
                        WorkoutVisibilityBadge(isPublic: workout.isPublic)
                        if let description = workout.description, !description.isEmpty {
                            MarkdownBlocksView(markdown: description)
                        }
                        if !workout.workoutLabels.isEmpty {
                            HStack(spacing: 6) {
                                ForEach(workout.workoutLabels) { label in
                                    Label(label.label.name, systemImage: "tag.fill")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(NeoGymTheme.accentText)
                                }
                            }
                        }
                        Text(
                            "\(workout.workoutExercises.count) "
                                + "exercise\(workout.workoutExercises.count == 1 ? "" : "s")"
                        )
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.textSecondary)
                        if let error = viewModel.startState.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(NeoGymTheme.destructive)
                        }
                    }
                }
                startSessionButton
                SectionShell(title: "Exercises") {
                    if workout.workoutExercises.isEmpty {
                        AppEmptyStateView(
                            title: "No exercises yet",
                            message: "Edit this workout to add exercises.",
                            systemImage: "dumbbell"
                        )
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(workout.workoutExercises.enumerated()), id: \.element.id) { index, row in
                                NavigationLink {
                                    ExerciseDetailView(
                                        exerciseId: row.exercise.id,
                                        repository: exercisesRepository,
                                        storageBaseURL: storageBaseURL,
                                        onSessionStarted: onSessionStarted
                                    )
                                } label: {
                                    WorkoutExerciseDetailRow(row: row, index: index, storageBaseURL: storageBaseURL)
                                }
                                if row.id != workout.workoutExercises.last?.id { Divider() }
                            }
                        }
                    }
                }
            }
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
    let storageBaseURL: URL

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                AlternatingStorageImageView(
                    urls: [
                        URL.nhostStorageFile(baseURL: storageBaseURL, fileId: row.exercise.image1FileId),
                        URL.nhostStorageFile(baseURL: storageBaseURL, fileId: row.exercise.image2FileId)
                    ].compactMap { $0 },
                    aspectRatio: 1
                )
                .frame(width: 54, height: 54)
                Text("\(index + 1)")
                    .font(.caption2.bold())
                    .padding(4)
                    .cardSurface(
                        cornerRadius: NeoGymTheme.radiusPill,
                        fill: NeoGymTheme.surface
                    )
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(row.exercise.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.text)
                Text(
                    ExerciseFormatters.enumValue(row.exercise.primaryMuscleGroup)
                        + (row.exercise.strength?.doubleWeight == true ? " · two-handed" : "")
                )
                .font(.caption)
                .foregroundColor(NeoGymTheme.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.textSecondary)
        }
        .padding(.vertical, 10)
    }
}

private struct WorkoutVisibilityBadge: View {
    let isPublic: Bool

    var body: some View {
        Label(isPublic ? "Public" : "Mine", systemImage: isPublic ? "globe" : "person")
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundColor(isPublic ? NeoGymTheme.accentText : NeoGymTheme.textSecondary)
            .cardSurface(
                cornerRadius: NeoGymTheme.radiusPill,
                fill: NeoGymTheme.inset
            )
    }
}

private struct MarkdownBlocksView: View {
    let markdown: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(MarkdownRendering.parseBlocks(markdown).enumerated()), id: \.offset) { _, block in
                switch block {
                case let .heading(level, text):
                    Text(text)
                        .font(level <= 2 ? .headline : .subheadline.weight(.semibold))
                case let .paragraph(text):
                    Text(text)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.textSecondary)
                case let .unorderedList(items):
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        Label { Text(item) } icon: { Text("•") }
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.textSecondary)
                    }
                case let .orderedList(items):
                    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                        HStack(alignment: .firstTextBaseline) {
                            Text("\(index + 1).")
                            Text(item)
                        }
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.textSecondary)
                    }
                }
            }
        }
    }
}
