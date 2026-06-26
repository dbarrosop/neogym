import NeoGymKit
import SwiftUI

struct SessionsNavigationView: View {
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    @Binding var pendingSessionId: String?

    var body: some View {
        NavigationView {
            SessionsListView(
                sessionsRepository: sessionsRepository,
                exercisesRepository: exercisesRepository,
                storageBaseURL: storageBaseURL,
                pendingSessionId: $pendingSessionId
            )
        }
        .navigationViewStyle(.stack)
    }
}

struct SessionsListView: View {
    @StateObject private var viewModel: SessionsListViewModel
    let sessionsRepository: any SessionsRepositoryProtocol
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    @Binding var pendingSessionId: String?

    @State private var navigatedSessionId: String?
    @State private var isNavigatingToPendingSession = false

    init(
        sessionsRepository: any SessionsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        pendingSessionId: Binding<String?>
    ) {
        _viewModel = StateObject(wrappedValue: SessionsListViewModel(repository: sessionsRepository))
        self.sessionsRepository = sessionsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        _pendingSessionId = pendingSessionId
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .navigationTitle("Sessions")
        .background(pendingNavigationLink)
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
            consumePendingSessionId()
        }
        .onChange(of: pendingSessionId) { _ in consumePendingSessionId() }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("History")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text("Sessions")
                .font(.largeTitle.bold())
                .tracking(-0.8)
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
                                    NavigationLink {
                                        SessionDetailView(
                                            sessionId: session.id,
                                            sessionsRepository: sessionsRepository,
                                            exercisesRepository: exercisesRepository,
                                            storageBaseURL: storageBaseURL,
                                            onDeleted: { Task { await viewModel.load() } },
                                            onMutated: { Task { await viewModel.load() } }
                                        )
                                    } label: {
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

    @ViewBuilder
    private var pendingNavigationLink: some View {
        if let sessionId = navigatedSessionId {
            NavigationLink(
                destination: SessionDetailView(
                    sessionId: sessionId,
                    sessionsRepository: sessionsRepository,
                    exercisesRepository: exercisesRepository,
                    storageBaseURL: storageBaseURL,
                    onDeleted: { Task { await viewModel.load() } },
                    onMutated: { Task { await viewModel.load() } }
                ),
                isActive: $isNavigatingToPendingSession
            ) {
                EmptyView()
            }
            .hidden()
        }
    }

    private func consumePendingSessionId() {
        guard let id = pendingSessionId else { return }
        navigatedSessionId = id
        isNavigatingToPendingSession = true
        pendingSessionId = nil
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
        .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var isEditingStartedAt = false
    @State private var draftStartedAt = Date()
    @State private var isShowingExercisePicker = false
    @State private var isConfirmingDelete = false
    @State private var pendingRemoveExercise: SessionExerciseRow?
    @State private var editingSet: StrengthSetEditorState?
    @State private var errorMessage: String?

    init(
        sessionId: String,
        sessionsRepository: any SessionsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        storageBaseURL: URL,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: SessionDetailViewModel(sessionId: sessionId, repository: sessionsRepository))
        self.sessionsRepository = sessionsRepository
        self.exercisesRepository = exercisesRepository
        self.storageBaseURL = storageBaseURL
        self.onDeleted = onDeleted
        self.onMutated = onMutated
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
        .navigationTitle(viewModel.displayName)
        .navigationBarTitleDisplayMode(.inline)
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
                message: Text(removeExerciseMessage(row)),
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
                deleteSection
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
        SectionShell(title: session.displayName, subtitle: session.workout.map { "Started from \($0.name)" } ?? "Ad-hoc session") {
            VStack(alignment: .leading, spacing: 12) {
                Button {
                    draftStartedAt = session.startedAtDate ?? Date()
                    isEditingStartedAt = true
                } label: {
                    Label(Self.fullDate(session.startedAtDate), systemImage: "calendar")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .sheet(isPresented: $isEditingStartedAt) {
                    NavigationView {
                        VStack(alignment: .leading, spacing: 16) {
                            DatePicker("Started at", selection: $draftStartedAt, displayedComponents: [.date, .hourAndMinute])
                                .datePickerStyle(.graphical)
                            Spacer()
                        }
                        .padding(20)
                        .navigationTitle("Edit date")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Cancel") { isEditingStartedAt = false }
                            }
                            ToolbarItem(placement: .confirmationAction) {
                                Button(viewModel.mutationState.isLoading ? "Saving…" : "Save") {
                                    Task {
                                        if await viewModel.updateStartedAt(draftStartedAt) {
                                            isEditingStartedAt = false
                                            onMutated()
                                        }
                                    }
                                }
                                .disabled(viewModel.mutationState.isLoading)
                            }
                        }
                    }
                    .navigationViewStyle(.stack)
                }
            }
        }
    }

