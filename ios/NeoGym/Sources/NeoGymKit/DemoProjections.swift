import Foundation

/// Joins normalized demo records into the same DTOs consumed by live view models.
/// No GraphQL parsing, transport interception, or production cache is involved.
extension DemoState {
    func exercise(_ id: String, history: Bool = false) throws -> JSONValue {
        var record = try row(.exercises, id)
        record["workoutSessionExercises"] = .array(history ? try occurrences(exerciseId: id) : [])
        return .object(record)
    }

    func workout(_ id: String) throws -> JSONValue {
        var record = try row(.workouts, id)
        let ids: [String]
        if case let .array(values) = record["exerciseIds"] {
            ids = values.compactMap { if case let .string(id) = $0 { id } else { nil } }
        } else { ids = [] }
        record["workoutExercises"] = .array(try ids.enumerated().map { index, exerciseId in
            .object([
                "id": .string("\(id)-exercise-\(index)"), "position": .number(Double(index)),
                "exercise": try exercise(exerciseId)
            ])
        })
        record["workoutExercises_aggregate"] = count(ids.count)
        return .object(record)
    }

    func session(_ id: String, list: Bool = false) throws -> JSONValue {
        var record = try row(.sessions, id)
        record["workout"] = try sessionWorkout(record)
        let children = related(.sessionExercises, "sessionId", id)
        record["workoutSessionExercises_aggregate"] = count(children.count)
        record["workoutSessionExercises"] = .array(try children.map { child in
            var result = child
            result["exercise"] = try exercise(child.text("exerciseId"))
            let sets = related(.sets, "parentId", child.text("id")).sorted { $0.number("setNumber") < $1.number("setNumber") }
            let cardio = related(.cardio, "parentId", child.text("id")).sorted { $0.number("entryNumber") < $1.number("entryNumber") }
            result["workoutSessionStrengthSets"] = .array(sets.map(JSONValue.object))
            result["workoutSessionCardioEntries"] = .array(cardio.map(JSONValue.object))
            result["workoutSessionStrengthSets_aggregate"] = .object([
                "aggregate": .object([
                    "count": .number(Double(sets.count)),
                    "sum": .object(["reps": .number(sets.reduce(0) { $0 + $1.number("reps") })])
                ])
            ])
            result["workoutSessionCardioEntries_aggregate"] = count(cardio.count)
            return .object(result)
        })
        return .object(record)
    }

    func sessionWorkout(_ record: DemoRecord) throws -> JSONValue {
        let id = record.text("workoutId")
        guard !id.isEmpty, tables[DemoTable.workouts.rawValue]?[id] != nil else { return .null }
        return .object(try row(.workouts, id))
    }

    func sortedSessions() -> [DemoRecord] {
        rows(.sessions).sorted {
            $0.text("startedAt") == $1.text("startedAt")
                ? $0.text("id") < $1.text("id") : $0.text("startedAt") > $1.text("startedAt")
        }
    }

    func occurrences(exerciseId: String, before: Date = .distantFuture, workoutId: String? = nil,
                     excluding: String = "") throws -> [JSONValue] {
        try sortedSessions().filter {
            $0.text("id") != excluding
                && (ExerciseDateParser.parseTimestamp($0.text("startedAt")) ?? .distantFuture) < before
                && (workoutId == nil || $0.text("workoutId") == workoutId)
        }.flatMap { session in
            try related(.sessionExercises, "sessionId", session.text("id")).filter {
                $0.text("exerciseId") == exerciseId
            }.compactMap { child -> JSONValue? in
                let sets = related(.sets, "parentId", child.text("id")).sorted { $0.number("setNumber") < $1.number("setNumber") }
                let cardio = related(.cardio, "parentId", child.text("id")).sorted { $0.number("entryNumber") < $1.number("entryNumber") }
                guard !sets.isEmpty || !cardio.isEmpty else { return nil }
                var parent = session
                parent["workout"] = try sessionWorkout(session)
                return .object([
                    "id": child["id"] ?? .null, "workoutSession": .object(parent),
                    "workoutSessionStrengthSets": .array(sets.map(JSONValue.object)),
                    "workoutSessionCardioEntries": .array(cardio.map(JSONValue.object))
                ])
            }
        }
    }

    func meal(_ id: String) throws -> JSONValue {
        var record = try row(.meals, id)
        record["mealIngredients"] = .array(try related(.ingredients, "mealId", id).map { ingredient in
            var child = ingredient
            child["food"] = .object(try row(.foods, ingredient.text("foodId")))
            return .object(child)
        })
        record["nutritionPlanMeals"] = .array(related(.planMeals, "mealId", id).map { slot in
            var child = slot
            child["nutritionPlan"] = tables[DemoTable.plans.rawValue]?[slot.text("nutritionPlanId")].map(JSONValue.object) ?? .null
            return .object(child)
        })
        return .object(record)
    }

    func plan(_ id: String) throws -> JSONValue {
        var record = try row(.plans, id)
        record["nutritionPlanMeals"] = .array(try related(.planMeals, "nutritionPlanId", id).map { slot in
            var child = slot
            child["meal"] = try meal(slot.text("mealId"))
            return .object(child)
        })
        record["nutritionPlanFoods"] = .array(try related(.planFoods, "nutritionPlanId", id).map { slot in
            var child = slot
            child["food"] = .object(try row(.foods, slot.text("foodId")))
            return .object(child)
        })
        return .object(record)
    }

    func day(_ id: String) throws -> JSONValue {
        var record = try row(.days, id)
        let planId = record.text("nutritionPlanId")
        record["nutritionPlan"] = planId.isEmpty ? .null : try plan(planId)
        record["nutritionLogMeals"] = .array(related(.logMeals, "nutritionDayId", id).map { meal in
            var child = meal
            child["nutritionLogEntries"] = .array(related(.logEntries, "nutritionLogMealId", meal.text("id")).map(JSONValue.object))
            return .object(child)
        })
        record["nutritionLogEntries"] = .array(related(.logEntries, "nutritionDayId", id)
            .filter { $0.text("nutritionLogMealId").isEmpty }.map(JSONValue.object))
        return .object(record)
    }

    func count(_ value: Int) -> JSONValue { .object(["aggregate": .object(["count": .number(Double(value))])]) }

    mutating func removeSessionExercise(_ id: String) {
        for table in [DemoTable.sets, .cardio] {
            for child in related(table, "parentId", id) { remove(table, child.text("id")) }
        }
        remove(.sessionExercises, id)
    }

    mutating func removeLogMeal(_ id: String) {
        for child in related(.logEntries, "nutritionLogMealId", id) { remove(.logEntries, child.text("id")) }
        remove(.logMeals, id)
    }
}
