import Foundation

public struct DemoSessionsRepository: SessionsRepositoryProtocol, TodayTrainingProviding {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listSessions(limit: Int, offset: Int) async throws -> [SessionListItem] {
        try await store.read { state in
            try state.decode([SessionListItem].self, .array(state.sortedSessions().dropFirst(max(offset, 0)).prefix(max(limit, 0)).map {
                try state.session($0.text("id"), list: true)
            }))
        }
    }

    public func sessionDetail(id: String) async throws -> SessionDetailModel? {
        try await store.read { state in
            guard state.tables[DemoTable.sessions.rawValue]?[id] != nil else { return nil }
            return try state.decode(SessionDetailModel.self, state.session(id))
        }
    }

    public func todayTrainingUpdates(window: TodayTrainingWindow) -> AsyncThrowingStream<TodayTrainingSnapshot, Error> {
        singleValueUpdates {
            try await store.read { state in
                let sessions = state.sortedSessions()
                let today = sessions.filter {
                    guard let date = ExerciseDateParser.parseTimestamp($0.text("startedAt")) else { return false }
                    return date >= window.dayStart && date < window.dayEnd
                }
                return TodayTrainingSnapshot(
                    todaySessions: try state.decode([SessionDetailModel].self, .array(today.map { try state.session($0.text("id")) })),
                    latestSession: try state.decode([SessionListItem].self, .array(sessions.prefix(1).map { try state.session($0.text("id"), list: true) })),
                    recentSessions: SessionCountAggregate(aggregate: .init(count: sessions.filter {
                        (ExerciseDateParser.parseTimestamp($0.text("startedAt")) ?? .distantPast) >= window.weekStart
                    }.count))
                )
            }
        }
    }

    public func priorSessionsPerExercise(
        exerciseIds: [String], before: Date, workoutId: String?, excludeSessionId: String
    ) async throws -> SessionPriorHistory {
        try await store.read { state in
            SessionPriorHistory(exercises: try exerciseIds.map { id in
                let all = try state.occurrences(exerciseId: id, before: before, excluding: excludeSessionId)
                let same = try workoutId.map { try state.occurrences(exerciseId: id, before: before, workoutId: $0, excluding: excludeSessionId) } ?? []
                return SessionPriorExerciseHistory(
                    id: id,
                    workoutSessionExercises: try state.decode([SessionPriorWorkoutSessionExercise].self, .array(Array(all.prefix(3)))),
                    sameWorkoutSessions: try state.decode([SessionPriorWorkoutSessionExercise].self, .array(Array(same.prefix(3))))
                )
            })
        }
    }

    public func priorWorkoutSessions(workoutId: String, before: Date, excludeSessionId: String) async throws -> [SessionDetailModel] {
        try await store.read { state in
            let matches = state.sortedSessions().filter {
                $0.text("workoutId") == workoutId && $0.text("id") != excludeSessionId
                    && (ExerciseDateParser.parseTimestamp($0.text("startedAt")) ?? .distantFuture) < before
            }.prefix(3)
            return try state.decode([SessionDetailModel].self, .array(matches.map { try state.session($0.text("id")) }))
        }
    }

    public func updateStartedAt(sessionId: String, startedAt: Date) async throws {
        try await store.change { try $0.update(.sessions, sessionId, ["startedAt": .string(ISO8601DateFormatter().string(from: startedAt))]) }
    }

    public func deleteSession(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.sessions, id)
            for row in state.related(.sessionExercises, "sessionId", id) { state.removeSessionExercise(row.text("id")) }
            state.remove(.sessions, id)
        }
    }

    public func addSessionExercises(sessionId: String, exercises: [ExerciseListItem], basePosition: Int) async throws {
        try await store.change { state in
            _ = try state.row(.sessions, sessionId)
            for (index, exercise) in exercises.enumerated() {
                _ = try state.row(.exercises, exercise.id)
                state.insert(.sessionExercises, [
                    "sessionId": .string(sessionId), "exerciseId": .string(exercise.id), "position": .number(Double(basePosition + index))
                ])
            }
        }
    }

    public func removeSessionExercise(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.sessionExercises, id)
            state.removeSessionExercise(id)
        }
    }

    public func addStrengthSet(workoutSessionExerciseId: String, setNumber: Int, reps: Int, weight: Double) async throws -> String {
        try await store.change { state in
            try state.validateStrength(parentId: workoutSessionExerciseId, reps: reps, weight: weight)
            return state.insert(.sets, [
                "parentId": .string(workoutSessionExerciseId), "setNumber": .number(Double(setNumber)),
                "reps": .number(Double(reps)), "weight": .number(weight)
            ])
        }
    }

    public func updateStrengthSet(id: String, reps: Int, weight: Double) async throws {
        try await store.change { state in
            let row = try state.row(.sets, id)
            try state.validateStrength(parentId: row.text("parentId"), reps: reps, weight: weight)
            try state.update(.sets, id, ["reps": .number(Double(reps)), "weight": .number(weight)])
        }
    }

    public func deleteStrengthSet(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.sets, id)
            state.remove(.sets, id)
        }
    }

    public func addCardioEntry(workoutSessionExerciseId: String, entryNumber: Int, metrics: CardioMetrics) async throws -> String {
        try await store.change { state in
            try state.validateCardio(parentId: workoutSessionExerciseId, metrics: metrics)
            return state.insert(.cardio, [
                "parentId": .string(workoutSessionExerciseId), "entryNumber": .number(Double(entryNumber)),
                "metrics": .object(metrics.mapValues(JSONValue.number))
            ])
        }
    }

    public func updateCardioEntry(id: String, metrics: CardioMetrics) async throws {
        try await store.change { state in
            let row = try state.row(.cardio, id)
            try state.validateCardio(parentId: row.text("parentId"), metrics: metrics)
            try state.update(.cardio, id, ["metrics": .object(metrics.mapValues(JSONValue.number))])
        }
    }

    public func deleteCardioEntry(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.cardio, id)
            state.remove(.cardio, id)
        }
    }
}

extension DemoState {
    func validateStrength(parentId: String, reps: Int, weight: Double) throws {
        let parent = try row(.sessionExercises, parentId)
        let exercise = try row(.exercises, parent.text("exerciseId"))
        guard exercise.text("kind") == "strength", reps >= 0, weight.isFinite, weight >= 0 else { throw DemoError.invalidEntry }
    }

    func validateCardio(parentId: String, metrics: CardioMetrics) throws {
        let parent = try row(.sessionExercises, parentId)
        let exercise = try decode(SessionExerciseDetail.self, exercise(parent.text("exerciseId")))
        guard exercise.isCardio, let schema = exercise.cardioSchema,
              metrics.values.allSatisfy(\.isFinite), CardioMetricsSchemaHelpers.validate(metrics: metrics, against: schema).isEmpty
        else { throw DemoError.invalidEntry }
    }
}
