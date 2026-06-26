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
    @State private var startedSessionId: String?

    init(
        workoutId: String,
        workoutsRepository: any WorkoutsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        currentUserId: String?,
        onSessionStarted: @escaping (String) -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: WorkoutDetailViewModel(workoutId: workoutId, repository: workoutsRepository))
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
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .navigationTitle(viewModel.workout?.name ?? "Workout")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarItems(trailing: editToolbarLink)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .alert("Session started", isPresented: Binding(get: { startedSessionId != nil }, set: { if !$0 { startedSessionId = nil } })) {
            Button("View Sessions") {
                if let startedSessionId { onSessionStarted(startedSessionId) }
                startedSessionId = nil
            }
            Button("Stay here", role: .cancel) { startedSessionId = nil }
        } message: {
            Text("Your session was created from this workout. Session detail navigation arrives with the Sessions phase.")
        }
    }

    @ViewBuilder
    private var editToolbarLink: some View {
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
                Image(systemName: "pencil")
            }
            .accessibilityLabel("Edit workout")
        } else {
            EmptyView()
        }
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
                                        .foregroundColor(.accentColor)
                                }
                            }
                        }
                        Text("\(workout.workoutExercises.count) exercise\(workout.workoutExercises.count == 1 ? "" : "s")")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                        Button {
                            Task {
                                if let id = await viewModel.startSession() {
                                    startedSessionId = id
                                }
                            }
                        } label: {
                            Label(viewModel.startState.isLoading ? "Starting…" : "Start session", systemImage: "play.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                        .disabled(viewModel.startState.isLoading)
                        if let error = viewModel.startState.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                }
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
                    .background(.thinMaterial, in: Circle())
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(row.exercise.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                Text(
                    ExerciseFormatters.enumValue(row.exercise.primaryMuscleGroup)
                        + (row.exercise.strength?.doubleWeight == true ? " · two-handed" : "")
                )
                .font(.caption)
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


private struct WorkoutVisibilityBadge: View {
    let isPublic: Bool

    var body: some View {
        Label(isPublic ? "Public" : "Mine", systemImage: isPublic ? "globe" : "person")
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundColor(isPublic ? .accentColor : NeoGymTheme.mutedText)
            .background(NeoGymTheme.mutedFill, in: Capsule())
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
                        .foregroundColor(NeoGymTheme.mutedText)
                case let .unorderedList(items):
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        Label { Text(item) } icon: { Text("•") }
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                case let .orderedList(items):
                    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                        HStack(alignment: .firstTextBaseline) {
                            Text("\(index + 1).")
                            Text(item)
                        }
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                    }
                }
            }
        }
    }
}
