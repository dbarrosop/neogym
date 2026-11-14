import Foundation

/// All content is fictional. Dates use calendar arithmetic, not fixed 24-hour offsets.
enum DemoSeed {
    static let workoutId = "demo-workout-foundation"
    static let planId = "demo-plan-training"
    static let nutrients = ["Kcal", "Fat", "Carbs", "Protein", "Fiber", "Sugar"]

    static func make(now: Date, calendar: Calendar) -> DemoState {
        var state = DemoState()
        catalog(&state)
        let start = calendar.date(byAdding: .day, value: -90, to: now) ?? now
        state.preparedThrough = DateOnly.formatLocalISO(calendar.date(byAdding: .day, value: -1, to: start) ?? start, calendar: calendar)
        advance(&state, now: now, calendar: calendar)
        return state
    }

    static func advance(_ state: inout DemoState, now: Date, calendar: Calendar) {
        let today = DateOnly.formatLocalISO(now, calendar: calendar)
        guard state.preparedThrough < today else { return }
        let first = max(state.preparedThrough, DateOnly.formatLocalISO(calendar.date(byAdding: .day, value: -91, to: now) ?? now, calendar: calendar))
        var date = IntakeGrouping.localDateToDate(first, calendar: calendar) ?? now
        while let next = calendar.date(byAdding: .day, value: 1, to: date), next <= calendar.startOfDay(for: now) {
            date = next
            seedDay(&state, date: date, today: today, now: now, calendar: calendar)
        }
        state.preparedThrough = today
    }

    private struct ExerciseSeed {
        let slug: String
        let name: String
        let muscle: String
        let secondary: [String]
        let doubleWeight: Bool
    }

    private static func catalog(_ state: inout DemoState) {
        let exercises: [ExerciseSeed] = [
            .init(slug: "bench", name: "Barbell bench press", muscle: "chest", secondary: ["triceps", "front_delts"], doubleWeight: false),
            .init(slug: "squat", name: "Barbell squat", muscle: "quadriceps", secondary: ["glutes", "calves"], doubleWeight: false),
            .init(slug: "row", name: "Dumbbell row", muscle: "middle_back", secondary: ["lats", "biceps", "rear_delts"], doubleWeight: true),
            .init(slug: "raise", name: "Lateral raise", muscle: "side_delts", secondary: ["front_delts"], doubleWeight: true),
            .init(slug: "run", name: "Treadmill run", muscle: "cardiovascular_system", secondary: [], doubleWeight: false)
        ]
        for spec in exercises {
            let slug = spec.slug
            let cardio = slug == "run"
            state.insert(.exercises, [
                "name": .string(spec.name), "kind": .string(cardio ? "cardio" : "strength"),
                "category": .string(cardio ? "cardio" : "strength"), "primaryMuscleGroup": .string(spec.muscle),
                "equipment": .string(cardio ? "machine" : "free_weights"), "level": .string("beginner"),
                "isPublic": .bool(slug != "raise"), "userId": slug == "raise" ? .string(DemoStore.userId) : .null,
                "image1FileId": .string("demo-\(slug)"), "image2FileId": .null,
                "instructions": .array([.string("Sample exercise. Use a comfortable load and controlled movement."),
                                          .string("Keep your technique consistent and rest between sets.")]),
                "secondaryMuscleGroups": .array(spec.secondary.map { .object(["muscleGroup": .string($0)]) }),
                "strength": cardio ? .null : .object(["doubleWeight": .bool(spec.doubleWeight), "force": .string("push"), "mechanic": .string("compound")]),
                "cardio": cardio ? .object(["metricsSchema": runningSchema]) : .null
            ], id: "demo-exercise-\(slug)")
        }
        state.insert(.workoutLabels, ["name": .string("strength")], id: "demo-label-strength")
        let label: JSONValue = .object([
            "labelId": .string("demo-label-strength"),
            "label": .object(["id": .string("demo-label-strength"), "name": .string("strength")])
        ])
        for (id, name, slugs, isPublic) in [
            (workoutId, "Strength foundation", ["bench", "squat", "row", "raise"], false),
            ("demo-workout-cardio", "Run and reset", ["run", "squat"], false),
            ("demo-workout-public", "Simple full body", ["squat", "bench", "row"], true)
        ] {
            state.insert(.workouts, [
                "name": .string(name), "description": .string("## A balanced session\n\nWarm up first, then move through the exercises at your own pace.\n\nThis is fictional demo data."),
                "isPublic": .bool(isPublic), "userId": isPublic ? .null : .string(DemoStore.userId),
                "exerciseIds": .array(slugs.map { .string("demo-exercise-\($0)") }), "workoutLabels": .array([label])
            ], id: id)
        }
        let foods: [(String, String, [Double])] = [
            ("yogurt", "Greek yogurt", [73, 2, 4, 9, 0, 4]), ("oats", "Rolled oats", [389, 7, 66, 17, 11, 1]),
            ("berries", "Blueberries", [57, 0.3, 14, 0.7, 2.4, 10]), ("chicken", "Chicken breast", [165, 3.6, 0, 31, 0, 0]),
            ("rice", "Cooked rice", [130, 0.3, 28, 2.7, 0.4, 0]), ("broccoli", "Broccoli", [35, 0.4, 7, 2.4, 3.3, 1.4]),
            ("banana", "Banana", [89, 0.3, 23, 1.1, 2.6, 12]), ("snack", "My protein snack", [220, 8, 20, 17, 4, 3])
        ]
        for (slug, name, values) in foods {
            var food: DemoRecord = ["name": .string(name), "isPublic": .bool(slug != "snack"), "userId": slug == "snack" ? .string(DemoStore.userId) : .null]
            for (index, nutrient) in nutrients.enumerated() { food[nutrient.prefix(1).lowercased() + nutrient.dropFirst() + "Per100g"] = .number(values[index]) }
            state.insert(.foods, food, id: "demo-food-\(slug)")
        }
        for (slug, name, ingredients) in [
            ("breakfast", "Yogurt and oats", [("yogurt", 200.0), ("oats", 60.0), ("berries", 80.0)]),
            ("lunch", "Chicken rice bowl", [("chicken", 150.0), ("rice", 200.0), ("broccoli", 120.0)])
        ] {
            let mealId = "demo-meal-\(slug)"
            state.insert(.meals, ["name": .string(name), "description": .string("A reusable sample meal.")], id: mealId)
            for (index, ingredient) in ingredients.enumerated() {
                state.insert(.ingredients, ["mealId": .string(mealId),
                    "foodId": .string("demo-food-\(ingredient.0)"),
                    "grams": .number(ingredient.1),
                    "position": .number(Double(index))], id: "\(mealId)-\(index)")
            }
        }
        state.insert(.plans, ["name": .string("Training day"), "description": .string("A sample day with mixed food and meal slots.")], id: planId)
        for (slug, time) in [("breakfast", "07:30:00"), ("lunch", "12:30:00"), ("lunch", "19:00:00")] {
            state.insert(.planMeals, ["nutritionPlanId": .string(planId),
                "mealId": .string("demo-meal-\(slug)"),
                "slotTime": .string(time),
                "label": .string(slug.capitalized),
                "position": .number(0)], id: "demo-plan-meal-\(time)")
        }
        state.insert(.planFoods, ["nutritionPlanId": .string(planId),
            "foodId": .string("demo-food-banana"),
            "grams": .number(120),
            "slotTime": .string("16:00:00"),
            "position": .number(0)], id: "demo-plan-food-snack")
        state.insert(.journalLabels, ["name": .string("training")], id: "demo-journal-label")
    }

