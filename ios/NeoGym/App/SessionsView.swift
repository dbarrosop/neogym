import NeoGymKit
import SwiftUI

struct SessionsListView: View {
    @StateObject private var viewModel: SessionsListViewModel
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL

    let reloadToken: Int

    init(
        sessionsRepository: any SessionsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        reloadToken: Int
    ) {
        _viewModel = StateObject(wrappedValue: SessionsListViewModel(repository: sessionsRepository))
        self.sessionsRepository = sessionsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("History")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text("Every workout you've logged, newest first. Start a new one from a workout or exercise.")
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading sessions") {
                AppLoadingStateView(title: "Loading sessions")
            }
        case .loading where viewModel.sessions.isEmpty:
            SectionShell(title: "Loading sessions") {
                AppLoadingStateView(title: "Loading sessions")
            }
        case let .failed(message, _) where viewModel.sessions.isEmpty:
            SectionShell(title: "Sessions") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.sessions.isEmpty {
                SectionShell(title: "No sessions") {
                    AppEmptyStateView(
                        title: "No sessions yet",
                        message: "Pick a workout or open an exercise and start a session to log your training.",
                        systemImage: "timer"
                    )
                }
            } else {
                VStack(spacing: 14) {
                    ForEach(viewModel.monthGroups) { group in
                        SectionShell(title: group.title) {
                            VStack(spacing: 0) {
                                ForEach(group.sessions) { session in
                                    NavigationLink(value: WorkoutsRoute.sessionDetail(session.id)) {
                                        SessionListRow(session: session)
                                    }
                                    if session.id != group.sessions.last?.id { Divider() }
                                }
                            }
                        }
                    }
                    if viewModel.hasNextPage {
                        Button {
                            Task { await viewModel.loadMore() }
                        } label: {
                            Label(viewModel.isLoadingMore ? "Loading…" : "Load more", systemImage: "ellipsis.circle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(NeoGymSecondaryButtonStyle())
                        .disabled(viewModel.isLoadingMore)
                    }
                }
            }
        }
    }

}

private struct SessionListRow: View {
    let session: SessionListItem

