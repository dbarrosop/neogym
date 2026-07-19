import Foundation
import XCTest
@testable import NeoGymKit

final class SessionsRepositoryTests: XCTestCase {
    func testDecodesSessionsIndexPayload() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workoutSessions": .array([sessionListFixture])
        ]))])
        let repository = SessionsRepository(graphQL: fake)

        let sessions = try await repository.listSessions(limit: 25, offset: 0)

        XCTAssertEqual(sessions.count, 1)
        XCTAssertEqual(sessions[0].displayName, "Push Day")
        XCTAssertEqual(sessions[0].exerciseCount, 2)
        XCTAssertEqual(sessions[0].entryCount, 3)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.first?.operationName, "SessionsIndex")
        XCTAssertEqual(requests.first?.variables?["limit"], .number(25))
        XCTAssertEqual(requests.first?.variables?["offset"], .number(0))
    }

    func testDecodesSessionDetailAndStrengthTotals() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workoutSession": sessionDetailFixture
        ]))])
        let repository = SessionsRepository(graphQL: fake)

        let loadedSession = try await repository.sessionDetail(id: "session-1")
        let session = try XCTUnwrap(loadedSession)

        XCTAssertEqual(session.displayName, "Push Day")
        XCTAssertEqual(session.workoutSessionExercises.map(\.exercise.name), ["Bench Press", "Dumbbell Row", "Run"])
        XCTAssertEqual(session.strengthTotals.sets, 3)
        XCTAssertEqual(session.strengthTotals.reps, 22)
        XCTAssertEqual(session.strengthTotals.volume, 1_600)
    }

    func testPriorSessionsQueryDecodesAndExcludesCurrentSessionVariable() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "exercises": .array([priorExerciseFixture])
        ]))])
        let repository = SessionsRepository(graphQL: fake)

        let history = try await repository.priorSessionsPerExercise(
            exerciseIds: ["exercise-1"],
            excludeSessionId: "session-current"
        )

        let strength = try XCTUnwrap(history.strengthByExercise["exercise-1"]?.first)
        XCTAssertEqual(strength.sets.map { $0.reps }, [5])
        let cardio = try XCTUnwrap(history.cardioByExercise["exercise-1"]?.first)
        XCTAssertEqual(cardio.entries.first?.metrics["duration_s"], 600)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "PriorSessionsPerExercise")
        XCTAssertEqual(request.variables?["exerciseIds"], JSONValue.array([.string("exercise-1")]))
        XCTAssertEqual(request.variables?["excludeSessionId"], JSONValue.string("session-current"))
        XCTAssertTrue(request.query.contains("limit: 3"))
        XCTAssertTrue(request.query.contains("_neq: $excludeSessionId"))
    }

    func testSessionExerciseInsertVariablesOmitForbiddenColumnsAndDoNotUpdateExerciseId() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertWorkoutSessionExercises": .object(["affected_rows": .number(2)])
        ]))])
        let repository = SessionsRepository(graphQL: fake)

        try await repository.addSessionExercises(
            sessionId: "session-1",
            exercises: [pickerExercise(id: "exercise-1"), pickerExercise(id: "exercise-2")],
            basePosition: 2
        )

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "InsertWorkoutSessionExercises")
        XCTAssertFalse(request.query.contains("updateWorkoutSessionExercise"))
        let variables = try XCTUnwrap(request.variables)
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("kind"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("parentKind"))
        let objects = try XCTUnwrap(variables["objs"]?.arrayValue)
        XCTAssertEqual(objects.map { $0["workoutSessionId"] }, [.string("session-1"), .string("session-1")])
        XCTAssertEqual(objects.map { $0["exerciseId"] }, [.string("exercise-1"), .string("exercise-2")])
        XCTAssertEqual(objects.map { $0["position"] }, [.number(3), .number(4)])
    }

    func testStrengthSetMutationVariablesOmitForbiddenAndImmutableColumns() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["insertWorkoutSessionStrengthSet": .object(["id": .string("set-new")])])),
            .json(.object(["updateWorkoutSessionStrengthSet": .object(["id": .string("set-new")])])),
            .json(.object(["deleteWorkoutSessionStrengthSet": .object(["id": .string("set-new")])]))
        ])
        let repository = SessionsRepository(graphQL: fake)

        _ = try await repository.addStrengthSet(
            workoutSessionExerciseId: "wse-1",
            setNumber: 2,
            reps: 8,
            weight: 42.5
        )
        try await repository.updateStrengthSet(id: "set-new", reps: 9, weight: 45)
        try await repository.deleteStrengthSet(id: "set-new")

        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), [
            "InsertWorkoutSessionStrengthSet",
            "UpdateWorkoutSessionStrengthSet",
            "DeleteWorkoutSessionStrengthSet"
        ])
        for request in requests {
            let variables = JSONValue.object(request.variables ?? [:])
            XCTAssertFalse(variables.recursivelyContainsKey("userId"))
            XCTAssertFalse(variables.recursivelyContainsKey("kind"))
            XCTAssertFalse(variables.recursivelyContainsKey("parentKind"))
        }
        XCTAssertEqual(requests[0].variables?["obj"]?["workoutSessionExerciseId"], .string("wse-1"))
        XCTAssertEqual(requests[0].variables?["obj"]?["setNumber"], .number(2))
        XCTAssertEqual(requests[1].variables?["set"]?["reps"], .number(9))
        XCTAssertEqual(requests[1].variables?["set"]?["weight"], .number(45))
        XCTAssertNil(requests[1].variables?["set"]?["workoutSessionExerciseId"])
        XCTAssertNil(requests[1].variables?["set"]?["setNumber"])
    }

    func testCardioEntryMutationVariablesOmitParentKindAndImmutableColumns() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["insertWorkoutSessionCardioEntry": .object(["id": .string("entry-new")])])),
            .json(.object(["updateWorkoutSessionCardioEntry": .object(["id": .string("entry-new")])])),
            .json(.object(["deleteWorkoutSessionCardioEntry": .object(["id": .string("entry-new")])]))
        ])
        let repository = SessionsRepository(graphQL: fake)

        _ = try await repository.addCardioEntry(
            workoutSessionExerciseId: "wse-cardio",
            entryNumber: 2,
            metrics: ["duration_s": 900, "avg_hr_bpm": 142]
        )
        try await repository.updateCardioEntry(id: "entry-new", metrics: ["duration_s": 1_000])
        try await repository.deleteCardioEntry(id: "entry-new")

        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), [
            "InsertWorkoutSessionCardioEntry",
            "UpdateWorkoutSessionCardioEntry",
            "DeleteWorkoutSessionCardioEntry"
        ])
        for request in requests {
            let variables = JSONValue.object(request.variables ?? [:])
            XCTAssertFalse(variables.recursivelyContainsKey("userId"))
            XCTAssertFalse(variables.recursivelyContainsKey("kind"))
            XCTAssertFalse(variables.recursivelyContainsKey("parentKind"))
        }
        XCTAssertEqual(requests[0].variables?["obj"]?["workoutSessionExerciseId"], .string("wse-cardio"))
        XCTAssertEqual(requests[0].variables?["obj"]?["entryNumber"], .number(2))
        XCTAssertEqual(requests[0].variables?["obj"]?["metrics"]?["duration_s"], .number(900))
        XCTAssertEqual(requests[1].variables?["set"]?["metrics"]?["duration_s"], .number(1_000))
        XCTAssertNil(requests[1].variables?["set"]?["workoutSessionExerciseId"])
        XCTAssertNil(requests[1].variables?["set"]?["entryNumber"])
    }

    func testStartedAtAndDeleteVariablesAreScopedToAllowedColumns() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["updateWorkoutSession": .object(["id": .string("session-1")])])),
            .json(.object(["deleteWorkoutSession": .object(["id": .string("session-1")])]))
        ])
        let repository = SessionsRepository(graphQL: fake)
        let startedAt = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-06-26T12:00:00.000Z"))

        try await repository.updateStartedAt(sessionId: "session-1", startedAt: startedAt)
        try await repository.deleteSession(id: "session-1")

        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests[0].variables?["id"], .string("session-1"))
        XCTAssertEqual(requests[0].variables?["startedAt"], .string("2026-06-26T12:00:00.000Z"))
        XCTAssertFalse(JSONValue.object(requests[0].variables ?? [:]).recursivelyContainsKey("userId"))
        XCTAssertEqual(requests[1].variables, ["id": .string("session-1")])
    }
}

