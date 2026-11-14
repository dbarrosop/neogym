import Foundation
import XCTest
@testable import NeoGymKit

@MainActor
final class SessionDetailReloadTests: XCTestCase {
    func testInsertStartsRestBeforeReloadFinishesEvenWhenReloadFails() async throws {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        await model.load()
        let requested = expectation(description: "post-insert detail reload")
        await repository.holdNextDetail { requested.fulfill() }
        let suite = "SessionDetailReloadTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        var now = Date(timeIntervalSince1970: 1_800_000_000)
        let timer = RestTimerController(ownerId: "owner", defaults: defaults, effects: ReloadTimerEffects(), now: { now })
        defer { timer.cancel() }
        var insertCount = 0
        var completed = false

        let save = Task {
            let result = await model.addStrengthSet(workoutSessionExerciseId: "row-bench", reps: 8, weight: 50) {
                insertCount += 1
                timer.start(seconds: 90, sessionId: model.sessionId)
            }
            completed = true
            return result
        }
        await fulfillment(of: [requested], timeout: 5)

        XCTAssertEqual(insertCount, 1)
        XCTAssertTrue(timer.isRunning)
        XCTAssertEqual(timer.schedule?.endDate, now.addingTimeInterval(90))
        XCTAssertEqual(timer.schedule?.sessionId, "current")
        XCTAssertTrue(model.mutationState.isLoading, "Editor Save must remain disabled until set numbering reloads")
        XCTAssertFalse(completed)
        now = now.addingTimeInterval(15)
        await repository.finishDetail(throwing: GraphQLDomainError.missingData(operationName: "SessionDetail"))
        let didSave = await save.value

        XCTAssertTrue(didSave, "A failed refresh must not turn a recorded insert into a failed save")
        XCTAssertEqual(insertCount, 1)
        XCTAssertEqual(timer.schedule?.endDate, now.addingTimeInterval(75))
        XCTAssertFalse(model.mutationState.isLoading)
        XCTAssertNotNil(model.state.errorMessage)
    }

    func testFailedInsertDoesNotStartRestOrReload() async {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        await model.load()
        await repository.failInsert()
        var insertCount = 0

        let didSave = await model.addStrengthSet(workoutSessionExerciseId: "row-bench", reps: 8, weight: 50) {
            insertCount += 1
        }
        let counts = await repository.counts()

        XCTAssertFalse(didSave)
        XCTAssertEqual(insertCount, 0)
        XCTAssertEqual(counts.detail, 1)
        XCTAssertNotNil(model.mutationState.errorMessage)
    }

    func testSetAndCardioMutationsReuseHistoryUntilExplicitRefresh() async {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        await model.load()

        let added = await model.addStrengthSet(workoutSessionExerciseId: "row-bench", reps: 8, weight: 50)
        let updated = await model.updateStrengthSet(id: "set", reps: 9, weight: 50)
        let deleted = await model.deleteStrengthSet(id: "set")
        let cardio = await model.updateCardioEntry(id: "entry", metrics: ["duration_s": 700])
        let reused = await repository.counts()
        XCTAssertTrue(added && updated && deleted && cardio)
        XCTAssertEqual(reused.detail, 5)
        XCTAssertEqual(reused.history, 1)
        XCTAssertEqual(reused.workout, 1)

        await model.load(refreshComparisons: true)
        let refreshed = await repository.counts()
        XCTAssertEqual(refreshed.history, 2)
        XCTAssertEqual(refreshed.workout, 2)
    }