    var body: some View {
        HStack(spacing: 12) {
            SessionDateBadge(date: session.startedAtDate)
            VStack(alignment: .leading, spacing: 4) {
                Text(session.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text(Self.longDate(session.startedAtDate))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text(
                    "\(session.exerciseCount) exercise\(session.exerciseCount == 1 ? "" : "s")"
                        + " · \(session.entryCount) entr\(session.entryCount == 1 ? "y" : "ies")"
                )
                .font(.caption2.weight(.medium))
                .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.vertical, 10)
    }

    private static func longDate(_ date: Date?) -> String {
        guard let date else { return "Unknown date" }
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

private struct SessionDateBadge: View {
    let date: Date?

    var body: some View {
        VStack(spacing: 0) {
            Text(month)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(day)
                .font(.title3.weight(.bold))
                .foregroundColor(.primary)
        }
        .frame(width: 52, height: 52)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }

    private var month: String {
        guard let date else { return "—" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter.string(from: date)
    }

    private var day: String {
        guard let date else { return "—" }
        return String(Calendar.current.component(.day, from: date))
    }
}

struct SessionDetailView: View {
    @StateObject private var viewModel: SessionDetailViewModel
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let restTimer: RestTimerController
    var onSessionStarted: (String) -> Void
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var isEditingStartedAt = false
    @State private var draftStartedAt = Date()
    @State private var isShowingExercisePicker = false
    @State private var isConfirmingDelete = false
    @State private var pendingRemoveExercise: SessionExerciseRow?
    @State private var editingSet: StrengthSetEditorState?
    @State private var editingCardioEntry: CardioEntryEditorState?
    @State private var errorMessage: String?

    init(
        sessionId: String,
        sessionsRepository: any SessionsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        restTimer: RestTimerController,
        onSessionStarted: @escaping (String) -> Void,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(
            wrappedValue: SessionDetailViewModel(sessionId: sessionId, repository: sessionsRepository)
        )
        self.sessionsRepository = sessionsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.restTimer = restTimer
        self.onSessionStarted = onSessionStarted
        self.onDeleted = onDeleted
        self.onMutated = onMutated
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
        .navigationTitle(viewModel.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { sessionBottomActionToolbar }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .refreshable { await reloadAll() }
        .sheet(isPresented: $isShowingExercisePicker) {
            ExercisePickerView(
                repository: exercisesRepository,
                alreadySelected: Set(viewModel.session?.workoutSessionExercises.map(\.exercise.id) ?? []),
                confirmLabel: "Add"
            ) { exercises in
                Task {
                    if await viewModel.addExercises(exercises) {
                        isShowingExercisePicker = false
                        onMutated()
                    }
                }
            } onCancel: {
                isShowingExercisePicker = false
            }
        }
        .sheet(item: $editingSet) { state in
            StrengthSetEditorView(
                state: state,
                isPending: viewModel.mutationState.isLoading
            ) { reps, weight in
                Task {
                    let didSave: Bool
                    switch state.mode {
                    case let .add(workoutSessionExerciseId):
                        didSave = await viewModel.addStrengthSet(
                            workoutSessionExerciseId: workoutSessionExerciseId,
                            reps: reps,
                            weight: weight
                        )
                    case let .edit(set):
                        didSave = await viewModel.updateStrengthSet(id: set.id, reps: reps, weight: weight)
                    }
                    if didSave {
                        editingSet = nil
                        onMutated()
                    }
                }
            } onDelete: {
                guard case let .edit(set) = state.mode else { return }
                Task {
                    if await viewModel.deleteStrengthSet(id: set.id) {
                        editingSet = nil
                        onMutated()
                    }
                }
            } onCancel: {
                editingSet = nil
            }
        }
        .sheet(item: $editingCardioEntry) { state in
            CardioMetricsFormView(
                state: state,
                isPending: viewModel.mutationState.isLoading
            ) { metrics in
                Task {
                    let didSave: Bool
                    switch state.mode {
                    case let .add(workoutSessionExerciseId):
                        didSave = await viewModel.addCardioEntry(
                            workoutSessionExerciseId: workoutSessionExerciseId,
                            metrics: metrics
                        )
                    case let .edit(entry):
                        didSave = await viewModel.updateCardioEntry(id: entry.id, metrics: metrics)
                    }
                    if didSave {
                        editingCardioEntry = nil
                        onMutated()
                    }
                }
            } onDelete: {
                guard case let .edit(entry) = state.mode else { return }
                Task {
                    if await viewModel.deleteCardioEntry(id: entry.id) {
                        editingCardioEntry = nil
                        onMutated()
                    }
                }
            } onCancel: {
                editingCardioEntry = nil
            }
        }
        .alert("Delete this session?", isPresented: $isConfirmingDelete) {
            Button("Delete session", role: .destructive) {
                Task {
                    if await viewModel.deleteSession() {
                        onDeleted()
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("All exercises, sets, and entries in this session will be permanently removed.")
        }
        .alert(item: $pendingRemoveExercise) { row in
            Alert(
                title: Text("Remove \(row.exercise.name)?"),
                message: Text(SessionDetailFormatters.removeExerciseMessage(row)),
                primaryButton: .destructive(Text("Remove")) {
                    Task {
                        if await viewModel.removeExercise(id: row.id) {
                            pendingRemoveExercise = nil
                            onMutated()
                        }
                    }
                },
                secondaryButton: .cancel { pendingRemoveExercise = nil }
            )
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading session") {
                AppLoadingStateView(title: "Loading session")
            }
        case .loading where viewModel.session == nil:
            SectionShell(title: "Loading session") {
                AppLoadingStateView(title: "Loading session")
            }
        case let .failed(message, _) where viewModel.session == nil:
            SectionShell(title: "Session") {
                AppErrorStateView(title: "Failed to load", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let session = viewModel.session {
                summary(session)
                if viewModel.totals.hasStrength {
                    strengthTotals(viewModel.totals)
                }
                exerciseSection(session)
                if let message = viewModel.mutationState.errorMessage ?? errorMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func summary(_ session: SessionDetailModel) -> some View {
        SectionShell(
            title: session.displayName,
            subtitle: session.workout.map { "Started from \($0.name)" } ?? "Ad-hoc session"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Button {
                    draftStartedAt = session.startedAtDate ?? Date()
                    isEditingStartedAt = true
                } label: {
                    Label(SessionDetailFormatters.fullDate(session.startedAtDate), systemImage: "calendar")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .sheet(isPresented: $isEditingStartedAt) {
                    SessionStartedAtEditorSheet(
                        startedAt: $draftStartedAt,
                        isSaving: viewModel.mutationState.isLoading,
                        onCancel: { isEditingStartedAt = false },
                        onSave: {
                            Task {
                                if await viewModel.updateStartedAt(draftStartedAt) {
                                    isEditingStartedAt = false
                                    onMutated()
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    private func strengthTotals(_ totals: SessionStrengthTotals) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            SessionStatCard(title: "Sets", value: "\(totals.sets)", systemImage: "number")
            SessionStatCard(title: "Reps", value: "\(totals.reps)", systemImage: "repeat")
            SessionStatCard(
                title: "Volume",
                value: "\(SessionDetailFormatters.volume(totals.volume)) kg",
                systemImage: "flame"
            )
        }
    }

    private func exerciseSection(_ session: SessionDetailModel) -> some View {
        SectionShell(title: "Exercises", subtitle: "Add or remove exercises for this session only.") {
            if session.workoutSessionExercises.isEmpty {
                AppEmptyStateView(
                    title: "No exercises yet",
                    message: "Use Add exercise to build this session.",
                    systemImage: "dumbbell"
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(session.workoutSessionExercises) { row in
                        sessionExerciseRow(row, lastRowId: session.workoutSessionExercises.last?.id)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func sessionExerciseRow(_ row: SessionExerciseRow, lastRowId: String?) -> some View {
        SessionExerciseCard(
            row: row,
            priorStrengthEntries: viewModel.priorStrengthByExercise[row.exercise.id] ?? [],
            priorCardioEntries: viewModel.priorCardioByExercise[row.exercise.id] ?? [],
            exercisesRepository: exercisesRepository,
            storageBaseURL: storageBaseURL,
            onSessionStarted: onSessionStarted,
            onRemove: { pendingRemoveExercise = row },
            onAddSet: { startAddingSet(for: row) },
            onEditSet: { startEditingSet($0, for: row) },
            onAddCardioEntry: { startAddingCardioEntry(schema: $0, for: row) },
            onEditCardioEntry: { startEditingCardioEntry($0, schema: $1, for: row) }
        )
        if row.id != lastRowId { Divider() }
    }

    private func startAddingSet(for row: SessionExerciseRow) {
        let priorEntries = viewModel.priorStrengthByExercise[row.exercise.id] ?? []
        editingSet = StrengthSetEditorState.add(
            workoutSessionExerciseId: row.id,
            exerciseName: row.exercise.name,
            nextSetNumber: StrengthSetNumbering.nextSetNumber(currentSets: row.workoutSessionStrengthSets),
            previousSet: StrengthSetSeeding.seedSet(
                currentSets: row.workoutSessionStrengthSets,
                priorEntries: priorEntries
            ),
            doubleWeight: row.exercise.doubleWeight
        )
    }

    private func startEditingSet(_ set: SessionStrengthSet, for row: SessionExerciseRow) {
        editingSet = StrengthSetEditorState.edit(
            set: set,
            exerciseName: row.exercise.name,
            doubleWeight: row.exercise.doubleWeight
        )
    }

    private func startAddingCardioEntry(schema: CardioMetricsSchema, for row: SessionExerciseRow) {
        editingCardioEntry = CardioEntryEditorState.add(
            workoutSessionExerciseId: row.id,
            exerciseName: row.exercise.name,
            schema: schema,
            nextEntryNumber: (row.workoutSessionCardioEntries.map(\.entryNumber).max() ?? 0) + 1,
            previousMetrics: row.workoutSessionCardioEntries.last?.metrics
        )
    }

    private func startEditingCardioEntry(
        _ entry: SessionCardioEntryShell,
        schema: CardioMetricsSchema,
        for row: SessionExerciseRow
    ) {
        editingCardioEntry = CardioEntryEditorState.edit(
            entry: entry,
            exerciseName: row.exercise.name,
            schema: schema
        )
    }

    @ToolbarContentBuilder
    private var sessionBottomActionToolbar: some ToolbarContent {
        SessionDetailBottomToolbar(
            isVisible: viewModel.session != nil,
            isMutating: viewModel.mutationState.isLoading,
            restTimer: restTimer,
            onAddExercise: { isShowingExercisePicker = true },
            onDelete: { isConfirmingDelete = true }
        )
    }

    private func reloadAll() async {
        await viewModel.load()
        onMutated()
    }
}

private struct SessionDetailBottomToolbar: ToolbarContent {
    let isVisible: Bool
    let isMutating: Bool
    let restTimer: RestTimerController
    let onAddExercise: () -> Void
    let onDelete: () -> Void

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            if isVisible {
                RestTimerToolbarControl(timer: restTimer)
                Spacer()
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                }
                .tint(NeoGymTheme.danger)
                .disabled(isMutating)
                .accessibilityLabel("Delete session")
                Spacer()
                Button(action: onAddExercise) {
                    Label("Add exercise", systemImage: "plus")
                }
                .fontWeight(.semibold)
                .disabled(isMutating)
            }
        }
    }
}

private struct SessionStartedAtEditorSheet: View {
    @Binding var startedAt: Date
    let isSaving: Bool
    let onCancel: () -> Void
    let onSave: () -> Void

    var body: some View {
        NavigationView {
            ScreenScaffold {
                GlassPanel(
                    cornerRadius: NeoGymTheme.radiusXL,
                    material: .regular,
                    tint: NeoGymTheme.glassStrongFill
                ) {
                    DatePicker(
                        "Started at",
                        selection: $startedAt,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .datePickerStyle(.graphical)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: 620)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            }
            .navigationTitle("Edit date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save", action: onSave)
                        .disabled(isSaving)
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}

private enum SessionDetailFormatters {
    static func removeExerciseMessage(_ row: SessionExerciseRow) -> String {
        let childCount = row.exercise.isCardio
            ? row.workoutSessionCardioEntries.count
            : row.workoutSessionStrengthSets.count
        guard childCount > 0 else { return "It will be removed from this session only." }
        let noun = row.exercise.isCardio
            ? (childCount == 1 ? "entry" : "entries")
            : (childCount == 1 ? "set" : "sets")
        return "\(childCount) logged \(noun) will be deleted with it. This can't be undone."
    }

    static func fullDate(_ date: Date?) -> String {
        guard let date else { return "Unknown date" }
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    static func volume(_ volume: Double) -> String {
        if volume >= 1_000 {
            return String(format: "%.1fk", volume / 1_000)
        }
        return String(format: "%.0f", volume)
    }
}

private struct SessionStatCard: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundColor(NeoGymTheme.mutedText)
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingMD)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusLG,
            material: .ultraThin,
            tint: NeoGymTheme.glassFill,
            shadow: false
        )
    }
}

private struct SessionExerciseCard: View {
    let row: SessionExerciseRow
    let priorStrengthEntries: [SessionPriorStrengthEntry]
    let priorCardioEntries: [SessionPriorCardioEntry]
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void
    let onRemove: () -> Void
    let onAddSet: () -> Void
    let onEditSet: (SessionStrengthSet) -> Void
    let onAddCardioEntry: (CardioMetricsSchema) -> Void
    let onEditCardioEntry: (SessionCardioEntryShell, CardioMetricsSchema) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                NavigationLink {
                    ExerciseDetailView(
                        exerciseId: row.exercise.id,
                        repository: exercisesRepository,
                        storageBaseURL: storageBaseURL,
                        onSessionStarted: onSessionStarted
                    )
                } label: {
                    AlternatingStorageImageView(
                        urls: [
                            URL.nhostStorageFile(baseURL: storageBaseURL, fileId: row.exercise.image1FileId),
                            URL.nhostStorageFile(baseURL: storageBaseURL, fileId: row.exercise.image2FileId)
                        ].compactMap { $0 },
                        aspectRatio: 1
                    )
                    .frame(width: 54, height: 54)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 2) {
                    NavigationLink {
                        ExerciseDetailView(
                            exerciseId: row.exercise.id,
                            repository: exercisesRepository,
                            storageBaseURL: storageBaseURL,
                            onSessionStarted: onSessionStarted
                        )
                    } label: {
                        Text(row.exercise.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.primary)
                    }
                    Text(ExerciseFormatters.enumValue(row.exercise.primaryMuscleGroup))
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                Spacer()
                if row.exercise.isCardio {
                    Text("Cardio")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(.accentColor)
                } else if row.exercise.doubleWeight {
                    Text("Per side")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(.accentColor)
                }
                Button(action: onRemove) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                }
                .buttonStyle(.plain)
                .foregroundColor(.red)
                .accessibilityLabel("Remove \(row.exercise.name) from session")
            }

            if row.exercise.isCardio {
                if let schema = row.exercise.cardioSchema {
                    CardioEntriesListView(
                        entries: row.workoutSessionCardioEntries,
                        schema: schema,
                        onSelect: { onEditCardioEntry($0, schema) }
                    )
                    CardioPriorSummary(entries: priorCardioEntries, schema: schema)
                    Button { onAddCardioEntry(schema) } label: {
                        Label("Add entry", systemImage: "plus")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                } else {
                    CardioMissingSchemaNotice()
                }
            } else {
                StrengthSetsList(
                    sets: row.workoutSessionStrengthSets,
                    doubleWeight: row.exercise.doubleWeight,
                    onEdit: onEditSet
                )
                StrengthPriorSummary(entries: priorStrengthEntries, doubleWeight: row.exercise.doubleWeight)
                Button(action: onAddSet) {
                    Label("Add set", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
            }
        }
        .padding(.vertical, 12)
    }
}

private struct StrengthSetsList: View {
    let sets: [SessionStrengthSet]
    let doubleWeight: Bool
    let onEdit: (SessionStrengthSet) -> Void

    var body: some View {
        if sets.isEmpty {
            Text("No sets logged yet.")
                .font(.caption.italic())
                .foregroundColor(NeoGymTheme.mutedText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
        } else {
            VStack(spacing: 0) {
                ForEach(sets) { set in
                    Button { onEdit(set) } label: {
                        HStack(spacing: 12) {
                            Text("\(set.setNumber)")
                                .font(.caption.weight(.bold))
                                .frame(width: 28, height: 28)
                                .glassSurface(
                                    cornerRadius: NeoGymTheme.radiusPill,
                                    material: .ultraThin,
                                    tint: NeoGymTheme.glassSubtleFill,
                                    shadow: false
                                )
                            Text(Self.setText(set, doubleWeight: doubleWeight))
                                .font(.subheadline.monospacedDigit())
                                .foregroundColor(.primary)
                            Spacer()
                            Text("\(Self.formatVolume(set.volume * (doubleWeight ? 2 : 1))) kg")
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    if set.id != sets.last?.id { Divider() }
                }
            }
            .padding(.horizontal, NeoGymTheme.spacingXS)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: NeoGymTheme.glassSubtleFill,
                shadow: false
            )
        }
    }

    private static func setText(_ set: SessionStrengthSet, doubleWeight: Bool) -> String {
        StrengthSetFormatting.setSummary(set, doubleWeight: doubleWeight, includeSideSuffix: true)
    }

    private static func formatVolume(_ volume: Double) -> String {
        volume.rounded() == volume ? String(format: "%.0f", volume) : String(format: "%.1f", volume)
    }
}
