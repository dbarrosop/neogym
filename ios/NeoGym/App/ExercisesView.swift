import NeoGymKit
import SwiftUI

struct ExercisesNavigationView: View {
    let repository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    var body: some View {
        NavigationView {
            ExercisesListView(
                repository: repository,
                storageBaseURL: storageBaseURL,
                onSessionStarted: onSessionStarted
            )
        }
        .navigationViewStyle(.stack)
    }
}

struct ExercisesListView: View {
    @StateObject private var viewModel: ExercisesListViewModel
    let repository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    @State private var expandedFilter: ExerciseFilterKey?

    init(
        repository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        onSessionStarted: @escaping (String) -> Void
    ) {
        self.repository = repository
        self.storageBaseURL = storageBaseURL
        self.onSessionStarted = onSessionStarted
        _viewModel = StateObject(wrappedValue: ExercisesListViewModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                filterControls
                results
            }
            .frame(maxWidth: 700)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding + NeoGymTheme.dockRootContentClearance)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Exercises")
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Catalog")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text("Exercises")
                .font(.largeTitle.bold())
                .tracking(-0.8)
            Text("Search by name, or narrow the catalog by muscle, category, equipment, and level.")
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
        }
    }

    private var filterControls: some View {
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
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(NeoGymTheme.mutedText)
                    TextField("Search exercises…", text: $viewModel.searchText)
                        .textInputAutocapitalization(.never)
                    if !viewModel.searchText.isEmpty {
                        Button {
                            viewModel.searchText = ""
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

                HStack(spacing: NeoGymTheme.spacingXS) {
                    visibilityButton(.mine, title: "Mine", icon: "person")
                    visibilityButton(.public, title: "Public", icon: "globe")
                }

                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: NeoGymTheme.spacingXS), count: 2),
                    spacing: NeoGymTheme.spacingXS
                ) {
                    ForEach(ExerciseFilterKey.allCases, id: \.self) { key in
                        filterHeader(key)
                    }
                }

                if let expandedFilter {
                    filterOptions(expandedFilter)
                }

                if viewModel.isFiltered {
                    HStack {
                        Text(
                            "\(viewModel.filteredExercises.count) "
                                + "match\(viewModel.filteredExercises.count == 1 ? "" : "es")"
                        )
                        Spacer()
                        Button("Clear all") {
                            withAnimation {
                                expandedFilter = nil
                                viewModel.clearAll()
                            }
                        }
                    }
                    .font(.caption.weight(.medium))
                    .foregroundColor(NeoGymTheme.mutedText)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func visibilityButton(_ value: ExerciseVisibilityFilter, title: String, icon: String) -> some View {
        Button {
            viewModel.visibility = viewModel.visibility == value ? nil : value
        } label: {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .foregroundColor(viewModel.visibility == value ? .white : NeoGymTheme.primaryText)
                .background(visibilityPillBackground(isActive: viewModel.visibility == value))
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func filterHeader(_ key: ExerciseFilterKey) -> some View {
        let value = viewModel.filters[key]
        return HStack(spacing: 6) {
            Button {
                withAnimation { expandedFilter = expandedFilter == key ? nil : key }
            } label: {
                HStack {
                    Text(value.map(ExerciseFormatters.enumValue) ?? key.title)
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: expandedFilter == key ? "chevron.up" : "chevron.down")
                        .font(.caption2.weight(.bold))
                }
            }
            .buttonStyle(.plain)
            if value != nil {
                Button {
                    viewModel.setFilter(key, value: nil)
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption2.bold())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear \(key.title) filter")
            }
        }
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .foregroundColor(value == nil ? .primary : Color.accentColor)
        .background(filterHeaderBackground(isSelected: value != nil))
        .contentShape(RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous))
    }

    @ViewBuilder
    private func visibilityPillBackground(isActive: Bool) -> some View {
        if isActive {
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

    @ViewBuilder
    private func filterHeaderBackground(isSelected: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous)
        if isSelected {
            shape
                .fill(NeoGymTheme.accentMuted)
                .overlay(shape.stroke(Color.accentColor.opacity(0.38), lineWidth: NeoGymTheme.hairline))
        } else {
            shape
                .fill(.ultraThinMaterial)
                .overlay(shape.fill(NeoGymTheme.glassSubtleFill))
                .overlay(
                    shape.stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
        }
    }

    private func filterOptions(_ key: ExerciseFilterKey) -> some View {
        let options = viewModel.options(for: key)
        return VStack(alignment: .leading, spacing: 8) {
            if options.isEmpty {
                Text("No options available with the current filters.")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(options) { option in
                        let selected = viewModel.filters[key] == option.value
                        Button {
                            withAnimation {
                                viewModel.setFilter(key, value: selected ? nil : option.value)
                                expandedFilter = nil
                            }
                        } label: {
                            HStack {
                                Text(ExerciseFormatters.enumValue(option.value))
                                    .lineLimit(1)
                                Spacer()
                                Text("\(option.count)")
                                    .foregroundColor(NeoGymTheme.mutedText)
                            }
                            .font(.caption)
                            .padding(8)
                            .background(
                                selected ? Color.accentColor.opacity(0.12) : Color.clear,
                                in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
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
    private var results: some View {
        switch viewModel.state {
        case .idle, .loading where viewModel.exercises.isEmpty:
            SectionShell(title: "Loading catalog") {
                AppLoadingStateView(title: "Loading exercises")
            }
        case let .failed(message, _) where viewModel.exercises.isEmpty:
            SectionShell(title: "Exercises") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.filteredExercises.isEmpty {
                SectionShell(title: "No matches") {
                    AppEmptyStateView(
                        title: "No exercises match these filters",
                        message: viewModel.isFiltered
                            ? "Clear filters to see the full catalog."
                            : "The catalog is empty.",
                        systemImage: "dumbbell"
                    )
                }
            } else if viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                VStack(spacing: 14) {
                    ForEach(viewModel.groupedExercises) { group in
                        ExerciseGroupCard(
                            group: group,
                            repository: repository,
                            storageBaseURL: storageBaseURL,
                            onSessionStarted: onSessionStarted
                        )
                    }
                }
            } else {
                ExerciseFlatResultsCard(
                    exercises: viewModel.filteredExercises,
                    repository: repository,
                    storageBaseURL: storageBaseURL,
                    onSessionStarted: onSessionStarted
                )
            }
        }
    }
}

private struct ExerciseGroupCard: View {
    let group: ExerciseMuscleGroup
    let repository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    var body: some View {
        SectionShell(
            title: ExerciseFormatters.enumValue(group.muscle),
            subtitle: "\(group.exercises.count) exercise\(group.exercises.count == 1 ? "" : "s")"
        ) {
            VStack(spacing: 0) {
                ForEach(group.exercises) { exercise in
                    ExerciseRowLink(
                        exercise: exercise,
                        repository: repository,
                        storageBaseURL: storageBaseURL,
                        onSessionStarted: onSessionStarted
                    )
                    if exercise.id != group.exercises.last?.id { Divider() }
                }
            }
        }
    }
}

private struct ExerciseFlatResultsCard: View {
    let exercises: [ExerciseListItem]
    let repository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    var body: some View {
        SectionShell(title: "Matches") {
            VStack(spacing: 0) {
                ForEach(exercises) { exercise in
                    ExerciseRowLink(
                        exercise: exercise,
                        showMuscle: true,
                        repository: repository,
                        storageBaseURL: storageBaseURL,
                        onSessionStarted: onSessionStarted
                    )
                    if exercise.id != exercises.last?.id { Divider() }
                }
            }
        }
    }
}

private struct ExerciseRowLink: View {
    let exercise: ExerciseListItem
    var showMuscle = false
    let repository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void

    var body: some View {
        NavigationLink {
            ExerciseDetailView(
                exerciseId: exercise.id,
                repository: repository,
                storageBaseURL: storageBaseURL,
                onSessionStarted: onSessionStarted
            )
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "dumbbell")
                    .foregroundColor(NeoGymTheme.mutedText)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(exercise.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.primary)
                        Image(systemName: exercise.isPublic ? "globe" : "person")
                            .font(.caption2)
                            .foregroundColor(exercise.isPublic ? .accentColor : NeoGymTheme.mutedText)
                    }
                    HStack(spacing: 6) {
                        if showMuscle {
                            Text(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup))
                        }
                        if exercise.strength?.doubleWeight == true {
                            Text("Two-handed")
                        }
                    }
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
}
