import Combine
import Foundation

/// One day's server-calculated trailing seven-day totals for a muscle, returned
/// by Postgres rather than derived from raw strength sets on the device.
public struct MuscleSetProgressRow: Decodable, Sendable, Equatable, Identifiable {
    public let day: String
    public let muscleGroup: String
    public let rollingDirectSets: Int
    public let rollingIndirectSets: Int
    public let rollingWeightedSets: Double

    public var id: String { "\(day)-\(muscleGroup)" }

    public var muscleName: String {
        if muscleGroup == "shoulders" { return "Shoulders (unspecified)" }
        return muscleGroup.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    public init(
        day: String, muscleGroup: String, rollingDirectSets: Int, rollingIndirectSets: Int,
        rollingWeightedSets: Double
    ) {
        self.day = day
        self.muscleGroup = muscleGroup
        self.rollingDirectSets = rollingDirectSets
        self.rollingIndirectSets = rollingIndirectSets
        self.rollingWeightedSets = rollingWeightedSets
    }

    private enum CodingKeys: String, CodingKey {
        case day, muscleGroup
        case rollingDirectSets, rollingIndirectSets, rollingWeightedSets
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        day = try container.decode(String.self, forKey: .day)
        muscleGroup = try container.decode(String.self, forKey: .muscleGroup)
        rollingDirectSets = try container.decode(Int.self, forKey: .rollingDirectSets)
        rollingIndirectSets = try container.decode(Int.self, forKey: .rollingIndirectSets)
        rollingWeightedSets = try container.decodeFlexibleDouble(forKey: .rollingWeightedSets)
    }

    public func date(in calendar: Calendar) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }
}

@MainActor
public final class MuscleSetProgressViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[MuscleSetProgressRow]> = .idle
    @Published public private(set) var cachedThrough: String?
    @Published public private(set) var isShowingPartialHistory = false
    private var displayedFromDay: String?
    private var displayedThroughDay: String?
    private var lastRequestedThroughDay: String?
    private var hasExtendedHistory = false
    private let repository: any SessionsRepositoryProtocol
    private let calendar: Calendar
    private let clock: @Sendable () -> Date
    private var historyStart: Date
    private var loadVersion = 0

    public init(
        repository: any SessionsRepositoryProtocol,
        calendar: Calendar = .current,
        clock: @escaping @Sendable () -> Date = Date.init
    ) {
        self.repository = repository
        self.calendar = calendar
        self.clock = clock
        let today = calendar.startOfDay(for: clock())
        historyStart = calendar.date(byAdding: .day, value: -179, to: today) ?? today
    }

    public var rows: [MuscleSetProgressRow]? { state.value }

    /// A keep-warm Progress screen does not rerun its initial task on foreground return.
    public func refreshIfNewLocalDay() async {
        guard rows != nil,
              case let .string(today) = GraphQLScalars.date(calendar.startOfDay(for: clock()), calendar: calendar),
              lastRequestedThroughDay != today else { return }
        await load()
    }

    public func extendHistory(to visibleStart: Date) async {
        let today = calendar.startOfDay(for: clock())
        let earliest = calendar.date(byAdding: .day, value: -365, to: today) ?? today
        let requested = max(earliest, calendar.startOfDay(for: visibleStart))
        guard requested < historyStart else { return }
        historyStart = requested
        hasExtendedHistory = true
        await load()
    }

    public func load() async {
        loadVersion += 1
        let version = loadVersion
        let today = calendar.startOfDay(for: clock())
        // The default window must advance on a new local day even if this model stays mounted.
        if !hasExtendedHistory {
            historyStart = calendar.date(byAdding: .day, value: -179, to: today) ?? today
        } else {
            // A kept-alive custom window must stay within the server's 365-day span after midnight.
            let earliest = calendar.date(byAdding: .day, value: -365, to: today) ?? today
            historyStart = max(historyStart, earliest)
        }
        let from = GraphQLScalars.date(historyStart, calendar: calendar)
        let through = GraphQLScalars.date(today, calendar: calendar)
        guard case let .string(from) = from, case let .string(through) = through else { return }
        // A failed refresh still counts as today's foreground attempt; pull-to-refresh can retry.
        lastRequestedThroughDay = through
        state = .loading(previous: state.value)
        isShowingPartialHistory = displayedFromDay.map { $0 > from } ?? false
        // A keep-warm Progress model may still display yesterday's live value.
        // Label it before refreshing today's key, even without a cache-only read.
        if let displayedThroughDay, displayedThroughDay < through, state.value != nil {
            cachedThrough = displayedThroughDay
        }
        // The SDK stream emits only this query's exact cached key, then revalidates.
        // There is no older-day fallback for a cold key after local midnight.
        let timeZone = calendar.timeZone.identifier
        guard version == loadVersion, !Task.isCancelled else { return }
        do {
            for try await rows in repository.muscleSetProgressUpdates(
                fromDay: from, throughDay: through, timeZone: timeZone
            ) {
                guard version == loadVersion, !Task.isCancelled else { return }
                cachedThrough = nil
                displayedFromDay = from
                displayedThroughDay = through
                isShowingPartialHistory = false
                state = .loaded(rows)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            guard version == loadVersion else { return }
            state = state.cancellationFallback
        } catch {
            guard version == loadVersion, !Task.isCancelled else { return }
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}
