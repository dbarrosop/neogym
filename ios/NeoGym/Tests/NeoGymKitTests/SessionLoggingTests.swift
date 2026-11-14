import Foundation
import XCTest
@testable import NeoGymKit

final class SessionLoggingTests: XCTestCase {
    private func set(_ number: Int, _ reps: Int, _ weight: Double) -> SessionStrengthSet {
        SessionStrengthSet(id: "s\(number)-\(reps)-\(weight)", setNumber: number, reps: reps, weight: weight)
    }

    private func exercise(_ id: String, kind: String = "strength") -> SessionExerciseDetail {
        SessionExerciseDetail(id: id, name: id.capitalized, kind: kind, primaryMuscleGroup: "quadriceps")
    }

    private func row(
        _ id: String, position: Int, exercise: SessionExerciseDetail,
        sets: [SessionStrengthSet] = [], cardio: Int = 0
    ) -> SessionExerciseRow {
        SessionExerciseRow(
            id: id, position: position, exercise: exercise,
            workoutSessionStrengthSets: sets,
            workoutSessionCardioEntries: (0..<cardio).map { SessionCardioEntryShell(id: "c\($0)", entryNumber: $0 + 1) }
        )
    }

    func testLastTimePrefersSameWorkoutThenExerciseHistory() {
        let older = SessionDetailModel(id: "w-old", startedAt: "2026-10-21T06:00:00Z", workoutSessionExercises: [
            row("r-old", position: 1, exercise: exercise("rdl"), sets: [set(1, 10, 135)])
        ])
        let newer = SessionDetailModel(id: "w-new", startedAt: "2026-10-28T06:00:00Z", workoutSessionExercises: [
            row("r-new", position: 1, exercise: exercise("rdl"), sets: [set(2, 9, 140), set(1, 10, 140)])
        ])
        let history = [SessionPriorStrengthEntry(id: "h", startedAt: "2026-11-01T06:00:00Z", sets: [set(1, 5, 150)])]

        let fromWorkout = SessionLogging.lastTime(exerciseId: "rdl", priorWorkoutSessions: [older, newer], exerciseHistory: history)
        XCTAssertEqual(fromWorkout?.id, "r-new")
        XCTAssertEqual(fromWorkout?.sets.map(\.setNumber), [1, 2])

        let fallback = SessionLogging.lastTime(exerciseId: "squat", priorWorkoutSessions: [newer], exerciseHistory: [
            SessionPriorStrengthEntry(id: "empty", startedAt: "2026-11-05T06:00:00Z", sets: []),
            SessionPriorStrengthEntry(id: "h1", startedAt: "2026-10-01T06:00:00Z", sets: [set(1, 8, 100)]),
            SessionPriorStrengthEntry(id: "h2", startedAt: "2026-10-15T06:00:00Z", sets: [set(1, 8, 105)])
        ])
        XCTAssertEqual(fallback?.id, "h2")
        XCTAssertNil(SessionLogging.lastTime(exerciseId: "none", priorWorkoutSessions: [], exerciseHistory: []))
    }

    func testActiveExerciseIsFirstWithFewerSetsThanLastTime() {
        let session = SessionDetailModel(id: "s", startedAt: "2026-11-12T06:00:00Z", workoutSessionExercises: [
            row("a", position: 1, exercise: exercise("rdl"), sets: [set(1, 6, 140), set(2, 7, 140), set(3, 6, 140)]),
            row("b", position: 2, exercise: exercise("split"), sets: [set(1, 9, 28)]),
            row("c", position: 3, exercise: exercise("bike", kind: "cardio"))
        ])
        let lastTime = [
            "rdl": SessionPriorStrengthEntry(id: "1", startedAt: "", sets: [set(1, 10, 135), set(2, 9, 135), set(3, 8, 135)]),
            "split": SessionPriorStrengthEntry(id: "2", startedAt: "", sets: [set(1, 9, 28), set(2, 9, 28)])
        ]
        XCTAssertEqual(SessionLogging.defaultActiveExerciseId(session: session, lastTimeByExercise: lastTime), "b")

        // Without history one set is enough; cardio needs one entry.
        XCTAssertEqual(SessionLogging.defaultActiveExerciseId(session: session, lastTimeByExercise: [:]), "c")
        let done = SessionDetailModel(id: "s", startedAt: "", workoutSessionExercises: [
            row("a", position: 1, exercise: exercise("rdl"), sets: [set(1, 6, 140)]),
            row("c", position: 2, exercise: exercise("bike", kind: "cardio"), cardio: 1)
        ])
        XCTAssertNil(SessionLogging.defaultActiveExerciseId(session: done, lastTimeByExercise: [:]))
    }

