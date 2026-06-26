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
        let didAddSet = await viewModel.addStrengthSet(workoutSessionExerciseId: "wse-1", reps: 10, weight: 50)
        let didUpdateSet = await viewModel.updateStrengthSet(id: "set-1", reps: 6, weight: 101)
        let didDeleteSet = await viewModel.deleteStrengthSet(id: "set-1")
        let didDeleteSession = await viewModel.deleteSession()

        XCTAssertTrue(didUpdateStartedAt)
        XCTAssertTrue(didAddExercises)
        XCTAssertTrue(didRemoveExercise)
        XCTAssertTrue(didAddSet)
        XCTAssertTrue(didUpdateSet)
        XCTAssertTrue(didDeleteSet)
        XCTAssertTrue(didDeleteSession)
        XCTAssertEqual(repository.updatedStartedAtSessionIds, ["session-1"])
        XCTAssertEqual(repository.addedExerciseIds, ["exercise-new"])
        XCTAssertEqual(repository.removedExerciseIds, ["wse-1"])
        XCTAssertEqual(repository.addedStrengthSetNumbers, [3])
        XCTAssertEqual(repository.updatedStrengthSetIds, ["set-1"])
        XCTAssertEqual(repository.deletedStrengthSetIds, ["set-1"])
        XCTAssertEqual(repository.deletedSessionIds, ["session-1"])
        XCTAssertGreaterThanOrEqual(repository.detailLoadCount, 7)
    }

    func testSetFormValidator() {
        XCTAssertEqual(SessionSetFormValidator.validate(repsText: "8", weightText: "42,5"), .success(reps: 8, weight: 42.5))
        XCTAssertEqual(SessionSetFormValidator.validate(repsText: "-1", weightText: "42"), .failure("Reps must be a whole number ≥ 0."))
        XCTAssertEqual(SessionSetFormValidator.validate(repsText: "8", weightText: "nope"), .failure("Weight must be a number ≥ 0."))
    }
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
            "workoutSessionStrengthSets_aggregate": .object(["aggregate": .object(["count": .number(0), "sum": .object(["reps": .null])])]),
            "workoutSessionCardioEntries_aggregate": .object(["aggregate": .object(["count": .number(1)])])
        ])
    ])
])

private let sessionDetailFixture: JSONValue = .object([
    "id": .string("session-1"),
    "startedAt": .string("2026-06-26T12:00:00Z"),
    "workout": .object(["id": .string("workout-1"), "name": .string("Push Day")]),
    "workoutSessionExercises": .array([
        sessionExerciseRow(id: "wse-1", position: 1, exerciseId: "exercise-1", name: "Bench Press", doubleWeight: false, sets: [
            strengthSet(id: "set-1", number: 1, reps: 5, weight: 100),
            strengthSet(id: "set-2", number: 2, reps: 5, weight: 100)
        ]),
        sessionExerciseRow(id: "wse-2", position: 2, exerciseId: "exercise-2", name: "Dumbbell Row", muscle: "back", doubleWeight: true, sets: [
            strengthSet(id: "set-3", number: 1, reps: 12, weight: 25)
        ]),
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

    init(sessions: [SessionListItem] = [], detail: SessionDetailModel? = nil) {
        self.sessions = sessions
        self.detail = detail
    }

    func listSessions(limit: Int, offset: Int) async throws -> [SessionListItem] {
        Array(sessions.dropFirst(offset).prefix(limit))
    }

    func sessionDetail(id: String) async throws -> SessionDetailModel? {
        detailLoadCount += 1
        return detail
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

    func addStrengthSet(workoutSessionExerciseId: String, setNumber: Int, reps: Int, weight: Double) async throws -> String {
        addedStrengthSetNumbers.append(setNumber)
        return "set-new"
    }

    func updateStrengthSet(id: String, reps: Int, weight: Double) async throws {
        updatedStrengthSetIds.append(id)
    }

    func deleteStrengthSet(id: String) async throws {
        deletedStrengthSetIds.append(id)
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
        case .null, .bool, .number, .string:
            false
        }
    }
}
