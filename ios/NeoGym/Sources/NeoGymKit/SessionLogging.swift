import Foundation

/// Where an exercise stands in the current session, relative to last time.
public enum SessionExerciseStatus: Sendable, Equatable {
    case done
    case started
    case todo
}

/// Host-testable rules behind the session logging screen: which exercise is
/// active, how a finished one collapses, and what "last time" means.
public enum SessionLogging {
    /// The previous performance of an exercise: the most recent earlier session
    /// of the same workout that logged it, else the exercise's own history.
    public static func lastTime(
        exerciseId: String,
        priorWorkoutSessions: [SessionDetailModel],
        exerciseHistory: [SessionPriorStrengthEntry]
    ) -> SessionPriorStrengthEntry? {
        let workoutSessions = priorWorkoutSessions.sorted {
            ($0.startedAtDate ?? .distantPast) > ($1.startedAtDate ?? .distantPast)
        }
        for session in workoutSessions {
            if let row = session.workoutSessionExercises.first(where: {
                $0.exercise.id == exerciseId && !$0.workoutSessionStrengthSets.isEmpty
            }) {
                return SessionPriorStrengthEntry(
                    id: row.id,
                    startedAt: session.startedAt,
                    sets: row.workoutSessionStrengthSets.sorted { $0.setNumber < $1.setNumber }
                )
            }
        }
        return exerciseHistory
            .filter { !$0.sets.isEmpty }
            .max { (ExerciseDateParser.parseTimestamp($0.startedAt) ?? .distantPast)
                < (ExerciseDateParser.parseTimestamp($1.startedAt) ?? .distantPast) }
            .map { SessionPriorStrengthEntry(id: $0.id, startedAt: $0.startedAt, sets: $0.sets.sorted { $0.setNumber < $1.setNumber }) }
    }

    public static func strengthStatus(sets: [SessionStrengthSet], lastTime: SessionPriorStrengthEntry?) -> SessionExerciseStatus {
        if sets.isEmpty { return .todo }
        return sets.count >= max(lastTime?.sets.count ?? 1, 1) ? .done : .started
    }

    public static func cardioStatus(entryCount: Int) -> SessionExerciseStatus {
        entryCount == 0 ? .todo : .done
    }

    /// The exercise you are most likely working on: the first strength exercise
    /// with fewer sets than last time (at least one), or the first cardio
    /// exercise without entries. `nil` once everything is logged.
    public static func defaultActiveExerciseId(
        session: SessionDetailModel,
        lastTimeByExercise: [String: SessionPriorStrengthEntry]
    ) -> String? {
        for row in session.workoutSessionExercises.sorted(by: { $0.position < $1.position }) {
            if row.exercise.isCardio {
                if row.workoutSessionCardioEntries.isEmpty { return row.id }
                continue
            }
            let target = max(lastTimeByExercise[row.exercise.id]?.sets.count ?? 0, 1)
            if row.workoutSessionStrengthSets.count < target { return row.id }
        }
        return nil
    }

    /// One line for a collapsed strength exercise.
    public static func collapsedSummary(sets: [SessionStrengthSet], lastTime: SessionPriorStrengthEntry?) -> String {
        let ordered = sets.sorted { $0.setNumber < $1.setNumber }
        if !ordered.isEmpty { return StrengthSetFormatting.compactSessionSummary(ordered) }
        if let lastTime, !lastTime.sets.isEmpty {
            return "Last time \(StrengthSetFormatting.compactSessionSummary(lastTime.sets))"
        }
        return "No sets yet"
    }

    /// Compact "last 135 × 10 · 9 · 8" for the trailing side of a collapsed card.
    public static func lastTimeTrailing(_ lastTime: SessionPriorStrengthEntry?) -> String? {
        guard let lastTime, let summary = setsSummary(lastTime.sets) else { return nil }
        return "last " + summary
    }

    /// "95 × 12 · 11 · 10" (or "95 × 12 · 90 × 10" when the weight changes),
    /// without units, for "last time" and the current exercise's Recent list.
    public static func setsSummary(_ sets: [SessionStrengthSet]) -> String? {
        let ordered = sets.sorted { $0.setNumber < $1.setNumber }
        guard let first = ordered.first else { return nil }
        let weight = first.weight == 0 ? "BW" : StrengthSetFormatting.formatWeight(first.weight)
        if ordered.allSatisfy({ $0.weight == first.weight }) {
            return "\(weight) × " + ordered.map { String($0.reps) }.joined(separator: " · ")
        }
        return ordered.map(StrengthSetFormatting.lastTimeCell).joined(separator: " · ")
    }