    func testHistoryKeyTracksExercisesStartWorkoutAndSessionButNotExerciseOrder() async throws {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        await model.load()
        await repository.setDetail(reloadDetail(exerciseIds: ["row", "bench", "bench"]))
        await model.load()
        let reordered = await repository.counts()
        XCTAssertEqual(reordered.history, 1, "Reordering or repeating an exercise does not change its prior history")

        await repository.setDetail(reloadDetail(exerciseIds: ["bench", "row", "squat"]))
        let added = await model.addExercises([
            ExerciseListItem(id: "squat", name: "Squat", primaryMuscleGroup: "quadriceps", isPublic: true)
        ])
        XCTAssertTrue(added)
        let afterAdding = await repository.historyRequestsSnapshot()
        XCTAssertEqual(afterAdding.count, 2)
        XCTAssertEqual(afterAdding.last?.exerciseIds, ["bench", "row", "squat"])

        await repository.setDetail(reloadDetail())
        let removed = await model.removeExercise(id: "row-squat")
        XCTAssertTrue(removed)
        let afterRemoving = await repository.counts()
        XCTAssertEqual(afterRemoving.history, 3)

        let changedDate = "2026-11-13T06:00:00Z"
        let date = try XCTUnwrap(ExerciseDateParser.parseTimestamp(changedDate))
        let updated = await model.updateStartedAt(date)
        XCTAssertTrue(updated)
        let afterDate = await repository.historyRequestsSnapshot()
        XCTAssertEqual(afterDate.count, 4)
        XCTAssertEqual(afterDate.last?.before, date)

        await repository.setDetail(reloadDetail(startedAt: changedDate, workoutId: nil))
        await model.load()
        let afterWorkout = await repository.historyRequestsSnapshot()
        XCTAssertEqual(afterWorkout.count, 5)
        XCTAssertNil(afterWorkout.last?.workoutId)

        await repository.setDetail(reloadDetail(id: "replacement", startedAt: changedDate, workoutId: nil))
        await model.load()
        let afterIdentity = await repository.historyRequestsSnapshot()
        XCTAssertEqual(afterIdentity.count, 6)
        XCTAssertEqual(afterIdentity.last?.excludeSessionId, "replacement")
    }

    func testEmptyOrMissingSessionInvalidatesHistoryReuse() async {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        await model.load()
        for absent in [reloadDetail(exerciseIds: []), nil] {
            await repository.setDetail(absent)
            await model.load()
            XCTAssertEqual(model.priorHistoryState.value, SessionPriorHistory())
            await repository.setDetail(reloadDetail())
            await model.load()
        }
        let counts = await repository.counts()
        XCTAssertEqual(counts.history, 3)
    }

    func testFailedOrCancelledForcedHistoryRefreshKeepsFallbackButRetries() async {
        let errors: [Error] = [
            GraphQLDomainError.missingData(operationName: "PriorSessionsPerExercise"),
            GraphQLDomainError.transport("The operation couldn't be completed. (Swift.CancellationError error 1.)")
        ]
        for error in errors {
            let repository = ReloadSessionsRepository()
            let model = SessionDetailViewModel(sessionId: "current", repository: repository)
            await model.load()
            let original = model.priorHistoryState.value
            await repository.setHistoryError(error)

            await model.load(refreshComparisons: true)
            XCTAssertEqual(model.priorHistoryState.value, original)
            XCTAssertEqual(model.session?.id, "current")
            if GraphQLDomainError.isCancellation(error) { XCTAssertNil(model.priorHistoryState.errorMessage) }
            await repository.setHistoryError(nil)
            await model.load()

            let counts = await repository.counts()
            XCTAssertEqual(counts.history, 3, "Retained fallback is not a successful refresh key")
            XCTAssertNil(model.priorHistoryState.errorMessage)
        }
    }

    func testCancelledTaskCannotPublishSuccessfulHistoryOrMarkItReusable() async {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        await model.load()
        let original = model.priorHistoryState.value
        let requested = expectation(description: "forced history refresh")
        await repository.holdNextHistory { requested.fulfill() }
        let refresh = Task { await model.load(refreshComparisons: true) }
        await fulfillment(of: [requested], timeout: 5)

        refresh.cancel()
        // The fake deliberately ignores cancellation, like a late transport response.
        await repository.finishHistory(reloadHistory("cancelled"))
        await refresh.value
        XCTAssertEqual(model.priorHistoryState.value, original)
        XCTAssertNil(model.priorHistoryState.errorMessage)
        await model.load()
        let counts = await repository.counts()
        XCTAssertEqual(counts.history, 3)
    }