    private static func seedDay(_ state: inout DemoState, date: Date, today: String, now: Date, calendar: Calendar) {
        let day = DateOnly.formatLocalISO(date, calendar: calendar)
        let ordinal = calendar.ordinality(of: .day, in: .era, for: date) ?? 0
        let isToday = day == today
        let currentStart = max(calendar.startOfDay(for: now), now.addingTimeInterval(-2700))
        let timestamp = ISO8601DateFormatter().string(from: isToday ? currentStart : calendar.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date)
        if state.tables[DemoTable.foods.rawValue]?["demo-food-yogurt"] != nil {
            let dayId = "demo-day-\(day)"
            let selectedPlan: JSONValue = state.tables[DemoTable.plans.rawValue]?[planId] == nil ? .null : .string(planId)
            state.insert(.days, ["logDate": .string(day), "userId": .string(DemoStore.userId), "nutritionPlanId": selectedPlan], id: dayId)
            let groupId = "\(dayId)-breakfast"
            let hasMeal = state.tables[DemoTable.meals.rawValue]?["demo-meal-breakfast"] != nil
            if hasMeal {
                state.insert(.logMeals, [
                    "nutritionDayId": .string(dayId), "mealId": .string("demo-meal-breakfast"),
                    "name": .string("Yogurt and oats"), "slotTime": .string("07:30:00"), "position": .number(0)
                ], id: groupId)
            }
            for (index, food) in [("yogurt", 200.0), ("oats", 60.0), ("berries", 80.0)].enumerated() {
                if let source = state.tables[DemoTable.foods.rawValue]?["demo-food-\(food.0)"] {
                    var entry = foodSnapshot(source)
                    entry.merge(["nutritionDayId": .string(dayId),
                        "grams": .number(food.1),
                        "slotTime": .string("07:30:00"),
                        "position": .number(Double(index)),
                        "source": .string("food"),
                        "foodId": source["id"] ?? .null]) { _, new in new }
                    entry["nutritionLogMealId"] = hasMeal ? .string(groupId) : .null
                    state.insert(.logEntries, entry, id: "\(dayId)-breakfast-\(index)")
                }
            }
            if !isToday, let source = state.tables[DemoTable.foods.rawValue]?["demo-food-chicken"] {
                var entry = foodSnapshot(source)
                entry.merge(["nutritionDayId": .string(dayId),
                    "grams": .number(850 + Double(ordinal % 7) * 20),
                    "slotTime": .string("18:30:00"),
                    "position": .number(0),
                    "source": .string("food"),
                    "foodId": source["id"] ?? .null]) { _, new in new }
                state.insert(.logEntries, entry, id: "\(dayId)-dinner")
            }
        }
        state.insert(.energy, ["energyOn": .string(day),
            "activeKcal": .number(isToday ? 310 : 420 + Double(ordinal % 8) * 35),
            "restingKcal": .number(isToday ? 880 : 1750 + Double(ordinal % 5) * 15),
            "notes": .string("Fictional demo data"),
            "updatedAt": .string(timestamp)], id: "demo-energy-\(day)")
        if ordinal % 3 == 0 || isToday {
            state.insert(.body, ["measuredOn": .string(day),
                "weightKg": .number(78 + Double(ordinal % 13) / 10),
                "bodyFatPct": .number(18 + Double(ordinal % 9) / 10),
                "notes": .string("Fictional demo data"),
                "updatedAt": .string(timestamp)], id: "demo-body-\(day)")
            if state.tables[DemoTable.workouts.rawValue]?[workoutId] != nil {
                seedSession(&state, day: day, timestamp: timestamp, partial: isToday, ordinal: ordinal)
            }
        }
        if ordinal % 7 == 0, !isToday {
            let id = "demo-run-\(day)"
            let parent = "\(id)-exercise"
            state.insert(.sessions, ["startedAt": .string(timestamp), "workoutId": .null], id: id)
            state.insert(.sessionExercises, [
                "sessionId": .string(id), "exerciseId": .string("demo-exercise-run"), "position": .number(0)
            ], id: parent)
            state.insert(.cardio, [
                "parentId": .string(parent), "entryNumber": .number(1),
                "metrics": .object(["duration_s": .number(1800 + Double(ordinal % 4) * 60), "distance_km": .number(4.5)])
            ], id: "\(id)-entry")
        }
        if ordinal % 14 == 0 || isToday {
            state.insert(.journal, ["entryDate": .string(day),
                "title": .string(isToday ? "A steady start" : "Training notes"),
                "body": .string("## How it felt\n\nA good session with controlled reps. Next time, keep the same technique and build gradually.\n\n*This is a fictional demo entry.*"),
                "journalEntryLabels": .array([.object(["labelId": .string("demo-journal-label"),
                "label": .object(["id": .string("demo-journal-label"),
                "name": .string("training")])])])], id: "demo-journal-\(day)")
        }
    }

