import Combine
import Foundation

public struct WorkoutWeeklyVolume: Identifiable, Sendable, Equatable {
    public let weekStart: Date
    public let volume: Double
    public var id: Date { weekStart }
}

public struct WorkoutExerciseTrend: Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let points: [StrengthProgressPoint]
}

public struct WorkoutProgress: Sendable, Equatable {
    public let weeklyVolume: [WorkoutWeeklyVolume]
    public let recentExercises: [WorkoutExerciseTrend]
}

public enum WorkoutProgressBuilder {
    public static func build(
        entries: [WorkoutProgressEntry],
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> WorkoutProgress {
        let today = calendar.startOfDay(for: now)
        let recentStart = calendar.date(byAdding: .day, value: -9, to: today) ?? today
        let recentEnd = calendar.date(byAdding: .day, value: 1, to: today) ?? now
        var weeks: [Date: Double] = [:]
        var recentIds = Set<String>()
        var trends: [String: [StrengthProgressPoint]] = [:]
        var names: [String: String] = [:]

        for entry in entries {
            guard let date = entry.workoutSession.startedAtDate,
                  !entry.workoutSessionStrengthSets.isEmpty,
                  date < recentEnd,
                  let weekStart = calendar.dateInterval(of: .weekOfYear, for: date)?.start
            else { continue }
            let doubleWeight = entry.exercise.strength?.doubleWeight ?? false
            let sets = entry.workoutSessionStrengthSets
            let volume = sets.reduce(0.0) { total, set in
                total + set.weight * Double(set.reps) * (doubleWeight ? 2 : 1)
            }
            weeks[weekStart, default: 0] += volume
            if date >= recentStart { recentIds.insert(entry.exercise.id) }
            let oneRepMax = sets.filter { $0.reps > 0 }.map { set in
                set.weight * (1 + Double(set.reps) / 30)
            }.max() ?? 0
            trends[entry.exercise.id, default: []].append(
                StrengthProgressPoint(date: date, volume: volume, oneRepMax: oneRepMax)
            )
            names[entry.exercise.id] = entry.exercise.name
        }

        return WorkoutProgress(
            weeklyVolume: weeks.map { WorkoutWeeklyVolume(weekStart: $0.key, volume: $0.value) }
                .sorted { $0.weekStart < $1.weekStart },
            recentExercises: recentIds.map { id in
                WorkoutExerciseTrend(
                    id: id,
                    name: names[id] ?? "Exercise",
                    points: (trends[id] ?? []).sorted { $0.date < $1.date }
                )
            }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        )
    }
}

@MainActor
public final class WorkoutProgressViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<WorkoutProgress> = .idle
    private let repository: any SessionsRepositoryProtocol

    public init(repository: any SessionsRepositoryProtocol) {
        self.repository = repository
    }

    public var progress: WorkoutProgress? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            let entries = try await repository.strengthProgressEntries()
            state = .loaded(WorkoutProgressBuilder.build(entries: entries))
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}
