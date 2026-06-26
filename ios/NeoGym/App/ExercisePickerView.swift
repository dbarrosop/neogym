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
            VStack(spacing: 14) {
                searchField
                content
                footer
            }
            .padding(16)
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
        .padding(12)
        .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(NeoGymTheme.border))
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
                List(filteredExercises) { exercise in
                    let isAlreadySelected = alreadySelected.contains(exercise.id)
                    let isPicked = picked[exercise.id] != nil
                    Button {
                        toggle(exercise)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: isPicked ? "checkmark.square.fill" : "square")
                                .foregroundColor(isPicked ? .accentColor : NeoGymTheme.mutedText)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(exercise.name)
                                    .font(.subheadline.weight(.semibold))
                                Text(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup))
                                    .font(.caption)
                                    .foregroundColor(NeoGymTheme.mutedText)
                            }
                            Spacer()
                            if isAlreadySelected {
                                Text("Added")
                                    .font(.caption2.weight(.bold))
                                    .foregroundColor(NeoGymTheme.mutedText)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isAlreadySelected)
                    .opacity(isAlreadySelected ? 0.55 : 1)
                }
                .listStyle(.plain)
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