@MainActor
final class SessionsViewModelTests: XCTestCase {
    func testListGroupsSessionsByMonthAndUsesDisplayNames() async {
        let repository = StubSessionsRepository(sessions: [
            SessionListItem(
                id: "session-1",
                startedAt: "2026-06-26T12:00:00Z",
                workout: SessionWorkout(id: "workout-1", name: "Push Day"),
                workoutSessionExercises: []
            ),
            SessionListItem(
                id: "session-2",
                startedAt: "2026-06-20T12:00:00Z",
                workoutSessionExercises: [SessionListExerciseRow(exercise: SessionListExercise(id: "exercise-1", name: "Row"))]
            )
        ])
        let viewModel = SessionsListViewModel(repository: repository, pageSize: 25)

        await viewModel.load()

        XCTAssertEqual(viewModel.sessions.map(\.displayName), ["Push Day", "Row"])
        XCTAssertEqual(viewModel.monthGroups.count, 1)
        XCTAssertEqual(viewModel.monthGroups[0].sessions.map(\.id), ["session-1", "session-2"])
    }

    func testOverlappingReloadsCoalesceIntoOneFollowUpAfterCachedRefresh() async {
        let updates = ControlledSessionListUpdates()
        let repository = StubSessionsRepository(controlledListUpdates: updates)
        let viewModel = SessionsListViewModel(repository: repository, pageSize: 25)

        let initialLoad = Task { await viewModel.load() }
        await updates.waitUntilRequestCount(1)
        while viewModel.sessions.map(\.id) != ["session-0-cached"] { await Task.yield() }

        let overlappingReloadOne = Task { await viewModel.load() }
        let overlappingReloadTwo = Task { await viewModel.load() }
        await overlappingReloadOne.value
        await overlappingReloadTwo.value
        await updates.releaseRequest(0)
        await updates.waitUntilRequestCount(2)
        while viewModel.sessions.map(\.id) != ["session-1-cached"] { await Task.yield() }

        let requestCount = await updates.requestCountSnapshot()
        XCTAssertEqual(requestCount, 2)
        await updates.releaseRequest(1)
        await initialLoad.value

        XCTAssertEqual(viewModel.sessions.map(\.id), ["session-1-fresh"])
        XCTAssertFalse(viewModel.isRefreshing)
    }

