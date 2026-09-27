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

        var weeklyVolume: [WorkoutWeeklyVolume] = []
        if let firstWeek = weeks.keys.min(),
           let currentWeek = calendar.dateInterval(of: .weekOfYear, for: now)?.start {
            var weekStart = firstWeek
            while weekStart <= currentWeek {
                weeklyVolume.append(WorkoutWeeklyVolume(weekStart: weekStart, volume: weeks[weekStart] ?? 0))
                guard let nextWeek = calendar.dateInterval(of: .weekOfYear, for: weekStart)?.end,
                      nextWeek > weekStart else { break }
                weekStart = nextWeek
            }
        }

        return WorkoutProgress(
            weeklyVolume: weeklyVolume,
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
    @Published public private(set) var isShowingPriorWeekCache = false
    private let repository: any SessionsRepositoryProtocol
    private let calendar: Calendar
    private let clock: @Sendable () -> Date
    private var since: Date
    private var loadVersion = 0

    public init(
        repository: any SessionsRepositoryProtocol,
        calendar: Calendar = .current,
        clock: @escaping @Sendable () -> Date = Date.init
    ) {
        self.repository = repository
        self.calendar = calendar
        self.clock = clock
        let now = clock()
        let firstDay = calendar.date(byAdding: .day, value: -179, to: calendar.startOfDay(for: now)) ?? now
        self.since = Self.weekStart(containing: firstDay, calendar: calendar)
    }

    public var progress: WorkoutProgress? { state.value }

    // Round requested bounds to local weeks so variable-keyed cache entries are reusable.
    private static func weekStart(containing date: Date, calendar: Calendar) -> Date {
        calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
    }

    public func extendHistory(to visibleStart: Date) async {
        let requested = Self.weekStart(containing: visibleStart, calendar: calendar)
        guard requested < since else { return }
        since = requested
        await load()
    }

    public func load() async {
        loadVersion += 1
        let version = loadVersion
        let requestedSince = since
        state = .loading(previous: state.value)
        // The default `since` moves when its 180-day start crosses a local week. Prefer the
        // exact key; only a cold current key needs the preceding week's SDK-scoped fallback.
        if state.value == nil {
            let current = try? await repository.cachedStrengthProgressEntries(since: requestedSince)
            guard version == loadVersion, !Task.isCancelled else { return }
            if let current {
                isShowingPriorWeekCache = false
                state = .loaded(WorkoutProgressBuilder.build(entries: current, now: clock(), calendar: calendar))
            } else if let precedingWeek = calendar.date(byAdding: .weekOfYear, value: -1, to: requestedSince) {
                let candidate = Self.weekStart(containing: precedingWeek, calendar: calendar)
                if let cached = try? await repository.cachedStrengthProgressEntries(since: candidate) {
                    guard version == loadVersion, !Task.isCancelled else { return }
                    isShowingPriorWeekCache = true
                    state = .loaded(WorkoutProgressBuilder.build(entries: cached, now: clock(), calendar: calendar))
                }
            }
        }
        guard version == loadVersion, !Task.isCancelled else { return }
        do {
            for try await entries in repository.strengthProgressUpdates(since: requestedSince) {
                guard version == loadVersion, !Task.isCancelled else { return }
                isShowingPriorWeekCache = false
                state = .loaded(WorkoutProgressBuilder.build(entries: entries, now: clock(), calendar: calendar))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            guard version == loadVersion else { return }
            state = state.cancellationFallback
        } catch {
            guard version == loadVersion else { return }
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}