    /// The current exercise's three most recent earlier sessions with sets,
    /// newest first (the same-workout history when there is one).
    public static func recentSessions(_ history: [SessionPriorStrengthEntry], limit: Int = 3) -> [SessionPriorStrengthEntry] {
        Array(
            history
                .filter { !$0.sets.isEmpty }
                .sorted {
                    (ExerciseDateParser.parseTimestamp($0.startedAt) ?? .distantPast)
                        > (ExerciseDateParser.parseTimestamp($1.startedAt) ?? .distantPast)
                }
                .prefix(limit)
        )
    }

    /// Last time's set at the same position, for the per-set comparison column.
    public static func lastTimeSet(at index: Int, lastTime: SessionPriorStrengthEntry?) -> SessionStrengthSet? {
        guard let sets = lastTime?.sets, sets.indices.contains(index) else { return nil }
        return sets[index]
    }
}

/// The inline next-set row: prefilled from this session's previous set, else
/// last time's matching set, adjusted with steppers.
public struct NextSetDraft: Sendable, Equatable {
    public static let weightStep = 2.5
    public static let repsStep = 1

    public var weight: Double
    public var reps: Int

    public init(weight: Double, reps: Int) {
        self.weight = max(weight, 0)
        self.reps = max(reps, 0)
    }

    public static func suggested(
        currentSets: [SessionStrengthSet],
        lastTime: SessionPriorStrengthEntry?
    ) -> NextSetDraft {
        let ordered = currentSets.sorted { $0.setNumber < $1.setNumber }
        if let previous = ordered.last {
            return NextSetDraft(weight: previous.weight, reps: previous.reps)
        }
        if let first = lastTime?.sets.first {
            return NextSetDraft(weight: first.weight, reps: first.reps)
        }
        return NextSetDraft(weight: 0, reps: 0)
    }

    public mutating func stepWeight(_ direction: Int) {
        weight = max(0, ((weight + Double(direction) * Self.weightStep) * 100).rounded() / 100)
    }

    public mutating func stepReps(_ direction: Int) {
        reps = max(0, reps + direction * Self.repsStep)
    }

    /// "95 kg", "92.5 kg" or "BW".
    public var weightLabel: String {
        weight == 0 ? "BW" : "\(StrengthSetFormatting.formatWeight(weight)) kg"
    }

    public func volume(doubleWeight: Bool) -> Double {
        weight * Double(reps) * (doubleWeight ? 2 : 1)
    }
}

/// Sessions grouped by Monday-based local week, newest first.
public struct SessionWeekGroup: Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let sessions: [SessionListItem]

    public var setCount: Int { sessions.reduce(0) { $0 + $1.entryCount } }

    /// "2 sessions · 37 sets".
    public var summary: String {
        "\(sessions.count) session\(sessions.count == 1 ? "" : "s") · \(setCount) set\(setCount == 1 ? "" : "s")"
    }
}

public enum SessionWeekGrouping {
    public static func groups(
        _ sessions: [SessionListItem],
        now: Date = Date(),
        calendar: Calendar = .current,
        locale: Locale = .current
    ) -> [SessionWeekGroup] {
        var calendar = calendar
        calendar.firstWeekday = 2
        let thisWeek = weekStart(now, calendar: calendar)
        var groups: [(start: Date, sessions: [SessionListItem])] = []
        for session in sessions {
            let start = weekStart(session.startedAtDate ?? now, calendar: calendar)
            if let last = groups.last, last.start == start {
                groups[groups.count - 1].sessions.append(session)
            } else {
                groups.append((start, [session]))
            }
        }
        return groups.map { group in
            SessionWeekGroup(
                id: DateOnly.formatLocalISO(group.start, calendar: calendar),
                title: title(weekStart: group.start, thisWeek: thisWeek, calendar: calendar, locale: locale),
                sessions: group.sessions
            )
        }
    }

    private static func weekStart(_ date: Date, calendar: Calendar) -> Date {
        calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
    }

    private static func title(weekStart: Date, thisWeek: Date, calendar: Calendar, locale: Locale) -> String {
        let weeks = calendar.dateComponents([.weekOfYear], from: weekStart, to: thisWeek).weekOfYear ?? 0
        if weeks == 0 { return "This week" }
        if weeks == 1 { return "Last week" }
        let sameYear = calendar.component(.year, from: weekStart) == calendar.component(.year, from: thisWeek)
        var style = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone).day().month(.abbreviated)
        if !sameYear { style = style.year() }
        return "Week of \(weekStart.formatted(style))"
    }
}
