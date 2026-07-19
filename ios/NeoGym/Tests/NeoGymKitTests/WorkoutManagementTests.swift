import Foundation
import XCTest
@testable import NeoGymKit

final class WorkoutsRepositoryTests: XCTestCase {
    func testDecodesWorkoutsIndexPayload() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workouts": .array([workoutListFixture]),
            "labels": .array([.object(["id": .string("label-1"), "name": .string("push")])])
        ]))])
        let repository = WorkoutsRepository(graphQL: fake)

        let payload = try await repository.listWorkouts()

        XCTAssertEqual(payload.workouts.count, 1)
        XCTAssertEqual(payload.workouts[0].name, "Push Day")
        XCTAssertEqual(payload.workouts[0].exerciseCount, 2)
        XCTAssertEqual(payload.workouts[0].workoutLabels.map(\.label.name), ["push"])
        XCTAssertEqual(payload.labels.map(\.name), ["push"])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.first?.operationName, "WorkoutsIndex")
    }

    func testDecodesWorkoutDetailPayloadForEdit() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workout": workoutDetailFixture,
            "labels": .array([.object(["id": .string("label-1"), "name": .string("push")])])
        ]))])
        let repository = WorkoutsRepository(graphQL: fake)

        let payload = try await repository.editWorkout(id: "workout-1")
        let workout = try XCTUnwrap(payload.workout)
        let formValues = WorkoutFormModel.values(from: workout)

        XCTAssertEqual(workout.workoutExercises.map(\.exercise.name), ["Bench Press", "Row"])
        XCTAssertTrue(workout.canEdit(currentUserId: "user-1"))
        XCTAssertFalse(workout.canEdit(currentUserId: "other-user"))
        XCTAssertEqual(formValues.exercises.map(\.rowId), ["row-1", "row-2"])
        XCTAssertEqual(formValues.labels, [WorkoutLabelSelection(id: "label-1", name: "push")])
    }

    func testCreateWorkoutVariablesOmitForbiddenColumns() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertWorkout": .object(["id": .string("workout-new")])
        ]))])
        let repository = WorkoutsRepository(graphQL: fake)

        let id = try await repository.createWorkout(createValues)

        XCTAssertEqual(id, "workout-new")
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "CreateWorkout")
        let object = try XCTUnwrap(request.variables?["obj"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
        XCTAssertFalse(object.recursivelyContainsKey("kind"))
        XCTAssertFalse(object.recursivelyContainsKey("parentKind"))
        XCTAssertEqual(object["name"], .string("Push Day"))
        XCTAssertEqual(object["workoutExercises"]?["data"]?.arrayValue?.count, 2)
        XCTAssertEqual(object["workoutExercises"]?["data"]?.arrayValue?.first?["position"], .number(1))
        XCTAssertEqual(object["workoutLabels"]?["data"]?.arrayValue?.count, 2)
        let newLabel = try XCTUnwrap(object["workoutLabels"]?["data"]?.arrayValue?.last)
        XCTAssertEqual(newLabel["label"]?["data"]?["name"], .string("hypertrophy"))
        XCTAssertEqual(newLabel["label"]?["on_conflict"]?["constraint"], .string("labels_user_name_key"))
    }

    func testSaveWorkoutVariablesDiffRowsLabelsAndOmitForbiddenColumns() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "updateWorkout": .object(["id": .string("workout-1")])
        ]))])
        let repository = WorkoutsRepository(graphQL: fake)
        let initial = WorkoutFormValues(
            name: "Push Day",
            description: "Old",
            exercises: [existingRow1, existingRow2],
            labels: [
                WorkoutLabelSelection(id: "label-keep", name: "push"),
                WorkoutLabelSelection(id: "label-drop", name: "old")
            ]
        )
        let next = WorkoutFormValues(
            name: "Push Day 2",
            description: "",
            exercises: [existingRow2, newRow],
            labels: [WorkoutLabelSelection(id: "label-keep", name: "push"), WorkoutLabelSelection(name: "new")]
        )

        try await repository.saveWorkout(id: "workout-1", initialValues: initial, values: next)

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "SaveWorkout")
        let variables = try XCTUnwrap(request.variables)
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("isPublic"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("kind"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("parentKind"))
        XCTAssertEqual(variables["set"]?["description"], .null)
        XCTAssertEqual(variables["deleteRowIds"]?.arrayValue, [.string("row-1")])
        XCTAssertEqual(variables["hasDeleteRows"], .bool(true))
        XCTAssertEqual(variables["insertRows"]?.arrayValue?.first?["exerciseId"], .string("exercise-3"))
        XCTAssertEqual(variables["positionUpdates"]?.arrayValue?.first?["_set"]?["position"], .number(1))
        XCTAssertEqual(variables["deleteLabelIds"]?.arrayValue, [.string("label-drop")])
        XCTAssertEqual(variables["insertLabels"]?.arrayValue?.first?["label"]?["data"]?["name"], .string("new"))
    }

    func testDeleteWorkoutVariablesOmitForbiddenColumns() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "deleteWorkout": .object(["id": .string("workout-1")])
        ]))])
        let repository = WorkoutsRepository(graphQL: fake)

        try await repository.deleteWorkout(id: "workout-1")

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "DeleteWorkout")
        XCTAssertEqual(request.variables, ["id": .string("workout-1")])
    }

    func testStartWorkoutSessionVariablesCopyOrderedExercisesAndOmitForbiddenColumns() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertWorkoutSession": .object(["id": .string("session-1")])
        ]))])
        let repository = WorkoutsRepository(graphQL: fake)
        let workoutData = try JSONEncoder().encode(workoutDetailFixture)
        let workout = try JSONDecoder().decode(WorkoutDetailModel.self, from: workoutData)
        let startedAt = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-06-26T12:00:00.000Z"))

        let id = try await repository.startSession(from: workout, startedAt: startedAt)

        XCTAssertEqual(id, "session-1")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["obj"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
        XCTAssertFalse(object.recursivelyContainsKey("kind"))
        XCTAssertFalse(object.recursivelyContainsKey("parentKind"))
        XCTAssertEqual(object["workoutId"], .string("workout-1"))
        XCTAssertEqual(object["startedAt"], .string("2026-06-26T12:00:00.000Z"))
        let rows = try XCTUnwrap(object["workoutSessionExercises"]?["data"]?.arrayValue)
        XCTAssertEqual(rows.map { $0["exerciseId"] }, [.string("exercise-1"), .string("exercise-2")])
        XCTAssertEqual(rows.map { $0["position"] }, [.number(1), .number(2)])
    }
}

