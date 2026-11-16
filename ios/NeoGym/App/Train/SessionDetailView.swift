import NeoGymKit
import SwiftUI

/// Session logging: exercises are cards in session order. Finished exercises
/// collapse to one line; the active one lists its sets against last time and
/// an inline next-set row. Logging a set starts the shell's rest timer.
struct SessionDetailView: View {
    @StateObject var viewModel: SessionDetailViewModel
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    let restTimer: RestTimerController
    var onSessionStarted: (String) -> Void
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @State var isEditingStartedAt = false
    @State var draftStartedAt = AppClock.now()
    @State var isShowingExercisePicker = false
    @State var isConfirmingDelete = false
    @State var pendingRemoveExercise: SessionExerciseRow?
    @State var editingSet: StrengthSetEditorState?
    @State var editingCardioEntry: CardioEntryEditorState?
    /// Manual expand/collapse choices win over the default active exercise.
    @State var expandedOverrides: [String: Bool] = [:]
    @State var drafts: [String: NextSetDraft] = [:]
    @State var loggingRowId: String?

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
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.restTimer = restTimer
        self.onSessionStarted = onSessionStarted
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        attachSheets(to: screen)
    }

    private var screen: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle(viewModel.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .toolbar { addExerciseToolbar }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .onChange(of: viewModel.displayName, initial: true) { _, name in
            if viewModel.session != nil { restTimer.noteSession(id: viewModel.sessionId, name: name) }
        }
        .refreshable { await reloadAll() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading session")
        case .loading where viewModel.session == nil:
            AppLoadingStateView(title: "Loading session")
        case let .failed(message, _) where viewModel.session == nil:
            AppErrorStateView(title: "Couldn't load this session", message: message) {
                Task { await viewModel.load(refreshComparisons: true) }
            }
            .cardSurface()
        default:
            if let session = viewModel.session {
                loaded(session)
            }
        }
    }

    @ViewBuilder
    private func loaded(_ session: SessionDetailModel) -> some View {
        header(session)
        if viewModel.totals.hasStrength {
            SessionTotalsStrip(totals: viewModel.totals)
        }
        if let message = viewModel.mutationState.errorMessage {
            FeedbackBanner(message: message)
        }
        if session.workoutSessionExercises.isEmpty {
            AppEmptyStateView(
                title: "No exercises yet",
                message: "Add exercises to this session to start logging sets.",
                systemImage: "dumbbell",
                actionTitle: "Add exercise",
                action: { isShowingExercisePicker = true }
            )
        } else {
            let lastTimes = lastTimeByExercise(session)
            let activeId = SessionLogging.defaultActiveExerciseId(session: session, lastTimeByExercise: lastTimes)
            ForEach(Array(session.workoutSessionExercises.enumerated()), id: \.element.id) { index, row in
                exerciseCard(row, index: index, lastTime: lastTimes[row.exercise.id], isDefaultActive: row.id == activeId)
            }
        }
        if let workout = session.workout {
            SessionEarlierWorkoutSessions(
                workoutName: workout.name,
                sessions: viewModel.priorWorkoutSessions,
                state: viewModel.priorWorkoutState
            )
        }
        FormDeleteButton(
            title: "Delete session",
            isDisabled: viewModel.mutationState.isLoading,
            action: { isConfirmingDelete = true }
        )
        .padding(.top, NeoGymTheme.spacingXS)
    }

    private func header(_ session: SessionDetailModel) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
            Text(session.displayName)
                .font(.title2.weight(.bold))
                .foregroundStyle(NeoGymTheme.text)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: NeoGymTheme.spacingXS) {
                Text(startedCaption(session.startedAtDate))
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Button("Edit") {
                    draftStartedAt = session.startedAtDate ?? AppClock.now()
                    isEditingStartedAt = true
                }
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.accentText)
                .frame(minHeight: NeoGymTheme.minimumTapTarget)
                .accessibilityLabel("Edit start date and time")
            }
            if let workout = session.workout {
                NavigationLink(value: TrainRoute.workoutDetail(workout.id)) {
                    Text("From \(workout.name)")
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.accentText)
                }
                .accessibilityHint("Opens the workout")
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingXXS)
        .padding(.top, NeoGymTheme.spacingXS)
    }

    @ViewBuilder
    private func exerciseCard(
        _ row: SessionExerciseRow,
        index: Int,
        lastTime: SessionPriorStrengthEntry?,
        isDefaultActive: Bool
    ) -> some View {
        let isExpanded = expandedOverrides[row.id] ?? isDefaultActive
        let actions = SessionExerciseCardActions(
            toggle: { expandedOverrides[row.id] = !isExpanded },
            remove: { pendingRemoveExercise = row }
        )
        if row.exercise.isCardio {
            CardioExerciseCard(
                row: row,
                index: index,
                isExpanded: isExpanded,
                priorEntries: viewModel.priorCardioByExercise[row.exercise.id] ?? [],
                actions: actions,
                onAddEntry: { startAddingCardioEntry(schema: $0, for: row) },
                onEditEntry: { startEditingCardioEntry($0, schema: $1, for: row) }
            )
        } else {
            StrengthExerciseCard(
                row: row,
                index: index,
                isExpanded: isExpanded,
                lastTime: lastTime,
                recent: SessionLogging.recentSessions(viewModel.priorStrengthByExercise[row.exercise.id] ?? []),
                draft: draftBinding(for: row, lastTime: lastTime),
                isLogging: loggingRowId == row.id,
                isMutating: viewModel.mutationState.isLoading,
                actions: actions,
                onLog: { logSet(for: row) },
                onEditSet: { startEditingSet($0, for: row) },
                onEditDraft: { startAddingSet(for: row, seed: $0) }
            )
        }
    }

    @ToolbarContentBuilder
    private var addExerciseToolbar: some ToolbarContent {
        if viewModel.session != nil {
            AreaPrimaryAction(title: "Add exercise") {
                if !viewModel.mutationState.isLoading { isShowingExercisePicker = true }
            }
        }
    }

    private func startedCaption(_ date: Date?) -> String {
        guard let date else { return "Unknown date" }
        let sameYear = AppClock.calendar.isDate(date, equalTo: AppClock.now(), toGranularity: .year)
        var day = Date.FormatStyle.dateTime.weekday(.abbreviated).day().month(.abbreviated)
        if !sameYear { day = day.year() }
        return "\(date.formatted(day)) · started \(date.formatted(date: .omitted, time: .shortened))"
    }

    func reloadAll() async {
        await viewModel.load(refreshComparisons: true)
        onMutated()
    }
}

