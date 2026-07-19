import Foundation
import XCTest
@testable import NeoGymKit

final class ExercisesRepositoryTests: XCTestCase {
    func testDecodesExercisesIndexPayload() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "exercises": .array([
                .object([
                    "id": .string("strength-1"),
                    "name": .string("Bench Press"),
                    "strength": .object(["doubleWeight": .bool(false)]),
                    "primaryMuscleGroup": .string("chest"),
                    "category": .string("strength"),
                    "equipment": .string("barbell"),
                    "level": .string("intermediate"),
                    "isPublic": .bool(true),
                    "secondaryMuscleGroups": .array([.object(["muscleGroup": .string("triceps")])])
                ])
            ])
        ]))])
        let repository = ExercisesRepository(graphQL: fake)

        let exercises = try await repository.listExercises()

        XCTAssertEqual(exercises.count, 1)
        XCTAssertEqual(exercises[0].name, "Bench Press")
        XCTAssertEqual(exercises[0].strength?.doubleWeight, false)
        XCTAssertEqual(exercises[0].secondaryMuscleGroups.map(\.muscleGroup), ["triceps"])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.first?.operationName, "ExercisesIndex")
        XCTAssertTrue(requests.first?.query.contains("query ExercisesIndex") == true)
    }

    func testDecodesExerciseDetailHistoryAndBuildsProgress() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "exercise": strengthDetailFixture
        ]))])
        let repository = ExercisesRepository(graphQL: fake)

        let detail = try await repository.exerciseDetail(id: "strength-1")
        let exercise = try XCTUnwrap(detail)
        let history = ExerciseProgressBuilder.sortedHistory(exercise.workoutSessionExercises)
        let points = ExerciseProgressBuilder.strengthPoints(
            entries: history,
            doubleWeight: exercise.strength?.doubleWeight ?? false
        )

        XCTAssertEqual(exercise.name, "Bench Press")
        XCTAssertEqual(history.map(\.workoutSession.id), ["session-new", "session-old"])
        XCTAssertEqual(points.count, 2)
        XCTAssertEqual(points.last?.volume, 1_600)
        XCTAssertEqual(points.last?.oneRepMax ?? 0, 126.666, accuracy: 0.001)
    }

    func testDecodesCardioSchemaAndBuildsAverageProgress() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "exercise": cardioDetailFixture
        ]))])
        let repository = ExercisesRepository(graphQL: fake)

        let loadedDetail = try await repository.exerciseDetail(id: "cardio-1")
        let detail = try XCTUnwrap(loadedDetail)
        let schema = try XCTUnwrap(detail.cardioSchema)
        let primary = try XCTUnwrap(CardioMetricsSchemaHelpers.iterateMetrics(schema).first)
        let points = ExerciseProgressBuilder.cardioPoints(entries: detail.workoutSessionExercises, primary: primary)

        XCTAssertEqual(detail.kind, "cardio")
        XCTAssertEqual(primary.key, "pace")
        XCTAssertEqual(CardioMetricsSchemaHelpers.aggregation(for: primary.format), .average)
        XCTAssertEqual(points.map(\.value), [305])
    }

    func testStartAdHocSessionVariablesOmitForbiddenColumns() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertWorkoutSession": .object(["id": .string("session-1")])
        ]))])
        let repository = ExercisesRepository(graphQL: fake)
        let startedAt = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-06-26T12:00:00.000Z"))

        let sessionId = try await repository.startAdHocSession(exerciseId: "exercise-1", startedAt: startedAt)

        XCTAssertEqual(sessionId, "session-1")
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "StartSession")
        let object = try XCTUnwrap(request.variables?["obj"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("kind"))
        XCTAssertFalse(object.recursivelyContainsKey("parentKind"))
        XCTAssertEqual(object["workoutId"], .null)
        XCTAssertEqual(object["startedAt"], .string("2026-06-26T12:00:00.000Z"))
        XCTAssertEqual(
            object["workoutSessionExercises"]?["data"]?.arrayValue?.first?["exerciseId"],
            .string("exercise-1")
        )
        XCTAssertEqual(
            object["workoutSessionExercises"]?["data"]?.arrayValue?.first?["position"],
            .number(0)
        )
    }
}

@MainActor
final class ExercisesListViewModelTests: XCTestCase {
    func testLoadSearchFilterAndVisibility() async {
        let viewModel = ExercisesListViewModel(repository: StubExercisesRepository(exercises: sampleExercises))

        await viewModel.load()
        viewModel.searchText = "press"
        viewModel.setFilter(.muscle, value: "triceps")
        viewModel.visibility = .public

        XCTAssertEqual(viewModel.filteredExercises.map(\.id), ["bench"])
    }

    func testFilterOptionsApplyOtherFiltersButNotOwnColumn() async {
        let viewModel = ExercisesListViewModel(repository: StubExercisesRepository(exercises: sampleExercises))

        await viewModel.load()
        viewModel.setFilter(.category, value: "strength")
        viewModel.setFilter(.equipment, value: "barbell")

        XCTAssertEqual(viewModel.options(for: .equipment), [
            ExerciseFilterOption(value: "barbell", count: 1),
            ExerciseFilterOption(value: "machine", count: 1)
        ])
        XCTAssertEqual(viewModel.options(for: .muscle), [
            ExerciseFilterOption(value: "chest", count: 1),
            ExerciseFilterOption(value: "triceps", count: 1)
        ])
    }

    func testClearAllResetsFilterState() async {
        let viewModel = ExercisesListViewModel(repository: StubExercisesRepository(exercises: sampleExercises))

        await viewModel.load()
        viewModel.searchText = "row"
        viewModel.setFilter(.level, value: "beginner")
        viewModel.visibility = .mine
        viewModel.clearAll()

        XCTAssertFalse(viewModel.isFiltered)
        XCTAssertEqual(viewModel.filteredExercises.map(\.id), ["bench", "squat", "run"])
    }
}