    private static func seedSession(_ state: inout DemoState, day: String, timestamp: String, partial: Bool, ordinal: Int) {
        let id = "demo-session-\(day)"
        state.insert(.sessions, ["startedAt": .string(timestamp), "workoutId": .string(workoutId)], id: id)
        for (index, slug) in ["bench", "squat", "row", "raise"].enumerated() {
            let parent = "\(id)-exercise-\(index)"
            state.insert(.sessionExercises, ["sessionId": .string(id), "exerciseId": .string("demo-exercise-\(slug)"), "position": .number(Double(index))], id: parent)
            let count = partial ? (index == 0 ? 1 : 0) : 3
            for number in 0..<count {
                state.insert(.sets, ["parentId": .string(parent),
                    "setNumber": .number(Double(number + 1)),
                    "reps": .number(8 + Double(ordinal % 3)),
                    "weight": .number([60.0, 80, 22.5, 7.5][index] + Double(ordinal % 4) * 2.5)], id: "\(parent)-set-\(number)")
            }
        }
    }

    static func foodSnapshot(_ food: DemoRecord) -> DemoRecord {
        var snapshot: DemoRecord = ["snapshotFoodName": food["name"] ?? .string("Food")]
        for nutrient in nutrients {
            let key = nutrient.prefix(1).lowercased() + nutrient.dropFirst() + "Per100g"
            snapshot["snapshot\(nutrient)Per100g"] = food[key] ?? .number(0)
        }
        return snapshot
    }

    static var runningSchema: JSONValue {
        .object([
            "type": .string("object"), "additionalProperties": .bool(false), "required": .array([.string("duration_s")]),
            "properties": .object([
                "duration_s": .object(["type": .string("integer"), "minimum": .number(1), "x-label": .string("Duration"), "x-unit": .string("s"), "x-format": .string("duration_seconds")]),
                "distance_km": .object(["type": .string("number"), "minimum": .number(0), "x-label": .string("Distance"), "x-unit": .string("km"), "x-format": .string("decimal")])
            ])
        ])
    }
}
