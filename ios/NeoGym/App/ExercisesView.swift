import NeoGymKit
import SwiftUI

struct ExercisesListView: View {
    @StateObject private var viewModel: ExercisesListViewModel
    let reloadToken: Int

    init(
        repository: any ExercisesRepositoryProtocol,
        reloadToken: Int
    ) {
        self.reloadToken = reloadToken
        _viewModel = StateObject(wrappedValue: ExercisesListViewModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                filterControls
                results
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }


    private var filterControls: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .accessibilityHidden(true)
                TextField("Search \(viewModel.exercises.count) exercises", text: $viewModel.searchText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Search exercises")
                if !viewModel.searchText.isEmpty {
                    Button {
                        viewModel.searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(NeoGymTheme.textSecondary)
                            .frame(width: NeoGymTheme.minimumTapTarget, height: NeoGymTheme.minimumTapTarget)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.leading, NeoGymTheme.spacingSM)
            .frame(minHeight: NeoGymTheme.minimumTapTarget)
            .cardSurface(cornerRadius: NeoGymTheme.radiusMD, fill: NeoGymTheme.fill)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: NeoGymTheme.spacingXS) {
                    FilterChip(title: "Mine", isSelected: viewModel.visibility == .mine) { toggleVisibility(.mine) }
                    FilterChip(title: "Public", isSelected: viewModel.visibility == .public) { toggleVisibility(.public) }
                    ForEach(ExerciseFilterKey.allCases, id: \.self) { key in
                        filterMenu(key)
                    }
                }
            }

            if viewModel.isFiltered {
                HStack {
                    Text("\(viewModel.filteredExercises.count) match\(viewModel.filteredExercises.count == 1 ? "" : "es")")
                        .monospacedDigit()
                    Spacer()
                    Button("Clear all") { viewModel.clearAll() }
                        .foregroundStyle(NeoGymTheme.accentText)
                        .frame(minHeight: NeoGymTheme.minimumTapTarget)
                }
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
            }
        }
    }

    private func toggleVisibility(_ value: ExerciseVisibilityFilter) {
        viewModel.visibility = viewModel.visibility == value ? nil : value
    }

    private func filterMenu(_ key: ExerciseFilterKey) -> some View {
        let value = viewModel.filters[key]
        return Menu {
            Button("Any \(key.title.lowercased())") { viewModel.setFilter(key, value: nil) }
            ForEach(viewModel.options(for: key)) { option in
                Button {
                    viewModel.setFilter(key, value: option.value)
                } label: {
                    if value == option.value {
                        Label("\(ExerciseFormatters.enumValue(option.value)) (\(option.count))", systemImage: "checkmark")
                    } else {
                        Text("\(ExerciseFormatters.enumValue(option.value)) (\(option.count))")
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(value.map(ExerciseFormatters.enumValue) ?? key.title)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.bold))
            }
            .font(.subheadline.weight(value == nil ? .regular : .semibold))
            .foregroundStyle(value == nil ? NeoGymTheme.text : NeoGymTheme.onFill)
            .padding(.horizontal, 14)
            .frame(minHeight: 36)
            .background(Capsule().fill(value == nil ? NeoGymTheme.surface : NeoGymTheme.accent))
            .frame(minHeight: NeoGymTheme.minimumTapTarget)
        }
        .accessibilityLabel("\(key.title) filter")
        .accessibilityValue(value.map(ExerciseFormatters.enumValue) ?? "Any")
    }

    @ViewBuilder
    private var results: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading exercises")
        case .loading where viewModel.exercises.isEmpty:
            AppLoadingStateView(title: "Loading exercises")
        case let .failed(message, _) where viewModel.exercises.isEmpty:
            SectionShell(title: "Exercises") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.filteredExercises.isEmpty {
                AppEmptyStateView(
                    title: viewModel.isFiltered ? "No exercises match these filters" : "No exercises yet",
                    message: viewModel.isFiltered
                        ? "Clear filters to see the full catalog."
                        : "The catalog is empty.",
                    systemImage: "dumbbell",
                    actionTitle: viewModel.isFiltered ? "Clear filters" : nil,
                    action: viewModel.clearAll
                )
            } else if viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                LazyVStack(spacing: NeoGymTheme.spacingMD) {
                    ForEach(viewModel.groupedExercises) { group in
                        ExerciseGroupCard(group: group)
                    }
                }
            } else {
                ExerciseFlatResultsCard(exercises: viewModel.filteredExercises)
            }
        }
    }
}

private struct ExerciseGroupCard: View {
    let group: ExerciseMuscleGroup
    var body: some View {
        ExerciseRowsGroup(
            title: ExerciseFormatters.enumValue(group.muscle),
            detail: "\(group.exercises.count)",
            exercises: group.exercises,
            showMuscle: false
        )
    }
}

private struct ExerciseFlatResultsCard: View {
    let exercises: [ExerciseListItem]
    var body: some View {
        ExerciseRowsGroup(title: "Matches", detail: "\(exercises.count)", exercises: exercises, showMuscle: true)
    }
}

private struct ExerciseRowsGroup: View {
    let title: String
    let detail: String
    let exercises: [ExerciseListItem]
    let showMuscle: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            HStack {
                Text(title)
                    .font(.footnote.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Text(detail)
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            .padding(.horizontal, NeoGymTheme.spacingXXS)
            LazyVStack(spacing: 0) {
                ForEach(exercises) { exercise in
                    ExerciseRowLink(exercise: exercise, showMuscle: showMuscle)
                    if exercise.id != exercises.last?.id {
                        Divider().overlay(NeoGymTheme.separator).padding(.leading, 76)
                    }
                }
            }
            .cardSurface()
        }
    }
}

private struct ExerciseRowLink: View {
    let exercise: ExerciseListItem
    var showMuscle = false

    var body: some View {
        NavigationLink(value: TrainRoute.exerciseDetail(exercise.id)) {
            HStack(spacing: NeoGymTheme.spacingSM) {
                ExerciseThumbnail(fileId: exercise.image1FileId)
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.text)
                        .multilineTextAlignment(.leading)
                    Text(meta)
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
                Spacer(minLength: NeoGymTheme.spacingXS)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.textTertiary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .padding(.vertical, 10)
            .frame(minHeight: NeoGymTheme.minimumTapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var meta: String {
        var parts: [String] = []
        if showMuscle { parts.append(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup)) }
        if let equipment = exercise.equipment { parts.append(ExerciseFormatters.enumValue(equipment)) }
        if exercise.strength?.doubleWeight == true { parts.append("Per side") }
        parts.append(exercise.isPublic ? "Public" : "Mine")
        return parts.joined(separator: " · ")
    }
}