    func testListUsesCachedUpdatesForInitialAndAdditionalPages() async {
        let first = SessionListItem(
            id: "session-1",
            startedAt: "2026-06-26T12:00:00Z",
            workoutSessionExercises: []
        )
        let cachedSecond = SessionListItem(
            id: "session-2",
            startedAt: "2026-06-25T12:00:00Z",
            workoutSessionExercises: []
        )
        let freshSecond = SessionListItem(
            id: "session-2",
            startedAt: "2026-06-25T13:00:00Z",
            workoutSessionExercises: []
        )
        let repository = StubSessionsRepository(sessions: [first, freshSecond])
        repository.listUpdateEmissionsByOffset = [
            0: [[first]],
            1: [[cachedSecond], [freshSecond]]
        ]
        let viewModel = SessionsListViewModel(repository: repository, pageSize: 1)

        await viewModel.load()
        await viewModel.loadMore()

        XCTAssertEqual(repository.listUpdateOffsets, [0, 1])
        XCTAssertEqual(viewModel.sessions.map(\.id), ["session-1", "session-2"])
        XCTAssertEqual(viewModel.sessions.last?.startedAt, "2026-06-25T13:00:00Z")
    }

    func testListIgnoresCancelledLoads() async {
        let repository = StubSessionsRepository()
        repository.listError = mappedCancellationError
        let viewModel = SessionsListViewModel(repository: repository, pageSize: 25)

        await viewModel.load()

        XCTAssertNil(viewModel.state.errorMessage)
        XCTAssertTrue(viewModel.sessions.isEmpty)
    }

    func testDetailIgnoresCancelledLoads() async {
        let repository = StubSessionsRepository()
        repository.detailError = mappedCancellationError
        let viewModel = SessionDetailViewModel(sessionId: "session-1", repository: repository)

        await viewModel.load()

        XCTAssertNil(viewModel.state.errorMessage)
        XCTAssertNil(viewModel.session)
    }

