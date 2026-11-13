import NeoGymKit
import SwiftUI

/// Add exercises (design "iOS · Add exercises"): a multi-select checklist with
/// search, muscle-area chips, recently logged exercises first, and "Add N" in
/// the top-trailing toolbar. Exercises are added in the order they were ticked.
struct ExercisePickerView: View {
    let repository: any ExercisesRepositoryProtocol
    let alreadySelected: Set<String>
    var confirmLabel = "Add"
    /// Where picked exercises go, shown under the lists.
    var footer: String?
    let onConfirm: ([ExerciseListItem]) -> Void
    let onCancel: () -> Void

    @State private var state: Loadable<[ExerciseListItem]> = .idle
    @State private var recentIds: [String] = []
    @State private var search = ""
    @State private var filter: ExercisePickerFilter = .all
    @State private var picked: [ExerciseListItem] = []

    private var sections: ExercisePickerSections {
        ExercisePickerSections(
            exercises: state.value ?? [],
            excluding: alreadySelected,
            recentIds: recentIds,
            filter: filter,
            query: search
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                    SearchField(placeholder: "Search exercises", text: $search)
                    chips
                    content
                }
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.spacingXS)
            }
            .scrollDismissesKeyboard(.interactively)
            .screenBackground()
            .navigationTitle("Add exercises")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel, action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(picked.isEmpty ? confirmLabel : "\(confirmLabel) \(picked.count)") {
                        onConfirm(picked)
                    }
                    .fontWeight(.semibold)
                    .disabled(picked.isEmpty)
                }
            }
            .task {
                if case .idle = state {
                    await load()
                }
            }
        }
    }

    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                ForEach(ExercisePickerFilter.allCases) { option in
                    FilterChip(title: option.title, isSelected: filter == option) { filter = option }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Muscle area")
    }

    @ViewBuilder
    private var content: some View {
        let exercises = state.value ?? []
        switch state {
        case .idle:
            AppLoadingStateView(title: "Loading exercises")
        case .loading where exercises.isEmpty:
            AppLoadingStateView(title: "Loading exercises")
        case let .failed(message, _) where exercises.isEmpty:
            AppErrorStateView(title: "Couldn't load exercises", message: message) {
                Task { await load() }
            }
        default:
            let sections = sections
            if sections.isEmpty {
                AppEmptyStateView(
                    title: "No matching exercises",
                    message: "Try another search or muscle area.",
                    systemImage: "magnifyingglass"
                )
                .padding(.vertical, NeoGymTheme.spacingXL)
            } else {
                if !sections.recent.isEmpty {
                    exerciseList(title: "Recently logged", exercises: sections.recent)
                }
                if !sections.all.isEmpty {
                    exerciseList(title: "All exercises", exercises: sections.all)
                }
            }
            if let footer {
                FormFooter(footer)
            }
        }
    }

    private func exerciseList(title: String, exercises: [ExerciseListItem]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .padding(.horizontal, NeoGymTheme.spacingMD)
                .padding(.top, NeoGymTheme.spacingXS)
                .accessibilityAddTraits(.isHeader)
            LazyVStack(spacing: 0) {
                ForEach(Array(exercises.enumerated()), id: \.element.id) { index, exercise in
                    if index > 0 { RowSeparator(leadingInset: 52) }
                    ExercisePickerRow(exercise: exercise, isSelected: isPicked(exercise)) {
                        toggle(exercise)
                    }
                }
            }
            .cardSurface()
        }
    }

    private func isPicked(_ exercise: ExerciseListItem) -> Bool {
        picked.contains { $0.id == exercise.id }
    }

    private func toggle(_ exercise: ExerciseListItem) {
        if let index = picked.firstIndex(where: { $0.id == exercise.id }) {
            picked.remove(at: index)
        } else {
            picked.append(exercise)
        }
    }

    private func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.exercisePickerExercises())
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
            return
        }
        // Recent history only orders the list; the picker works without it.
        recentIds = (try? await repository.recentlyLoggedExerciseIds()) ?? []
    }
}

private struct ExercisePickerRow: View {
    let exercise: ExerciseListItem
    let isSelected: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: NeoGymTheme.spacingSM) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(isSelected ? NeoGymTheme.accentText : NeoGymTheme.textTertiary)
                    .frame(width: 24)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.name)
                        .foregroundStyle(NeoGymTheme.text)
                        .multilineTextAlignment(.leading)
                    Text(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup))
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
                Spacer(minLength: NeoGymTheme.spacingXS)
                if exercise.isCardioCategory {
                    Text("CARDIO")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .foregroundStyle(NeoGymTheme.accentText)
                        .background(Capsule().fill(NeoGymTheme.accentSoft))
                }
            }
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .padding(.vertical, NeoGymTheme.spacingXS)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