    private func strengthTotals(_ totals: SessionStrengthTotals) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            SessionStatCard(title: "Sets", value: "\(totals.sets)", systemImage: "number")
            SessionStatCard(title: "Reps", value: "\(totals.reps)", systemImage: "repeat")
            SessionStatCard(title: "Volume", value: "\(Self.formatVolume(totals.volume)) kg", systemImage: "flame")
        }
    }

    private func exerciseSection(_ session: SessionDetailModel) -> some View {
        SectionShell(title: "Exercises", subtitle: "Add or remove exercises for this session only.") {
            VStack(spacing: 0) {
                ForEach(session.workoutSessionExercises) { row in
                    SessionExerciseCard(
                        row: row,
                        exercisesRepository: exercisesRepository,
                        storageBaseURL: storageBaseURL,
                        onSessionStarted: { _ in },
                        onRemove: { pendingRemoveExercise = row },
                        onAddSet: {
                            editingSet = StrengthSetEditorState.add(
                                workoutSessionExerciseId: row.id,
                                exerciseName: row.exercise.name,
                                nextSetNumber: (row.workoutSessionStrengthSets.map(\.setNumber).max() ?? 0) + 1,
                                previousSet: row.workoutSessionStrengthSets.last,
                                doubleWeight: row.exercise.doubleWeight
                            )
                        },
                        onEditSet: { set in
                            editingSet = StrengthSetEditorState.edit(
                                set: set,
                                exerciseName: row.exercise.name,
                                doubleWeight: row.exercise.doubleWeight
                            )
                        }
                    )
                    if row.id != session.workoutSessionExercises.last?.id { Divider() }
                }
                Button {
                    isShowingExercisePicker = true
                } label: {
                    Label("Add exercise", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .padding(.top, session.workoutSessionExercises.isEmpty ? 0 : 12)
            }
        }
    }

    private var deleteSection: some View {
        Button(role: .destructive) {
            isConfirmingDelete = true
        } label: {
            Label("Delete session", systemImage: "trash")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(NeoGymSecondaryButtonStyle())
        .tint(.red)
    }

    private func reloadAll() async {
        await viewModel.load()
        onMutated()
    }

    private func removeExerciseMessage(_ row: SessionExerciseRow) -> String {
        let childCount = row.exercise.isCardio ? row.workoutSessionCardioEntries.count : row.workoutSessionStrengthSets.count
        guard childCount > 0 else { return "It will be removed from this session only." }
        let noun = row.exercise.isCardio ? (childCount == 1 ? "entry" : "entries") : (childCount == 1 ? "set" : "sets")
        return "\(childCount) logged \(noun) will be deleted with it. This can't be undone."
    }

    private static func fullDate(_ date: Date?) -> String {
        guard let date else { return "Unknown date" }
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private static func formatVolume(_ volume: Double) -> String {
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
        .padding(14)
        .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(NeoGymTheme.border))
    }
}

private struct SessionExerciseCard: View {
    let row: SessionExerciseRow
    let exercisesRepository: any ExercisesRepositoryProtocol
    let storageBaseURL: URL
    var onSessionStarted: (String) -> Void
    let onRemove: () -> Void
    let onAddSet: () -> Void
    let onEditSet: (SessionStrengthSet) -> Void

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
                CardioPhasePlaceholder(entryCount: row.workoutSessionCardioEntries.count)
            } else {
                StrengthSetsList(
                    sets: row.workoutSessionStrengthSets,
                    doubleWeight: row.exercise.doubleWeight,
                    onEdit: onEditSet
                )
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
                                .background(NeoGymTheme.mutedFill, in: Circle())
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
            .padding(.horizontal, 10)
            .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private static func setText(_ set: SessionStrengthSet, doubleWeight: Bool) -> String {
        let weight = set.weight == 0 ? "BW" : "\(formatWeight(set.weight)) kg"
        return weight + " × \(set.reps)" + (doubleWeight && set.weight > 0 ? " /side" : "")
    }

    private static func formatWeight(_ weight: Double) -> String {
        weight.rounded() == weight ? String(format: "%.0f", weight) : String(format: "%.1f", weight)
    }

    private static func formatVolume(_ volume: Double) -> String {
        volume.rounded() == volume ? String(format: "%.0f", volume) : String(format: "%.1f", volume)
    }
}

private struct CardioPhasePlaceholder: View {
    let entryCount: Int

    var body: some View {
        Text(
            entryCount == 0
                ? "Cardio logging arrives in Phase 6. You can still keep or remove this exercise."
                : "\(entryCount) cardio entr\(entryCount == 1 ? "y is" : "ies are") visible; editing arrives in Phase 6."
        )
        .font(.caption)
        .foregroundColor(NeoGymTheme.mutedText)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct StrengthSetEditorState: Identifiable {
    enum Mode {
        case add(workoutSessionExerciseId: String)
        case edit(SessionStrengthSet)
    }

    let id = UUID()
    let mode: Mode
    let exerciseName: String
    let nextSetNumber: Int
    let previousSet: SessionStrengthSet?
    let doubleWeight: Bool

    static func add(
        workoutSessionExerciseId: String,
        exerciseName: String,
        nextSetNumber: Int,
        previousSet: SessionStrengthSet?,
        doubleWeight: Bool
    ) -> StrengthSetEditorState {
        StrengthSetEditorState(
            mode: .add(workoutSessionExerciseId: workoutSessionExerciseId),
            exerciseName: exerciseName,
            nextSetNumber: nextSetNumber,
            previousSet: previousSet,
            doubleWeight: doubleWeight
        )
    }

    static func edit(set: SessionStrengthSet, exerciseName: String, doubleWeight: Bool) -> StrengthSetEditorState {
        StrengthSetEditorState(
            mode: .edit(set),
            exerciseName: exerciseName,
            nextSetNumber: set.setNumber,
            previousSet: set,
            doubleWeight: doubleWeight
        )
    }
}

private struct StrengthSetEditorView: View {
    let state: StrengthSetEditorState
    let isPending: Bool
    let onSave: (Int, Double) -> Void
    let onDelete: () -> Void
    let onCancel: () -> Void

    @State private var reps: String
    @State private var weight: String
    @State private var errorMessage: String?

    init(
        state: StrengthSetEditorState,
        isPending: Bool,
        onSave: @escaping (Int, Double) -> Void,
        onDelete: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.state = state
        self.isPending = isPending
        self.onSave = onSave
        self.onDelete = onDelete
        self.onCancel = onCancel
        let seed = state.previousSet
        _reps = State(initialValue: seed.map { String($0.reps) } ?? "")
        _weight = State(initialValue: seed.map { Self.formatWeight($0.weight) } ?? "")
    }

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text(state.exerciseName)) {
                    TextField("Weight (kg)\(state.doubleWeight ? " · per side" : "")", text: $weight)
                        .keyboardType(.decimalPad)
                    TextField("Reps", text: $reps)
                        .keyboardType(.numberPad)
                }
                if state.doubleWeight {
                    Section {
                        Text("Volume counts both sides; enter the weight for one side to match the web app.")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundColor(.red)
                    }
                }
                if case .edit = state.mode {
                    Section {
                        Button("Delete set", role: .destructive, action: onDelete)
                            .disabled(isPending)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                        .disabled(isPending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isPending ? "Saving…" : "Save") { save() }
                        .disabled(isPending)
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private var title: String {
        switch state.mode {
        case .add:
            return "Add set \(state.nextSetNumber)"
        case let .edit(set):
            return "Edit set \(set.setNumber)"
        }
    }

    private func save() {
        switch SessionSetFormValidator.validate(repsText: reps, weightText: weight) {
        case let .success(reps, weight):
            errorMessage = nil
            onSave(reps, weight)
        case let .failure(message):
            errorMessage = message
        }
    }

    private static func formatWeight(_ weight: Double) -> String {
        weight.rounded() == weight ? String(format: "%.0f", weight) : String(format: "%.1f", weight)
    }
}