    func testPriorHistoryIgnoresCancelledLoads() async throws {
        let detail = try decodedSessionDetailFixture()
        let repository = StubSessionsRepository(detail: detail)
        repository.priorHistoryError = mappedCancellationError
        let viewModel = SessionDetailViewModel(sessionId: "session-1", repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.session?.id, "session-1")
        XCTAssertNil(viewModel.priorHistoryState.errorMessage)
    }

    func testDetailMutationsCallRepositoryAndReload() async throws {
        let detail = try decodedSessionDetailFixture()
        let repository = StubSessionsRepository(detail: detail)
        let viewModel = SessionDetailViewModel(sessionId: "session-1", repository: repository)
        let startedAt = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-06-27T12:00:00Z"))

        await viewModel.load()
        XCTAssertEqual(viewModel.displayName, "Push Day")
        let didUpdateStartedAt = await viewModel.updateStartedAt(startedAt)
        let didAddExercises = await viewModel.addExercises([pickerExercise(id: "exercise-new")])
        let didRemoveExercise = await viewModel.removeExercise(id: "wse-1")
        let didAddSet = await viewModel.addStrengthSet(
            workoutSessionExerciseId: "wse-1",
            reps: 10,
            weight: 50
        )
        let didUpdateSet = await viewModel.updateStrengthSet(id: "set-1", reps: 6, weight: 101)
        let didDeleteSet = await viewModel.deleteStrengthSet(id: "set-1")
        let didAddCardio = await viewModel.addCardioEntry(
            workoutSessionExerciseId: "wse-cardio",
            metrics: ["duration_s": 700]
        )
        let didUpdateCardio = await viewModel.updateCardioEntry(
            id: "entry-1",
            metrics: ["duration_s": 800]
        )
        let didDeleteCardio = await viewModel.deleteCardioEntry(id: "entry-1")
        let didDeleteSession = await viewModel.deleteSession()

        XCTAssertTrue(didUpdateStartedAt)
        XCTAssertTrue(didAddExercises)
        XCTAssertTrue(didRemoveExercise)
        XCTAssertTrue(didAddSet)
        XCTAssertTrue(didUpdateSet)
        XCTAssertTrue(didDeleteSet)
        XCTAssertTrue(didAddCardio)
        XCTAssertTrue(didUpdateCardio)
        XCTAssertTrue(didDeleteCardio)
        XCTAssertTrue(didDeleteSession)
        XCTAssertEqual(repository.updatedStartedAtSessionIds, ["session-1"])
        XCTAssertEqual(repository.addedExerciseIds, ["exercise-new"])
        XCTAssertEqual(repository.removedExerciseIds, ["wse-1"])
        XCTAssertEqual(repository.addedStrengthSetNumbers, [3])
        XCTAssertEqual(repository.updatedStrengthSetIds, ["set-1"])
        XCTAssertEqual(repository.deletedStrengthSetIds, ["set-1"])
        XCTAssertEqual(repository.addedCardioEntryNumbers, [2])
        XCTAssertEqual(repository.updatedCardioEntryIds, ["entry-1"])
        XCTAssertEqual(repository.deletedCardioEntryIds, ["entry-1"])
        XCTAssertEqual(repository.deletedSessionIds, ["session-1"])
        XCTAssertEqual(repository.priorHistoryRequests.first?.excludeSessionId, "session-1")
        XCTAssertGreaterThanOrEqual(repository.detailLoadCount, 10)
    }

    func testSetFormValidator() {
        XCTAssertEqual(
            SessionSetFormValidator.validate(repsText: "8", weightText: "42,5"),
            .success(reps: 8, weight: 42.5)
        )
        XCTAssertEqual(
            SessionSetFormValidator.validate(repsText: "-1", weightText: "42"),
            .failure("Reps must be a whole number ≥ 0.")
        )
        XCTAssertEqual(
            SessionSetFormValidator.validate(repsText: "8", weightText: "nope"),
            .failure("Weight must be a number ≥ 0.")
        )
    }
}

final class StrengthSetHelperTests: XCTestCase {
    func testSeedingPrefersHighestNumberedCurrentSet() {
        let seed = StrengthSetSeeding.seedSet(
            currentSets: [
                makeSessionSet(id: "current-1", number: 1, reps: 5, weight: 100),
                makeSessionSet(id: "current-3", number: 3, reps: 7, weight: 110),
                makeSessionSet(id: "current-2", number: 2, reps: 6, weight: 105)
            ],
            priorEntries: [
                makePriorStrengthEntry(
                    id: "prior-newer",
                    startedAt: "2026-06-30T12:00:00Z",
                    sets: [makeSessionSet(id: "prior-9", number: 9, reps: 3, weight: 120)]
                )
            ]
        )

        XCTAssertEqual(seed?.id, "current-3")
    }