    func testSupersededHistoryCannotReplaceNewerHistoryOrItsReuseKey() async {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        let requested = expectation(description: "old history")
        await repository.holdNextHistory { requested.fulfill() }
        let oldLoad = Task { await model.load() }
        await fulfillment(of: [requested], timeout: 5)

        let newer = reloadDetail(startedAt: "2026-11-13T06:00:00Z", workoutId: nil)
        await repository.setDetail(newer)
        await model.load()
        let currentHistory = model.priorHistoryState.value
        await repository.finishHistory(reloadHistory("superseded"))
        await oldLoad.value

        XCTAssertEqual(model.session, newer)
        XCTAssertEqual(model.priorHistoryState.value, currentHistory)
        await model.load()
        let counts = await repository.counts()
        XCTAssertEqual(counts.history, 2)
        XCTAssertEqual(counts.workout, 0, "Superseded history must not start obsolete workout comparisons")
    }

    func testSupersededDetailCannotStartObsoleteHistoryRequests() async {
        let repository = ReloadSessionsRepository()
        let model = SessionDetailViewModel(sessionId: "current", repository: repository)
        let requested = expectation(description: "old detail")
        await repository.holdNextDetail { requested.fulfill() }
        let oldLoad = Task { await model.load() }
        await fulfillment(of: [requested], timeout: 5)

        let newer = reloadDetail(startedAt: "2026-11-13T06:00:00Z")
        await repository.setDetail(newer)
        await model.load()
        await repository.finishDetail()
        await oldLoad.value

        XCTAssertEqual(model.session, newer)
        let requests = await repository.historyRequestsSnapshot()
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.before, newer.startedAtDate)
    }

    func testBothAppAddPathsStartRestAndInvalidateAtInsertButKeepInlineDraftCleanupAfterReload() throws {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let inline = try String(contentsOf: root.appendingPathComponent("App/Train/SessionDetailView.swift"), encoding: .utf8)
        let editor = try String(contentsOf: root.appendingPathComponent("App/Train/SessionDetailSheets.swift"), encoding: .utf8)
        for source in [inline, editor] {
            XCTAssertNotNil(source.range(
                of: #"(?s)onInserted: \{\s*restTimer\.start\(.*?\)\s*onMutated\(\)\s*\}"#,
                options: .regularExpression
            ))
        }
        XCTAssertNotNil(inline.range(
            of: #"(?s)defer \{ loggingRowId = nil \}.*?await viewModel\.addStrengthSet.*?if didSave \{\s*drafts\[row\.id\] = NextSetDraft\.remainingAfterLogging"#,
            options: .regularExpression
        ))
    }
}

private func reloadDetail(
    id: String = "current",
    startedAt: String = "2026-11-12T06:00:00Z",
    workoutId: String? = "workout",
    exerciseIds: [String] = ["bench", "row"]
) -> SessionDetailModel {
    SessionDetailModel(
        id: id, startedAt: startedAt,
        workout: workoutId.map { SessionWorkout(id: $0, name: $0) },
        workoutSessionExercises: exerciseIds.enumerated().map { index, id in
            SessionExerciseRow(
                id: "row-\(id)", position: index,
                exercise: SessionExerciseDetail(id: id, name: id, kind: "strength", primaryMuscleGroup: "chest")
            )
        }
    )
}

private func reloadHistory(_ id: String) -> SessionPriorHistory {
    SessionPriorHistory(exercises: [SessionPriorExerciseHistory(id: id)])
}

@MainActor
private final class ReloadTimerEffects: RestTimerEffects {
    func schedule(_ schedule: RestTimerSchedule) {}
    func cancel() {}
    func finish() {}
}

