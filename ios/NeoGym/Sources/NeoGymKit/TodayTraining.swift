import Combine
import Foundation

/// Local-day bounds for the Today training query.
public struct TodayTrainingWindow: Sendable, Equatable {
    public let dayStart: Date
    public let dayEnd: Date
    /// Start of the trailing seven local days, today included.
    public let weekStart: Date

    public init(now: Date = Date(), calendar: Calendar = .current) {
        let start = calendar.startOfDay(for: now)
        dayStart = start
        dayEnd = calendar.date(byAdding: .day, value: 1, to: start) ?? start.addingTimeInterval(86_400)
        weekStart = calendar.date(byAdding: .day, value: -6, to: start) ?? start
    }

    public var variables: [String: JSONValue] {
        [
            "dayStart": GraphQLScalars.timestamptz(dayStart),
            "dayEnd": GraphQLScalars.timestamptz(dayEnd),
            "weekStart": GraphQLScalars.timestamptz(weekStart)
        ]
    }
}

public protocol TodayTrainingProviding: Sendable {
    func todayTrainingUpdates(window: TodayTrainingWindow) -> AsyncThrowingStream<TodayTrainingSnapshot, Error>
}

extension SessionsRepository: TodayTrainingProviding {
    /// Cached-first like the sessions list; the stream always revalidates.
    public func todayTrainingUpdates(window: TodayTrainingWindow) -> AsyncThrowingStream<TodayTrainingSnapshot, Error> {
        graphQL.cachedValues(
            TodayTrainingSnapshot.self,
            query: Self.todayTrainingQuery,
            variables: window.variables,
            operationName: "TodayTraining",
            namespace: "sessions",
            tags: ["sessions"],
            transform: { $0 }
        )
    }

    public static let todayTrainingQuery = """
    query TodayTraining($dayStart: timestamptz!, $dayEnd: timestamptz!, $weekStart: timestamptz!) {
      todaySessions: workoutSessions(
        where: { startedAt: { _gte: $dayStart, _lt: $dayEnd } }
        order_by: { startedAt: asc }
      ) {
        id
        startedAt
        workout { id name }
        workoutSessionExercises(order_by: { position: asc }) {
          id
          position
          exercise { id name kind primaryMuscleGroup strength { doubleWeight } }
          workoutSessionStrengthSets(order_by: { setNumber: asc }) { id setNumber reps weight }
          workoutSessionCardioEntries(order_by: { entryNumber: asc }) { id entryNumber metrics }
        }
      }
      latestSession: workoutSessions(order_by: { startedAt: desc }, limit: 1) {
        id
        startedAt
        workout { id name }
        workoutSessionExercises_aggregate { aggregate { count } }
        workoutSessionExercises(order_by: { position: asc }) {
          exercise { id name }
          workoutSessionStrengthSets_aggregate { aggregate { count sum { reps } } }
          workoutSessionCardioEntries_aggregate { aggregate { count } }
        }
      }
      recentSessions: workoutSessionsAggregate(where: { startedAt: { _gte: $weekStart } }) {
        aggregate { count }
      }
    }
    """
}

@MainActor
public final class TodayTrainingViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<TodayTrainingSummary> = .idle

    private let repository: any TodayTrainingProviding
    private let calendar: Calendar
    private let now: @Sendable () -> Date

    public init(
        repository: any TodayTrainingProviding,
        calendar: Calendar = .current,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.repository = repository
        self.calendar = calendar
        self.now = now
    }

    public var summary: TodayTrainingSummary? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        let window = TodayTrainingWindow(now: now(), calendar: calendar)
        do {
            for try await snapshot in repository.todayTrainingUpdates(window: window) {
                state = .loaded(TodayTrainingSummary(snapshot: snapshot))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}