    func testStatusAndCollapsedSummaries() {
        let last = SessionPriorStrengthEntry(id: "l", startedAt: "", sets: [set(1, 10, 135), set(2, 9, 135), set(3, 8, 135)])
        XCTAssertEqual(SessionLogging.strengthStatus(sets: [], lastTime: last), .todo)
        XCTAssertEqual(SessionLogging.strengthStatus(sets: [set(1, 6, 140)], lastTime: last), .started)
        XCTAssertEqual(SessionLogging.strengthStatus(sets: [set(1, 6, 140), set(2, 7, 140), set(3, 6, 140)], lastTime: last), .done)
        XCTAssertEqual(SessionLogging.strengthStatus(sets: [set(1, 6, 140)], lastTime: nil), .done)
        XCTAssertEqual(SessionLogging.cardioStatus(entryCount: 0), .todo)

        XCTAssertEqual(
            SessionLogging.collapsedSummary(sets: [set(2, 7, 140), set(1, 6, 140), set(3, 6, 140)], lastTime: last),
            "140 kg × 6 · 7 · 6"
        )
        XCTAssertEqual(SessionLogging.collapsedSummary(sets: [], lastTime: last), "Last time 135 kg × 10 · 9 · 8")
        XCTAssertEqual(SessionLogging.collapsedSummary(sets: [], lastTime: nil), "No sets yet")
        XCTAssertEqual(SessionLogging.lastTimeTrailing(last), "last 135 × 10 · 9 · 8")
        XCTAssertEqual(SessionLogging.lastTimeSet(at: 1, lastTime: last)?.reps, 9)
        XCTAssertNil(SessionLogging.lastTimeSet(at: 3, lastTime: last))
    }

    func testRecentSessionsKeepThreeNewestWithSets() {
        let history = [
            SessionPriorStrengthEntry(id: "a", startedAt: "2026-10-13T06:00:00Z", sets: [set(1, 12, 90), set(2, 12, 90), set(3, 11, 90)]),
            SessionPriorStrengthEntry(id: "b", startedAt: "2026-10-28T06:00:00Z", sets: [set(2, 11, 95), set(1, 12, 95), set(3, 10, 95)]),
            SessionPriorStrengthEntry(id: "c", startedAt: "2026-11-02T06:00:00Z", sets: []),
            SessionPriorStrengthEntry(id: "d", startedAt: "2026-10-21T06:00:00Z", sets: [set(1, 11, 95), set(2, 10, 95), set(3, 10, 95)]),
            SessionPriorStrengthEntry(id: "e", startedAt: "2026-10-06T06:00:00Z", sets: [set(1, 10, 90)])
        ]
        let recent = SessionLogging.recentSessions(history)
        XCTAssertEqual(recent.map(\.id), ["b", "d", "a"])
        XCTAssertEqual(SessionLogging.setsSummary(recent[0].sets), "95 × 12 · 11 · 10")
        XCTAssertEqual(SessionLogging.setsSummary([set(1, 12, 95), set(2, 10, 90)]), "95 × 12 · 90 × 10")
        XCTAssertEqual(SessionLogging.setsSummary([set(1, 20, 0), set(2, 15, 0)]), "BW × 20 · 15")
        XCTAssertNil(SessionLogging.setsSummary([]))
    }