private actor ReloadSessionsRepository: SessionsRepositoryProtocol {
    struct HistoryRequest: Sendable {
        let exerciseIds: [String]
        let before: Date
        let workoutId: String?
        let excludeSessionId: String
    }

    private var detail: SessionDetailModel? = reloadDetail()
    private var detailCount = 0
    private var workoutCount = 0
    private var historyRequests: [HistoryRequest] = []
    private var historyError: Error?
    private var insertFails = false
    private var detailHold: (@Sendable () -> Void)?
    private var historyHold: (@Sendable () -> Void)?
    private var pendingDetail: CheckedContinuation<SessionDetailModel?, Error>?
    private var pendingHistory: CheckedContinuation<SessionPriorHistory, Error>?
    private var heldDetail: SessionDetailModel?

    func setDetail(_ value: SessionDetailModel?) { detail = value }
    func setHistoryError(_ error: Error?) { historyError = error }
    func failInsert() { insertFails = true }
    func counts() -> (detail: Int, history: Int, workout: Int) { (detailCount, historyRequests.count, workoutCount) }
    func historyRequestsSnapshot() -> [HistoryRequest] { historyRequests }
    func holdNextDetail(_ onRequest: @escaping @Sendable () -> Void) { detailHold = onRequest }
    func holdNextHistory(_ onRequest: @escaping @Sendable () -> Void) { historyHold = onRequest }

    func finishDetail(throwing error: Error? = nil) {
        if let error { pendingDetail?.resume(throwing: error) } else { pendingDetail?.resume(returning: heldDetail) }
        pendingDetail = nil
    }

    func finishHistory(_ history: SessionPriorHistory) {
        pendingHistory?.resume(returning: history)
        pendingHistory = nil
    }

    func listSessions(limit: Int, offset: Int) async throws -> [SessionListItem] { [] }

    func sessionDetail(id: String) async throws -> SessionDetailModel? {
        detailCount += 1
        if let onRequest = detailHold {
            detailHold = nil
            heldDetail = detail
            return try await withCheckedThrowingContinuation {
                pendingDetail = $0
                onRequest()
            }
        }
        return detail
    }

    func priorSessionsPerExercise(
        exerciseIds: [String], before: Date, workoutId: String?, excludeSessionId: String
    ) async throws -> SessionPriorHistory {
        historyRequests.append(HistoryRequest(
            exerciseIds: exerciseIds, before: before, workoutId: workoutId, excludeSessionId: excludeSessionId
        ))
        if let onRequest = historyHold {
            historyHold = nil
            return try await withCheckedThrowingContinuation {
                pendingHistory = $0
                onRequest()
            }
        }
        if let historyError { throw historyError }
        return reloadHistory("fresh")
    }

    func priorWorkoutSessions(workoutId: String, before: Date, excludeSessionId: String) async throws -> [SessionDetailModel] {
        workoutCount += 1
        return []
    }

    func updateStartedAt(sessionId: String, startedAt: Date) async throws {
        guard let detail else { return }
        self.detail = SessionDetailModel(
            id: detail.id, startedAt: ISO8601DateFormatter().string(from: startedAt), workout: detail.workout,
            workoutSessionExercises: detail.workoutSessionExercises
        )
    }

    func deleteSession(id: String) async throws {}
    func addSessionExercises(sessionId: String, exercises: [ExerciseListItem], basePosition: Int) async throws {}
    func removeSessionExercise(id: String) async throws {}
    func addStrengthSet(workoutSessionExerciseId: String, setNumber: Int, reps: Int, weight: Double) async throws -> String {
        if insertFails { throw GraphQLDomainError.missingData(operationName: "InsertWorkoutSessionStrengthSet") }
        return "set"
    }
    func updateStrengthSet(id: String, reps: Int, weight: Double) async throws {}
    func deleteStrengthSet(id: String) async throws {}
    func addCardioEntry(workoutSessionExerciseId: String, entryNumber: Int, metrics: CardioMetrics) async throws -> String { "entry" }
    func updateCardioEntry(id: String, metrics: CardioMetrics) async throws {}
    func deleteCardioEntry(id: String) async throws {}
}