    func testSeedingUsesNewestNonEmptyPriorEntryHighestNumberedSet() {
        let seed = StrengthSetSeeding.seedSet(
            currentSets: [],
            priorEntries: [
                makePriorStrengthEntry(
                    id: "older-heavy",
                    startedAt: "2026-06-01T12:00:00Z",
                    sets: [makeSessionSet(id: "older-9", number: 9, reps: 3, weight: 140)]
                ),
                makePriorStrengthEntry(
                    id: "newest-empty",
                    startedAt: "2026-06-30T12:00:00Z",
                    sets: []
                ),
                makePriorStrengthEntry(
                    id: "newer-with-sets",
                    startedAt: "2026-06-20T12:00:00Z",
                    sets: [
                        makeSessionSet(id: "newer-1", number: 1, reps: 8, weight: 95),
                        makeSessionSet(id: "newer-4", number: 4, reps: 5, weight: 100),
                        makeSessionSet(id: "newer-2", number: 2, reps: 6, weight: 97.5)
                    ]
                )
            ]
        )

        XCTAssertEqual(seed?.id, "newer-4")
    }

    func testSeedingReturnsNilWithoutCurrentOrPriorSets() {
        let seed = StrengthSetSeeding.seedSet(
            currentSets: [],
            priorEntries: [makePriorStrengthEntry(id: "empty", startedAt: "2026-06-20T12:00:00Z", sets: [])]
        )

        XCTAssertNil(seed)
    }

    func testNumberingUsesOnlyCurrentSets() {
        XCTAssertEqual(StrengthSetNumbering.nextSetNumber(currentSets: []), 1)
        XCTAssertEqual(
            StrengthSetNumbering.nextSetNumber(currentSets: [
                makeSessionSet(id: "set-5", number: 5, reps: 5, weight: 100),
                makeSessionSet(id: "set-2", number: 2, reps: 5, weight: 100)
            ]),
            6
        )

        let priorSeed = StrengthSetSeeding.seedSet(
            currentSets: [],
            priorEntries: [
                makePriorStrengthEntry(
                    id: "prior",
                    startedAt: "2026-06-20T12:00:00Z",
                    sets: [makeSessionSet(id: "prior-5", number: 5, reps: 5, weight: 100)]
                )
            ]
        )
        XCTAssertEqual(priorSeed?.setNumber, 5)
        XCTAssertEqual(StrengthSetNumbering.nextSetNumber(currentSets: []), 1)
    }

    func testFormattingSetSummaries() {
        XCTAssertEqual(
            StrengthSetFormatting.setSummary(
                makeSessionSet(id: "integer", number: 1, reps: 5, weight: 100),
                doubleWeight: false,
                includeSideSuffix: false
            ),
            "100 kg × 5"
        )
        XCTAssertEqual(
            StrengthSetFormatting.setSummary(
                makeSessionSet(id: "fractional", number: 1, reps: 8, weight: 42.5),
                doubleWeight: false,
                includeSideSuffix: false
            ),
            "42.5 kg × 8"
        )
        XCTAssertEqual(
            StrengthSetFormatting.setSummary(
                makeSessionSet(id: "bodyweight", number: 1, reps: 5, weight: 0),
                doubleWeight: true,
                includeSideSuffix: true
            ),
            "BW × 5"
        )
        XCTAssertEqual(
            StrengthSetFormatting.setSummary(
                makeSessionSet(id: "side", number: 1, reps: 10, weight: 25),
                doubleWeight: true,
                includeSideSuffix: true
            ),
            "25 kg × 10 /side"
        )
    }

