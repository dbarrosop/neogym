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
    @State private var picked: [String: ExerciseListItem] = [:]

    private var exercises: [ExerciseListItem] { state.value ?? [] }

    private var filteredExercises: [ExerciseListItem] {
        let trimmed = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return exercises }
        return exercises.filter { $0.name.lowercased().contains(trimmed) }
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
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField("Search exercises…", text: $search)
                .textInputAutocapitalization(.never)
            if !search.isEmpty {
                Button {
                    search = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .buttonStyle(.plain)
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
        case .idle, .loading where exercises.isEmpty:
            AppLoadingStateView(title: "Loading exercises")
                .frame(maxHeight: .infinity)
        case let .failed(message, _) where exercises.isEmpty:
            AppErrorStateView(title: "Failed to load", message: message) {
                Task { await load() }
            }
            .frame(maxHeight: .infinity)
        default:
            if filteredExercises.isEmpty {
                AppEmptyStateView(
                    title: "No matching exercises",
                    message: "Try a different search.",
                    systemImage: "magnifyingglass"
                )
                .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: NeoGymTheme.spacingXS) {
                        ForEach(filteredExercises) { exercise in
                            ExercisePickerRow(
                                exercise: exercise,
                                isAlreadySelected: alreadySelected.contains(exercise.id),
                                isPicked: picked[exercise.id] != nil
                            ) {
                                toggle(exercise)
                            }
                        }
                    }
                    .padding(.vertical, NeoGymTheme.spacingXXS)
                }
            }
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
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    private func toggle(_ exercise: ExerciseListItem) {
        guard !alreadySelected.contains(exercise.id) else { return }
        if picked[exercise.id] == nil {
            picked[exercise.id] = exercise
        } else {
            picked.removeValue(forKey: exercise.id)
        }
    }
}

private struct ExercisePickerRow: View {
    let exercise: ExerciseListItem
    let isAlreadySelected: Bool
    let isPicked: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: NeoGymTheme.spacingSM) {
                Image(systemName: isPicked ? "checkmark.square.fill" : "square")
                    .foregroundColor(isPicked ? .accentColor : NeoGymTheme.mutedText)
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                    Text(exercise.name)
                        .font(.subheadline.weight(.semibold))
                    Text(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup))
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                Spacer(minLength: 0)
                if isAlreadySelected {
                    Text("Added")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
            .padding(NeoGymTheme.spacingSM)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: isPicked ? NeoGymTheme.accentMuted : NeoGymTheme.glassSubtleFill,
                stroke: isPicked ? Color.accentColor.opacity(0.28) : NeoGymTheme.glassStrokeSecondary,
                shadow: false
            )
        }
        .buttonStyle(.plain)
        .disabled(isAlreadySelected)
        .opacity(isAlreadySelected ? 0.55 : 1)
    }
}
