import Foundation

public struct DemoWorkoutsRepository: WorkoutsRepositoryProtocol {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listWorkouts() async throws -> WorkoutIndexPayload {
        try await store.read { state in
            WorkoutIndexPayload(
                workouts: try state.decode([WorkoutListItem].self, .array(state.rows(.workouts).map { try state.workout($0.text("id")) })),
                labels: try state.records(table: .workoutLabels)
            )
        }
    }

    public func workoutDetail(id: String) async throws -> WorkoutDetailModel? {
        try await store.read { state in
            guard state.tables[DemoTable.workouts.rawValue]?[id] != nil else { return nil }
            return try state.decode(WorkoutDetailModel.self, state.workout(id))
        }
    }

    public func editWorkout(id: String) async throws -> WorkoutEditPayload {
        WorkoutEditPayload(workout: try await workoutDetail(id: id), labels: try await labels())
    }

    public func labels() async throws -> [WorkoutLabel] { try await store.read { try $0.records(table: .workoutLabels) } }

    public func createWorkout(_ values: WorkoutFormValues) async throws -> String {
        try await store.change { state in
            let id = state.insert(.workouts, ["isPublic": .bool(false), "userId": .string(DemoStore.userId)])
            try state.saveWorkout(id: id, values: values)
            return id
        }
    }

    public func saveWorkout(id: String, initialValues: WorkoutFormValues, values: WorkoutFormValues) async throws {
        try await store.change { try $0.saveWorkout(id: id, values: values) }
    }

    public func deleteWorkout(id: String) async throws {
        try await store.change { state in
            try state.editable(.workouts, id)
            for session in state.related(.sessions, "workoutId", id) {
                try state.update(.sessions, session.text("id"), ["workoutId": .null])
            }
            state.remove(.workouts, id)
        }
    }

    public func startSession(from workout: WorkoutDetailModel, startedAt: Date) async throws -> String {
        try await store.change { state in
            _ = try state.row(.workouts, workout.id)
            return try state.startSession(workoutId: workout.id, exercises: workout.workoutExercises.map(\.exercise.id), startedAt: startedAt)
        }
    }

    public func workoutDetailInsights(workoutId: String, exerciseIds: [String], today: Date) async throws -> WorkoutDetailInsights {
        try await store.read { state in
            let details = try state.sortedSessions().filter { $0.text("workoutId") == workoutId }.map {
                try state.decode(SessionDetailModel.self, state.session($0.text("id")))
            }
            let bars = details.filter { $0.strengthTotals.volume > 0 }.prefix(4).reversed().map {
                WorkoutVolumeBar(id: $0.id, startedAt: $0.startedAt, volume: $0.strengthTotals.volume)
            }
            var last: [String: String] = [:]
            for id in exerciseIds {
                let history = try state.decode([ExerciseHistoryEntry].self, .array(state.occurrences(exerciseId: id)))
                if let sets = history.first(where: { !$0.workoutSessionStrengthSets.isEmpty })?.workoutSessionStrengthSets {
                    last[id] = WorkoutDetailInsights.topSetLabel(sets.map {
                        SessionStrengthSet(id: $0.id, setNumber: $0.setNumber, reps: $0.reps, weight: $0.weight)
                    })
                }
            }
            return WorkoutDetailInsights(volumeBars: Array(bars), lastTopSetByExercise: last)
        }
    }
}

public struct DemoExercisesRepository: ExercisesRepositoryProtocol {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listExercises() async throws -> [ExerciseListItem] {
        try await store.read { try $0.records(table: .exercises) }
    }

    public func exerciseDetail(id: String) async throws -> ExerciseDetailModel? {
        try await store.read { state in
            guard state.tables[DemoTable.exercises.rawValue]?[id] != nil else { return nil }
            return try state.decode(ExerciseDetailModel.self, state.exercise(id, history: true))
        }
    }

    public func exercisePickerExercises() async throws -> [ExerciseListItem] { try await listExercises() }

    public func recentlyLoggedExerciseIds() async throws -> [String] {
        try await store.read { state in
            state.sortedSessions().prefix(10).flatMap { session in
                state.related(.sessionExercises, "sessionId", session.text("id")).filter {
                    !state.related(.sets, "parentId", $0.text("id")).isEmpty || !state.related(.cardio, "parentId", $0.text("id")).isEmpty
                }.map { $0.text("exerciseId") }
            }
        }
    }

    public func priorSessionsPerExercise(exerciseIds: [String]) async throws -> [ExercisePriorSessions] {
        try await store.read { state in
            try state.decode([ExercisePriorSessions].self, .array(exerciseIds.map { id in
                .object(["id": .string(id), "workoutSessionExercises": .array(Array(try state.occurrences(exerciseId: id).prefix(3)))])
            }))
        }
    }

    public func startAdHocSession(exerciseId: String, startedAt: Date) async throws -> String {
        try await store.change { try $0.startSession(workoutId: nil, exercises: [exerciseId], startedAt: startedAt) }
    }
}

extension DemoState {
    mutating func saveWorkout(id: String, values: WorkoutFormValues) throws {
        try editable(.workouts, id)
        for exercise in values.exercises { _ = try row(.exercises, exercise.exerciseId) }
        let links = values.labels.map { label -> JSONValue in
            let labelId = label.id ?? "demo-label-\(WorkoutLabelNormalizer.normalize(label.name))"
            insert(.workoutLabels, ["name": .string(label.name)], id: labelId)
            return .object(["labelId": .string(labelId), "label": .object(["id": .string(labelId), "name": .string(label.name)])])
        }
        try update(.workouts, id, [
            "name": .string(values.name), "description": .string(values.description),
            "exerciseIds": .array(values.exercises.map { .string($0.exerciseId) }), "workoutLabels": .array(links)
        ])
    }

    mutating func startSession(workoutId: String?, exercises: [String], startedAt: Date) throws -> String {
        for id in exercises { _ = try row(.exercises, id) }
        let id = insert(.sessions, ["workoutId": .demoOptional(workoutId), "startedAt": .string(ISO8601DateFormatter().string(from: startedAt))])
        for (position, exerciseId) in exercises.enumerated() {
            insert(.sessionExercises, ["sessionId": .string(id), "exerciseId": .string(exerciseId), "position": .number(Double(position))])
        }
        return id
    }
}