    func testFormattingRecentSummaries() {
        XCTAssertEqual(StrengthSetFormatting.recentSummary([], doubleWeight: false), "no sets")
        XCTAssertEqual(
            StrengthSetFormatting.recentSummary(
                [
                    makeSessionSet(id: "set-1", number: 1, reps: 5, weight: 100),
                    makeSessionSet(id: "set-2", number: 2, reps: 8, weight: 42.5)
                ],
                doubleWeight: false
            ),
            "100x5, 42.5x8"
        )
        XCTAssertEqual(
            StrengthSetFormatting.recentSummary(
                [
                    makeSessionSet(id: "weighted", number: 1, reps: 10, weight: 25),
                    makeSessionSet(id: "bodyweight", number: 2, reps: 6, weight: 0)
                ],
                doubleWeight: true
            ),
            "25x10, BWx6 /side"
        )
    }
}

private func makeSessionSet(id: String, number: Int, reps: Int, weight: Double) -> SessionStrengthSet {
    SessionStrengthSet(id: id, setNumber: number, reps: reps, weight: weight)
}

private func makePriorStrengthEntry(
    id: String,
    startedAt: String,
    sets: [SessionStrengthSet]
) -> SessionPriorStrengthEntry {
    SessionPriorStrengthEntry(id: id, startedAt: startedAt, sets: sets)
}

private let sessionListFixture: JSONValue = .object([
    "id": .string("session-1"),
    "startedAt": .string("2026-06-26T12:00:00Z"),
    "workout": .object(["id": .string("workout-1"), "name": .string("Push Day")]),
    "workoutSessionExercises_aggregate": .object(["aggregate": .object(["count": .number(2)])]),
    "workoutSessionExercises": .array([
        .object([
            "exercise": .object(["id": .string("exercise-1"), "name": .string("Bench Press")]),
            "workoutSessionStrengthSets_aggregate": .object([
                "aggregate": .object(["count": .number(2), "sum": .object(["reps": .number(12)])])
            ]),
            "workoutSessionCardioEntries_aggregate": .object(["aggregate": .object(["count": .number(0)])])
        ]),
        .object([
            "exercise": .object(["id": .string("exercise-2"), "name": .string("Run")]),
            "workoutSessionStrengthSets_aggregate": .object([
                "aggregate": .object(["count": .number(0), "sum": .object(["reps": .null])])
            ]),
            "workoutSessionCardioEntries_aggregate": .object(["aggregate": .object(["count": .number(1)])])
        ])
    ])
])

private let sessionDetailFixture: JSONValue = .object([
    "id": .string("session-1"),
    "startedAt": .string("2026-06-26T12:00:00Z"),
    "workout": .object(["id": .string("workout-1"), "name": .string("Push Day")]),
    "workoutSessionExercises": .array([
        sessionExerciseRow(
            id: "wse-1",
            position: 1,
            exerciseId: "exercise-1",
            name: "Bench Press",
            doubleWeight: false,
            sets: [
                strengthSet(id: "set-1", number: 1, reps: 5, weight: 100),
                strengthSet(id: "set-2", number: 2, reps: 5, weight: 100)
            ]
        ),
        sessionExerciseRow(
            id: "wse-2",
            position: 2,
            exerciseId: "exercise-2",
            name: "Dumbbell Row",
            muscle: "back",
            doubleWeight: true,
            sets: [strengthSet(id: "set-3", number: 1, reps: 12, weight: 25)]
        ),
        cardioSessionExerciseRow
    ])
])

private let cardioSchema: JSONValue = .object([
    "type": .string("object"),
    "required": .array([.string("duration_s")]),
    "properties": .object(["duration_s": .object(["type": .string("integer")])])
])

private let cardioSessionExerciseRow: JSONValue = .object([
    "id": .string("wse-cardio"),
    "position": .number(3),
    "exercise": .object([
        "id": .string("exercise-cardio"),
        "name": .string("Run"),
        "kind": .string("cardio"),
        "primaryMuscleGroup": .string("cardio"),
        "image1FileId": .null,
        "image2FileId": .null,
        "strength": .null,
        "cardio": .object(["metricsSchema": cardioSchema])
    ]),
    "workoutSessionStrengthSets": .array([]),
    "workoutSessionCardioEntries": .array([
        .object(["id": .string("entry-1"), "entryNumber": .number(1), "metrics": .object(["duration_s": .number(600)])])
    ])
])