@MainActor
final class WorkoutFormModelTests: XCTestCase {
    func testValidationTrimsNameAndDescription() {
        let model = WorkoutFormModel(
            initialValues: WorkoutFormValues(
                name: "  Push  ",
                description: "  **Heavy**  ",
                exercises: [],
                labels: []
            )
        )

        let values = model.valuesForSubmit()

        XCTAssertEqual(values?.name, "Push")
        XCTAssertEqual(values?.description, "**Heavy**")
    }

    func testValidationRejectsBlankName() {
        let model = WorkoutFormModel(
            initialValues: WorkoutFormValues(name: "   ", description: "", exercises: [], labels: [])
        )

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Name is required.")
    }

    func testExerciseOrderingAndDuplicatePrevention() {
        let model = WorkoutFormModel(
            initialValues: WorkoutFormValues(name: "Push", description: "", exercises: [existingRow1], labels: []),
            rowId: { "new-1" }
        )

        model.addExercises([pickerExercise(id: "exercise-1"), pickerExercise(id: "exercise-2")])
        model.moveExerciseDown(rowId: "row-1")
        model.removeExercise(rowId: "row-1")

        XCTAssertEqual(model.exercises.map(\.exerciseId), ["exercise-2"])
        XCTAssertEqual(model.exercises.map(\.rowId), ["new-1"])
    }

    func testLabelsNormalizeReuseSuggestionsAndDeduplicate() {
        let model = WorkoutFormModel(
            initialValues: WorkoutFormValues(name: "Push", description: "", exercises: [], labels: [])
        )
        let suggestions = [WorkoutLabel(id: "label-1", name: "push day")]

        model.commitLabel("  Push   Day ", suggestions: suggestions)
        model.commitLabel("push day", suggestions: suggestions)
        model.commitLabel("Hypertrophy", suggestions: suggestions)
        model.removeLabel(name: "push day")

        XCTAssertEqual(model.labels, [WorkoutLabelSelection(name: "hypertrophy")])
    }
}

@MainActor
final class WorkoutsListViewModelTests: XCTestCase {
    func testFiltersRequireAllSelectedLabelsAndVisibility() async {
        let repository = StubWorkoutsRepository(index: WorkoutIndexPayload(
            workouts: [
                WorkoutListItem(
                    id: "mine",
                    name: "Mine",
                    isPublic: false,
                    workoutLabels: [labelLink(id: "push"), labelLink(id: "upper")]
                ),
                WorkoutListItem(id: "public", name: "Public", isPublic: true, workoutLabels: [labelLink(id: "push")])
            ],
            labels: [WorkoutLabel(id: "push", name: "push"), WorkoutLabel(id: "upper", name: "upper")]
        ))
        let viewModel = WorkoutsListViewModel(repository: repository)

        await viewModel.load()
        viewModel.toggleVisibility(.mine)
        viewModel.toggleLabel("push")
        viewModel.toggleLabel("upper")

        XCTAssertEqual(viewModel.filteredWorkouts.map(\.id), ["mine"])
    }
}

@MainActor
final class WorkoutDetailViewModelTests: XCTestCase {
    func testDetailLoadAppliesCachedThenFreshValues() async {
        let repository = StubWorkoutsRepository(detailUpdates: [
            WorkoutDetailModel(id: "workout", name: "Cached", isPublic: false),
            WorkoutDetailModel(id: "workout", name: "Fresh", isPublic: false)
        ])
        let viewModel = WorkoutDetailViewModel(workoutId: "workout", repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.workout?.name, "Fresh")
    }