    func testNextSetDraftPrefillsAndSteps() {
        let last = SessionPriorStrengthEntry(id: "l", startedAt: "", sets: [set(1, 12, 95)])
        var draft = NextSetDraft.suggested(currentSets: [], lastTime: last)
        XCTAssertEqual(draft, NextSetDraft(weight: 95, reps: 12))

        draft = NextSetDraft.suggested(currentSets: [set(1, 11, 95), set(2, 12, 97.5)], lastTime: last)
        XCTAssertEqual(draft, NextSetDraft(weight: 97.5, reps: 12))
        draft.stepWeight(1)
        draft.stepReps(-1)
        XCTAssertEqual(draft, NextSetDraft(weight: 100, reps: 11))
        XCTAssertEqual(draft.weightLabel, "100 kg")
        XCTAssertEqual(draft.volume(doubleWeight: true), 2_200)

        var floor = NextSetDraft(weight: 1, reps: 0)
        floor.stepWeight(-1)
        floor.stepReps(-1)
        XCTAssertEqual(floor, NextSetDraft(weight: 0, reps: 0))
        XCTAssertEqual(floor.weightLabel, "BW")
        XCTAssertEqual(NextSetDraft.suggested(currentSets: [], lastTime: nil), NextSetDraft(weight: 0, reps: 0))
    }

    func testSuccessfulLogClearsOnlyAnUnchangedStoredDraft() {
        for submitted: NextSetDraft? in [nil, NextSetDraft(weight: 95, reps: 12)] {
            XCTAssertNil(NextSetDraft.remainingAfterLogging(current: submitted, submitted: submitted))
        }
    }

    func testSuccessfulLogPreservesWeightOrRepsPreparedDuringSubmission() {
        let suggestion = NextSetDraft(weight: 95, reps: 12)
        for submitted: NextSetDraft? in [nil, suggestion] {
            var changedWeight = submitted ?? suggestion
            changedWeight.stepWeight(1)
            XCTAssertEqual(
                NextSetDraft.remainingAfterLogging(current: changedWeight, submitted: submitted),
                NextSetDraft(weight: 97.5, reps: 12)
            )

            var changedReps = submitted ?? suggestion
            changedReps.stepReps(-1)
            XCTAssertEqual(
                NextSetDraft.remainingAfterLogging(current: changedReps, submitted: submitted),
                NextSetDraft(weight: 95, reps: 11)
            )
        }
    }

    func testSuccessfulLogPreservesAnExplicitDraftMatchingTheSubmittedSuggestion() {
        let suggestion = NextSetDraft(weight: 95, reps: 12)
        // The user can step away and back while an untouched suggestion is in flight.
        // Compare stored optionals, not the resolved suggestion used for the insert.
        XCTAssertEqual(NextSetDraft.remainingAfterLogging(current: suggestion, submitted: nil), suggestion)
    }

    func testWeekGroupingUsesMondayWeeksWithRelativeTitles() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Stockholm")!
        func item(_ id: String, _ startedAt: String, sets: Int) -> SessionListItem {
            SessionListItem(id: id, startedAt: startedAt, workoutSessionExercises: [
                SessionListExerciseRow(
                    exercise: SessionListExercise(id: "e", name: "E"),
                    workoutSessionStrengthSetsAggregate: SessionStrengthSetsAggregate(aggregate: .init(count: sets))
                )
            ])
        }
        // Thursday 12 Nov 2026; Monday is 9 Nov.
        let now = ISO8601DateFormatter().date(from: "2026-11-12T10:00:00Z")!
        let groups = SessionWeekGrouping.groups([
            item("a", "2026-11-12T05:03:00Z", sets: 15),
            item("b", "2026-11-09T05:00:00Z", sets: 22),
            item("c", "2026-11-08T05:22:00Z", sets: 18),
            item("d", "2026-10-28T05:00:00Z", sets: 15)
        ], now: now, calendar: calendar, locale: Locale(identifier: "en_GB"))
        XCTAssertEqual(groups.map(\.title), ["This week", "Last week", "Week of 26 Oct"])
        XCTAssertEqual(groups.map { $0.sessions.map(\.id) }, [["a", "b"], ["c"], ["d"]])
        XCTAssertEqual(groups.first?.summary, "2 sessions · 37 sets")
        XCTAssertEqual(groups[1].summary, "1 session · 18 sets")
    }
}
