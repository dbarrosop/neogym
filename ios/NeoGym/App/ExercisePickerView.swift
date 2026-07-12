import NeoGymKit
import SwiftUI

struct ExercisePickerView: View {
    let repository: any ExercisesRepositoryProtocol
    let alreadySelected: Set<String>
    var confirmLabel = "Add"
    let onConfirm: ([ExerciseListItem]) -> Void
    let onCancel: () -> Void

    @State private var state: Loadable<[ExerciseListItem]> = .idle
    @State private var search = ""
    @State private var currentExerciseId = ""
    @State private var picked: [String: ExerciseListItem] = [:]

    private var exercises: [ExerciseListItem] { state.value ?? [] }

    private var filteredExercises: [ExerciseListItem] {
        let available = exercises.filter { exercise in
            !alreadySelected.contains(exercise.id) && picked[exercise.id] == nil
        }
        let trimmed = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return available }
        return available.filter { $0.name.lowercased().contains(trimmed) }
    }

    private var currentExercise: ExerciseListItem? {
        filteredExercises.first { $0.id == currentExerciseId }
    }

    private var filteredExerciseIds: [String] {
        filteredExercises.map(\.id)
    }

    var body: some View {
        NavigationView {
            ScreenScaffold {
                VStack(spacing: NeoGymTheme.spacingMD) {
                    searchField
                    content
                    footer
                }
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            }
            .navigationTitle("Add exercises")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
            }
            .task {
                if case .idle = state {
                    await load()
                }
            }
        }
        .navigationViewStyle(.stack)
        .onChange(of: search) { syncWheelSelection() }
        .onChange(of: filteredExerciseIds) { syncWheelSelection() }
    }

    private var searchField: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField(currentExercise?.name ?? "Filter exercises…", text: $search)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
            if !search.isEmpty {
                Button {
                    search = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassFill,
            shadow: false
        )
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .idle:
            AppLoadingStateView(title: "Loading exercises")
                .frame(maxHeight: .infinity)
        case .loading where exercises.isEmpty:
            AppLoadingStateView(title: "Loading exercises")
                .frame(maxHeight: .infinity)
        case let .failed(message, _) where exercises.isEmpty:
            AppErrorStateView(title: "Failed to load", message: message) {
                Task { await load() }
            }
            .frame(maxHeight: .infinity)
        default:
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) {
                if filteredExercises.isEmpty {
                    AppEmptyStateView(
                        title: picked.isEmpty ? "No matching exercises" : "No more matching exercises",
                        message: picked.isEmpty ? "Try a different search." : "Confirm or remove a staged exercise.",
                        systemImage: "magnifyingglass"
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    Picker("Exercise", selection: $currentExerciseId) {
                        ForEach(filteredExercises) { exercise in
                            ExerciseWheelRow(exercise: exercise)
                                .tag(exercise.id)
                        }
                    }
                    .pickerStyle(.wheel)
                    .labelsHidden()
                    .frame(height: 176)
                    .clipped()

                    if let currentExercise {
                        selectedSummary(exercise: currentExercise)
                    }

                    Button("Stage selected exercise") {
                        stageCurrentExercise()
                    }
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                    .disabled(currentExercise == nil)
                }

                if !picked.isEmpty {
                    stagedExercises
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    private func selectedSummary(exercise: ExerciseListItem) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.accentColor)
                Text(exercise.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            Text(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup))
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var stagedExercises: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            Text("Staged to add")
                .font(.caption.weight(.semibold))
                .foregroundColor(NeoGymTheme.mutedText)
            ScrollView {
                LazyVStack(spacing: NeoGymTheme.spacingXXS) {
                    ForEach(Array(picked.values).sorted { $0.name < $1.name }) { exercise in
                        HStack(spacing: NeoGymTheme.spacingXS) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.accentColor)
                            Text(exercise.name)
                                .font(.caption.weight(.semibold))
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            Button {
                                picked.removeValue(forKey: exercise.id)
                                syncWheelSelection()
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(NeoGymTheme.mutedText)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Remove \(exercise.name)")
                        }
                        .padding(.vertical, NeoGymTheme.spacingXXS)
                    }
                }
            }
            .frame(maxHeight: 128)
        }
    }

    private var footer: some View {
        HStack {
            Button("Cancel", action: onCancel)
                .buttonStyle(NeoGymSecondaryButtonStyle())
            Button("\(confirmLabel)\(picked.isEmpty ? "" : " (\(picked.count))")") {
                onConfirm(Array(picked.values))
            }
            .buttonStyle(NeoGymPrimaryButtonStyle())
            .disabled(picked.isEmpty)
        }
        .padding(NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusLG,
            material: .thin,
            tint: NeoGymTheme.glassStrongFill,
            shadow: true
        )
    }

    private func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.exercisePickerExercises())
            syncWheelSelection()
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    private func stageCurrentExercise() {
        guard let currentExercise else { return }
        picked[currentExercise.id] = currentExercise
        syncWheelSelection()
    }

    private func syncWheelSelection() {
        guard let firstVisible = filteredExercises.first else {
            currentExerciseId = ""
            return
        }
        if currentExerciseId.isEmpty || !filteredExercises.contains(where: { $0.id == currentExerciseId }) {
            currentExerciseId = firstVisible.id
        }
    }
}

private struct ExerciseWheelRow: View {
    let exercise: ExerciseListItem

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "figure.strengthtraining.traditional")
                .foregroundColor(NeoGymTheme.mutedText)
            Text(exercise.name)
                .font(.body.weight(.semibold))
                .lineLimit(1)
        }
    }
}