private let strengthDetailFixture: JSONValue = .object([
    "id": .string("strength-1"),
    "name": .string("Bench Press"),
    "instructions": .array([.string("Lie down"), .string("Press")]),
    "image1FileId": .string("file-1"),
    "image2FileId": .null,
    "level": .string("intermediate"),
    "category": .string("strength"),
    "kind": .string("strength"),
    "equipment": .string("barbell"),
    "primaryMuscleGroup": .string("chest"),
    "isPublic": .bool(true),
    "strength": .object(["doubleWeight": .bool(false), "force": .string("push"), "mechanic": .string("compound")]),
    "cardio": .null,
    "secondaryMuscleGroups": .array([.object(["muscleGroup": .string("triceps")])]),
    "workoutSessionExercises": .array([
        historyEntry(
            id: "wse-old",
            sessionId: "session-old",
            startedAt: "2026-06-20T12:00:00Z",
            weight: 90,
            reps: 5
        ),
        historyEntry(
            id: "wse-new",
            sessionId: "session-new",
            startedAt: "2026-06-25T12:00:00Z",
            weight: 100,
            reps: 8
        )
    ])
])

private let cardioDetailFixture: JSONValue = .object([
    "id": .string("cardio-1"),
    "name": .string("Run"),
    "instructions": .array([]),
    "image1FileId": .null,
    "image2FileId": .null,
    "level": .string("beginner"),
    "category": .string("cardio"),
    "kind": .string("cardio"),
    "equipment": .string("none"),
    "primaryMuscleGroup": .string("cardio"),
    "isPublic": .bool(true),
    "strength": .null,
    "cardio": .object(["metricsSchema": cardioSchemaFixture]),
    "secondaryMuscleGroups": .array([]),
    "workoutSessionExercises": .array([
        .object([
            "id": .string("cardio-wse"),
            "workoutSession": .object([
                "id": .string("cardio-session"),
                "startedAt": .string("2026-06-25T12:00:00Z"),
                "workout": .null
            ]),
            "workoutSessionStrengthSets": .array([]),
            "workoutSessionCardioEntries": .array([
                .object([
                    "id": .string("entry-1"),
                    "entryNumber": .number(1),
                    "metrics": .object(["pace": .number(300)])
                ]),
                .object([
                    "id": .string("entry-2"),
                    "entryNumber": .number(2),
                    "metrics": .object(["pace": .number(310)])
                ])
            ])
        ])
    ])
])

private let cardioSchemaFixture: JSONValue = .object([
    "type": .string("object"),
    "additionalProperties": .bool(false),
    "required": .array([.string("pace")]),
    "properties": .object([
        "pace": .object([
            "type": .string("integer"),
            "x-label": .string("Pace"),
            "x-unit": .string("sec/km"),
            "x-format": .string("average"),
            "x-order": .number(0)
        ])
    ])
])

private let sampleExercises = [
    ExerciseListItem(
        id: "bench",
        name: "Bench Press",
        strength: ExerciseStrengthSummary(doubleWeight: false),
        primaryMuscleGroup: "chest",
        category: "strength",
        equipment: "barbell",
        level: "intermediate",
        isPublic: true,
        secondaryMuscleGroups: [ExerciseSecondaryMuscle(muscleGroup: "triceps")]
    ),
    ExerciseListItem(
        id: "run",
        name: "Run",
        primaryMuscleGroup: "cardio",
        category: "cardio",
        equipment: "none",
        level: "beginner",
        isPublic: false
    ),
    ExerciseListItem(
        id: "squat",
        name: "Leg Press",
        strength: ExerciseStrengthSummary(doubleWeight: false),
        primaryMuscleGroup: "legs",
        category: "strength",
        equipment: "machine",
        level: "beginner",
        isPublic: true,
        secondaryMuscleGroups: [ExerciseSecondaryMuscle(muscleGroup: "glutes")]
    )
]

private func historyEntry(id: String, sessionId: String, startedAt: String, weight: Double, reps: Int) -> JSONValue {
    .object([
        "id": .string(id),
        "workoutSession": .object([
            "id": .string(sessionId),
            "startedAt": .string(startedAt),
            "workout": .object(["id": .string("workout-1"), "name": .string("Push Day")])
        ]),
        "workoutSessionStrengthSets": .array([
            .object([
                "id": .string("set-\(id)"),
                "setNumber": .number(1),
                "reps": .number(Double(reps)),
                "weight": .string("\(weight)")
            ]),
            .object([
                "id": .string("set2-\(id)"),
                "setNumber": .number(2),
                "reps": .number(Double(reps)),
                "weight": .number(weight)
            ])
        ]),
        "workoutSessionCardioEntries": .array([])
    ])
}

private final class StubExercisesRepository: ExercisesRepositoryProtocol, @unchecked Sendable {
    let exercises: [ExerciseListItem]

    init(exercises: [ExerciseListItem]) {
        self.exercises = exercises.sorted { $0.name < $1.name }
    }

    func listExercises() async throws -> [ExerciseListItem] { exercises }
    func exerciseDetail(id: String) async throws -> ExerciseDetailModel? { nil }
    func exercisePickerExercises() async throws -> [ExerciseListItem] { exercises }
    func priorSessionsPerExercise(exerciseIds: [String]) async throws -> [ExercisePriorSessions] { [] }
    func startAdHocSession(exerciseId: String, startedAt: Date) async throws -> String { "session" }
}

private extension JSONValue {
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