private let priorExerciseFixture: JSONValue = .object([
    "id": .string("exercise-1"),
    "workoutSessionExercises": .array([
        .object([
            "id": .string("prior-wse-1"),
            "workoutSession": .object([
                "id": .string("prior-session-1"),
                "startedAt": .string("2026-06-20T12:00:00Z")
            ]),
            "workoutSessionStrengthSets": .array([
                strengthSet(id: "prior-set-1", number: 1, reps: 5, weight: 100)
            ]),
            "workoutSessionCardioEntries": .array([
                .object([
                    "id": .string("prior-entry-1"),
                    "entryNumber": .number(1),
                    "metrics": .object(["duration_s": .number(600)])
                ])
            ])
        ])
    ])
])

private func decodedSessionDetailFixture() throws -> SessionDetailModel {
    let data = try JSONEncoder().encode(sessionDetailFixture)
    return try JSONDecoder().decode(SessionDetailModel.self, from: data)
}

private func sessionExerciseRow(
    id: String,
    position: Int,
    exerciseId: String,
    name: String,
    muscle: String = "chest",
    doubleWeight: Bool,
    sets: [JSONValue]
) -> JSONValue {
    .object([
        "id": .string(id),
        "position": .number(Double(position)),
        "exercise": .object([
            "id": .string(exerciseId),
            "name": .string(name),
            "kind": .string("strength"),
            "primaryMuscleGroup": .string(muscle),
            "image1FileId": .null,
            "image2FileId": .null,
            "strength": .object(["doubleWeight": .bool(doubleWeight)]),
            "cardio": .null
        ]),
        "workoutSessionStrengthSets": .array(sets),
        "workoutSessionCardioEntries": .array([])
    ])
}

private func strengthSet(id: String, number: Int, reps: Int, weight: Double) -> JSONValue {
    .object([
        "id": .string(id),
        "setNumber": .number(Double(number)),
        "reps": .number(Double(reps)),
        "weight": .number(weight)
    ])
}

private func pickerExercise(id: String) -> ExerciseListItem {
    ExerciseListItem(
        id: id,
        name: id,
        strength: ExerciseStrengthSummary(doubleWeight: false),
        primaryMuscleGroup: "chest",
        isPublic: true
    )
}

private let mappedCancellationError = GraphQLDomainError.transport(
    "The operation couldn't be completed. (Swift.CancellationError error 1.)"
)

private final class StubSessionsRepository: SessionsRepositoryProtocol, @unchecked Sendable {
    var sessions: [SessionListItem]
    var detail: SessionDetailModel?
    var detailLoadCount = 0
    var updatedStartedAtSessionIds: [String] = []
    var deletedSessionIds: [String] = []
    var addedExerciseIds: [String] = []
    var removedExerciseIds: [String] = []
    var addedStrengthSetNumbers: [Int] = []
    var updatedStrengthSetIds: [String] = []
    var deletedStrengthSetIds: [String] = []
    var priorHistory = SessionPriorHistory()
    var priorHistoryRequests: [(exerciseIds: [String], excludeSessionId: String)] = []
    var priorHistoryError: Error?
    var addedCardioEntryNumbers: [Int] = []
    var updatedCardioEntryIds: [String] = []
    var deletedCardioEntryIds: [String] = []
    var listError: Error?
    var detailError: Error?
    var listUpdateEmissionsByOffset: [Int: [[SessionListItem]]] = [:]
    var listUpdateOffsets: [Int] = []
    private let controlledListUpdates: ControlledSessionListUpdates?

    init(
        sessions: [SessionListItem] = [],
        detail: SessionDetailModel? = nil,
        controlledListUpdates: ControlledSessionListUpdates? = nil
    ) {
        self.sessions = sessions
        self.detail = detail
        self.controlledListUpdates = controlledListUpdates
    }

    func listSessions(limit: Int, offset: Int) async throws -> [SessionListItem] {
        if let listError { throw listError }
        return Array(sessions.dropFirst(offset).prefix(limit))
    }

    func sessionListUpdates(
        limit: Int,
        offset: Int
    ) -> AsyncThrowingStream<[SessionListItem], Error> {
        listUpdateOffsets.append(offset)
        if let controlledListUpdates {
            return controlledListUpdates.stream()
        }
        let emissions = listUpdateEmissionsByOffset[offset]
            ?? [Array(sessions.dropFirst(offset).prefix(limit))]
        return AsyncThrowingStream { continuation in
            if let listError {
                continuation.finish(throwing: listError)
                return
            }
            for emission in emissions {
                continuation.yield(emission)
            }
            continuation.finish()
        }
    }

