import Foundation

public extension DemoSessionsRepository {
    func strengthProgressUpdates(fromDay: String, throughDay: String, timeZone: String) -> AsyncThrowingStream<[StrengthProgressRow], Error> {
        singleValueUpdates {
            try await store.read { state in
                let calendar = try DemoReportCalendar.make(from: fromDay, through: throughDay, timeZone: timeZone)
                var result: [StrengthProgressRow] = []
                for record in state.sortedSessions() {
                    guard let date = ExerciseDateParser.parseTimestamp(record.text("startedAt")) else { continue }
                    let day = DateOnly.formatLocalISO(date, calendar: calendar)
                    guard day >= fromDay, day <= throughDay else { continue }
                    let detail = try state.decode(SessionDetailModel.self, state.session(record.text("id")))
                    let rows = Dictionary(grouping: detail.workoutSessionExercises.filter { !$0.exercise.isCardio }, by: \.exercise.id)
                    for (exerciseId, occurrences) in rows {
                        let sets = occurrences.flatMap(\.workoutSessionStrengthSets).filter { $0.reps > 0 }
                        guard !sets.isEmpty, let exercise = occurrences.first?.exercise else { continue }
                        let multiplier = exercise.doubleWeight ? 2.0 : 1.0
                        let estimates = sets.filter { $0.reps > 0 && $0.weight > 0 }.map {
                            StrengthOneRepMax.estimate(weight: $0.weight, reps: $0.reps)
                        }
                        result.append(StrengthProgressRow(
                            exerciseId: exerciseId, sessionId: detail.id, startedAt: detail.startedAt, exerciseName: exercise.name,
                            volume: sets.reduce(0) { $0 + $1.volume * multiplier }, estimatedOneRepMax: estimates.max()
                        ))
                    }
                }
                return result.sorted { $0.startedAt == $1.startedAt ? $0.id < $1.id : $0.startedAt < $1.startedAt }
            }
        }
    }

    func muscleSetProgressUpdates(fromDay: String, throughDay: String, timeZone: String) -> AsyncThrowingStream<[MuscleSetProgressRow], Error> {
        singleValueUpdates {
            try await store.read { state in
                let calendar = try DemoReportCalendar.make(from: fromDay, through: throughDay, timeZone: timeZone)
                return try state.muscleProgress(fromDay: fromDay, throughDay: throughDay, calendar: calendar)
            }
        }
    }
}

private enum DemoReportCalendar {
    static func make(from: String, through: String, timeZone: String) throws -> Calendar {
        guard let zone = TimeZone(identifier: timeZone), DateOnly.parse(from) != nil, DateOnly.parse(through) != nil, from <= through else {
            throw DemoError.invalidEntry
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        guard let start = IntakeGrouping.localDateToDate(from, calendar: calendar),
              let end = IntakeGrouping.localDateToDate(through, calendar: calendar),
              let days = calendar.dateComponents([.day], from: start, to: end).day, days < 366
        else { throw DemoError.invalidEntry }
        return calendar
    }
}

private extension DemoState {
    func muscleProgress(fromDay: String, throughDay: String, calendar: Calendar) throws -> [MuscleSetProgressRow] {
        var credits: [String: [String: (direct: Int, indirect: Int)]] = [:]
        var muscles = Set<String>()
        for exercise in rows(.exercises) where exercise.text("kind") != "cardio" && exercise.text("category") != "stretching" {
            let model = try decode(ExerciseListItem.self, .object(exercise))
            muscles.insert(model.primaryMuscleGroup)
            muscles.formUnion(model.secondaryMuscleGroups.map(\.muscleGroup))
        }
        for session in sortedSessions() {
            guard let date = ExerciseDateParser.parseTimestamp(session.text("startedAt")) else { continue }
            let day = DateOnly.formatLocalISO(date, calendar: calendar)
            for parent in related(.sessionExercises, "sessionId", session.text("id")) {
                let exercise = try row(.exercises, parent.text("exerciseId"))
                guard exercise.text("kind") != "cardio", exercise.text("category") != "stretching" else { continue }
                let model = try decode(ExerciseListItem.self, .object(exercise))
                let count = related(.sets, "parentId", parent.text("id")).filter { $0.number("reps") > 0 }.count
                let primary = model.primaryMuscleGroup
                var direct = credits[day, default: [:]][primary, default: (0, 0)]
                direct.direct += count
                credits[day, default: [:]][primary] = direct
                for muscle in Set(model.secondaryMuscleGroups.map(\.muscleGroup)).subtracting([primary]) {
                    var secondary = credits[day, default: [:]][muscle, default: (0, 0)]
                    secondary.indirect += count
                    credits[day, default: [:]][muscle] = secondary
                }
            }
        }
        var result: [MuscleSetProgressRow] = []
        var day = fromDay
        while day <= throughDay {
            let window = (0..<7).map { IntakeGrouping.addLocalDateDays(day, days: -$0, calendar: calendar) }
            for muscle in muscles.sorted() {
                let direct = window.reduce(0) { $0 + (credits[$1]?[muscle]?.direct ?? 0) }
                let indirect = window.reduce(0) { $0 + (credits[$1]?[muscle]?.indirect ?? 0) }
                result.append(MuscleSetProgressRow(
                    day: day, muscleGroup: muscle, rollingDirectSets: direct, rollingIndirectSets: indirect,
                    rollingWeightedSets: Double(direct) + Double(indirect) * 0.5
                ))
            }
            day = IntakeGrouping.addLocalDateDays(day, days: 1, calendar: calendar)
        }
        return result
    }
}