    func testDetailLoadKeepsCachedValueWhenRefreshProducesNoFurtherEmission() async {
        let repository = StubWorkoutsRepository(detailUpdates: [
            WorkoutDetailModel(id: "workout", name: "Cached", isPublic: false)
        ])
        let viewModel = WorkoutDetailViewModel(workoutId: "workout", repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.workout?.name, "Cached")
    }

    func testDetailLoadTreatsFreshNilAsDeletedAfterCachedValue() async {
        let repository = StubWorkoutsRepository(detailUpdates: [
            WorkoutDetailModel(id: "workout", name: "Cached", isPublic: false),
            nil
        ])
        let viewModel = WorkoutDetailViewModel(workoutId: "workout", repository: repository)

        await viewModel.load()

        XCTAssertNil(viewModel.workout)
        XCTAssertEqual(viewModel.state.errorMessage, "Workout not found.")
    }
}

private let workoutListFixture: JSONValue = .object([
    "id": .string("workout-1"),
    "name": .string("Push Day"),
    "description": .string("**Chest** and triceps"),
    "isPublic": .bool(false),
    "workoutExercises_aggregate": .object(["aggregate": .object(["count": .number(2)])]),
    "workoutLabels": .array([.object([
        "labelId": .string("label-1"),
        "label": .object(["id": .string("label-1"), "name": .string("push")])
    ])])
])

private let workoutDetailFixture: JSONValue = .object([
    "id": .string("workout-1"),
    "name": .string("Push Day"),
    "description": .string("**Chest** and triceps"),
    "isPublic": .bool(false),
    "userId": .string("user-1"),
    "workoutExercises": .array([
        workoutExerciseRow(id: "row-1", exerciseId: "exercise-1", name: "Bench Press", position: 1),
        workoutExerciseRow(id: "row-2", exerciseId: "exercise-2", name: "Row", position: 2)
    ]),
    "workoutLabels": .array([.object([
        "labelId": .string("label-1"),
        "label": .object(["id": .string("label-1"), "name": .string("push")])
    ])])
])

private let existingRow1 = WorkoutFormExerciseRow(
    rowId: "row-1",
    exerciseId: "exercise-1",
    name: "Bench Press",
    primaryMuscleGroup: "chest",
    doubleWeight: false
)

private let existingRow2 = WorkoutFormExerciseRow(
    rowId: "row-2",
    exerciseId: "exercise-2",
    name: "Row",
    primaryMuscleGroup: "back",
    doubleWeight: true
)

private let newRow = WorkoutFormExerciseRow(
    rowId: "new-1",
    exerciseId: "exercise-3",
    name: "Squat",
    primaryMuscleGroup: "legs",
    doubleWeight: false
)

private let createValues = WorkoutFormValues(
    name: "Push Day",
    description: "Chest",
    exercises: [existingRow1, existingRow2],
    labels: [WorkoutLabelSelection(id: "label-1", name: "push"), WorkoutLabelSelection(name: "hypertrophy")]
)

private func workoutExerciseRow(id: String, exerciseId: String, name: String, position: Int) -> JSONValue {
    .object([
        "id": .string(id),
        "position": .number(Double(position)),
        "exercise": .object([
            "id": .string(exerciseId),
            "name": .string(name),
            "strength": .object(["doubleWeight": .bool(name == "Row")]),
            "primaryMuscleGroup": .string(name == "Row" ? "back" : "chest"),
            "image1FileId": .null,
            "image2FileId": .null
        ])
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

private func labelLink(id: String) -> WorkoutLabelLink {
    WorkoutLabelLink(labelId: id, label: WorkoutLabel(id: id, name: id))
}

private final class StubWorkoutsRepository: WorkoutsRepositoryProtocol, @unchecked Sendable {
    var index: WorkoutIndexPayload
    let detailUpdates: [WorkoutDetailModel?]

    init(
        index: WorkoutIndexPayload = WorkoutIndexPayload(workouts: [], labels: []),
        detailUpdates: [WorkoutDetailModel?] = []
    ) {
        self.index = index
        self.detailUpdates = detailUpdates
    }

    func listWorkouts() async throws -> WorkoutIndexPayload { index }

    func workoutDetailUpdates(id: String) -> AsyncThrowingStream<WorkoutDetailModel?, Error> {
        let updates = AsyncThrowingStream<WorkoutDetailModel?, Error>.makeStream()
        for detail in detailUpdates {
            updates.continuation.yield(detail)
        }
        updates.continuation.finish()
        return updates.stream
    }

    func workoutDetail(id: String) async throws -> WorkoutDetailModel? { detailUpdates.last ?? nil }
    func editWorkout(id: String) async throws -> WorkoutEditPayload { WorkoutEditPayload(workout: nil, labels: []) }
    func labels() async throws -> [WorkoutLabel] { [] }
    func createWorkout(_ values: WorkoutFormValues) async throws -> String { "created" }
    func saveWorkout(id: String, initialValues: WorkoutFormValues, values: WorkoutFormValues) async throws {}
    func deleteWorkout(id: String) async throws {}
    func startSession(from workout: WorkoutDetailModel, startedAt: Date) async throws -> String { "session" }
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