    func sessionDetail(id: String) async throws -> SessionDetailModel? {
        detailLoadCount += 1
        if let detailError { throw detailError }
        return detail
    }

    func priorSessionsPerExercise(exerciseIds: [String], excludeSessionId: String) async throws -> SessionPriorHistory {
        priorHistoryRequests.append((exerciseIds: exerciseIds, excludeSessionId: excludeSessionId))
        if let priorHistoryError { throw priorHistoryError }
        return priorHistory
    }

    func updateStartedAt(sessionId: String, startedAt: Date) async throws {
        updatedStartedAtSessionIds.append(sessionId)
    }

    func deleteSession(id: String) async throws {
        deletedSessionIds.append(id)
    }

    func addSessionExercises(sessionId: String, exercises: [ExerciseListItem], basePosition: Int) async throws {
        addedExerciseIds.append(contentsOf: exercises.map(\.id))
    }

    func removeSessionExercise(id: String) async throws {
        removedExerciseIds.append(id)
    }

    func addStrengthSet(
        workoutSessionExerciseId: String,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) async throws -> String {
        addedStrengthSetNumbers.append(setNumber)
        return "set-new"
    }

    func updateStrengthSet(id: String, reps: Int, weight: Double) async throws {
        updatedStrengthSetIds.append(id)
    }

    func deleteStrengthSet(id: String) async throws {
        deletedStrengthSetIds.append(id)
    }

    func addCardioEntry(
        workoutSessionExerciseId: String,
        entryNumber: Int,
        metrics: CardioMetrics
    ) async throws -> String {
        addedCardioEntryNumbers.append(entryNumber)
        return "entry-new"
    }

    func updateCardioEntry(id: String, metrics: CardioMetrics) async throws {
        updatedCardioEntryIds.append(id)
    }

    func deleteCardioEntry(id: String) async throws {
        deletedCardioEntryIds.append(id)
    }
}

private actor ControlledSessionListUpdates {
    private var requestCount = 0
    private var releases: [Int: CheckedContinuation<Void, Never>] = [:]
    private var requestWaiters: [(count: Int, continuation: CheckedContinuation<Void, Never>)] = []

    nonisolated func stream() -> AsyncThrowingStream<[SessionListItem], Error> {
        AsyncThrowingStream { continuation in
            let task = Task { await self.produce(continuation: continuation) }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }

    func waitUntilRequestCount(_ count: Int) async {
        guard requestCount < count else { return }
        await withCheckedContinuation { continuation in
            requestWaiters.append((count, continuation))
        }
    }

    func releaseRequest(_ index: Int) {
        releases.removeValue(forKey: index)?.resume()
    }

    func requestCountSnapshot() -> Int {
        requestCount
    }

    private func produce(
        continuation: AsyncThrowingStream<[SessionListItem], Error>.Continuation
    ) async {
        let index = requestCount
        requestCount += 1
        continuation.yield([session(index: index, freshness: "cached")])
        resumeSatisfiedRequestWaiters()

        await withCheckedContinuation { releases[index] = $0 }
        guard !Task.isCancelled else {
            continuation.finish(throwing: CancellationError())
            return
        }
        continuation.yield([session(index: index, freshness: "fresh")])
        continuation.finish()
    }

    private func session(index: Int, freshness: String) -> SessionListItem {
        SessionListItem(
            id: "session-\(index)-\(freshness)",
            startedAt: "2026-06-26T12:00:00Z",
            workoutSessionExercises: []
        )
    }

    private func resumeSatisfiedRequestWaiters() {
        let satisfied = requestWaiters.filter { requestCount >= $0.count }
        requestWaiters.removeAll { requestCount >= $0.count }
        satisfied.forEach { $0.continuation.resume() }
    }
}

private extension JSONValue {
    subscript(key: String) -> JSONValue? {
        guard case let .object(object) = self else { return nil }
        return object[key]
    }

    func recursivelyContainsKey(_ key: String) -> Bool {
        switch self {
        case let .object(object):
            object.keys.contains(key) || object.values.contains { $0.recursivelyContainsKey(key) }
        case let .array(values):
            values.contains { $0.recursivelyContainsKey(key) }
        case .null, .bool, .integer, .number, .string:
            false
        }
    }
}