// MARK: - Logging

extension SessionDetailView {
    func lastTimeByExercise(_ session: SessionDetailModel) -> [String: SessionPriorStrengthEntry] {
        var result: [String: SessionPriorStrengthEntry] = [:]
        for row in session.workoutSessionExercises where !row.exercise.isCardio {
            result[row.exercise.id] = SessionLogging.lastTime(
                exerciseId: row.exercise.id,
                priorWorkoutSessions: viewModel.priorWorkoutSessions,
                exerciseHistory: viewModel.priorStrengthByExercise[row.exercise.id] ?? []
            )
        }
        return result
    }

    func draftBinding(for row: SessionExerciseRow, lastTime: SessionPriorStrengthEntry?) -> Binding<NextSetDraft> {
        Binding(
            get: {
                drafts[row.id] ?? NextSetDraft.suggested(currentSets: row.workoutSessionStrengthSets, lastTime: lastTime)
            },
            set: { drafts[row.id] = $0 }
        )
    }

    func logSet(for row: SessionExerciseRow) {
        guard loggingRowId == nil, let session = viewModel.session else { return }
        let lastTime = lastTimeByExercise(session)[row.exercise.id]
        let submittedDraft = drafts[row.id]
        let draft = submittedDraft ?? NextSetDraft.suggested(currentSets: row.workoutSessionStrengthSets, lastTime: lastTime)
        let nextNumber = StrengthSetNumbering.nextSetNumber(currentSets: row.workoutSessionStrengthSets)
        loggingRowId = row.id
        Task {
            defer { loggingRowId = nil }
            let didSave = await viewModel.addStrengthSet(
                workoutSessionExerciseId: row.id,
                reps: draft.reps,
                weight: draft.weight,
                onInserted: {
                    restTimer.start(label: "\(row.exercise.name) · set \(nextNumber + 1) next", sessionId: viewModel.sessionId)
                    onMutated()
                }
            )
            if didSave {
                drafts[row.id] = NextSetDraft.remainingAfterLogging(current: drafts[row.id], submitted: submittedDraft)
            }
        }
    }

    func startAddingSet(for row: SessionExerciseRow, seed: NextSetDraft) {
        editingSet = StrengthSetEditorState.add(
            workoutSessionExerciseId: row.id,
            exerciseName: row.exercise.name,
            nextSetNumber: StrengthSetNumbering.nextSetNumber(currentSets: row.workoutSessionStrengthSets),
            previousSet: SessionStrengthSet(id: "draft", setNumber: 0, reps: seed.reps, weight: seed.weight),
            doubleWeight: row.exercise.doubleWeight
        )
    }

    func startEditingSet(_ set: SessionStrengthSet, for row: SessionExerciseRow) {
        editingSet = StrengthSetEditorState.edit(
            set: set,
            exerciseName: row.exercise.name,
            doubleWeight: row.exercise.doubleWeight
        )
    }

    func startAddingCardioEntry(schema: CardioMetricsSchema, for row: SessionExerciseRow) {
        editingCardioEntry = CardioEntryEditorState.add(
            workoutSessionExerciseId: row.id,
            exerciseName: row.exercise.name,
            schema: schema,
            nextEntryNumber: (row.workoutSessionCardioEntries.map(\.entryNumber).max() ?? 0) + 1,
            previousMetrics: row.workoutSessionCardioEntries.last?.metrics
        )
    }

    func startEditingCardioEntry(_ entry: SessionCardioEntryShell, schema: CardioMetricsSchema, for row: SessionExerciseRow) {
        editingCardioEntry = CardioEntryEditorState.edit(entry: entry, exerciseName: row.exercise.name, schema: schema)
    }
}
