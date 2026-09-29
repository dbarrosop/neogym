import Combine
import Foundation

/// One day's server-calculated set credits for a muscle. The seven-day totals
/// are returned by Postgres, not derived from raw strength sets on the device.
public struct MuscleSetProgressRow: Decodable, Sendable, Equatable, Identifiable {
    public let day: String
    public let muscleGroup: String
    public let directSets: Int
    public let indirectSets: Int
    public let weightedSets: Double
    public let rollingDirectSets: Int
    public let rollingIndirectSets: Int
    public let rollingWeightedSets: Double

    public var id: String { "\(day)-\(muscleGroup)" }

    public var muscleName: String {
        if muscleGroup == "shoulders" { return "Shoulders (unspecified)" }
        return muscleGroup.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    public init(
        day: String, muscleGroup: String, directSets: Int, indirectSets: Int,
        weightedSets: Double, rollingDirectSets: Int, rollingIndirectSets: Int,
        rollingWeightedSets: Double
    ) {
        self.day = day
        self.muscleGroup = muscleGroup
        self.directSets = directSets
        self.indirectSets = indirectSets
        self.weightedSets = weightedSets
        self.rollingDirectSets = rollingDirectSets
        self.rollingIndirectSets = rollingIndirectSets
        self.rollingWeightedSets = rollingWeightedSets
    }

    private enum CodingKeys: String, CodingKey {
        case day, muscleGroup, directSets, indirectSets, weightedSets
        case rollingDirectSets, rollingIndirectSets, rollingWeightedSets
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        day = try container.decode(String.self, forKey: .day)
        muscleGroup = try container.decode(String.self, forKey: .muscleGroup)
        directSets = try container.decode(Int.self, forKey: .directSets)
        indirectSets = try container.decode(Int.self, forKey: .indirectSets)
        weightedSets = try container.decodeFlexibleDouble(forKey: .weightedSets)
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
        }
        let from = GraphQLScalars.date(historyStart, calendar: calendar)
        let through = GraphQLScalars.date(today, calendar: calendar)
        guard case let .string(from) = from, case let .string(through) = through else { return }
        state = .loading(previous: state.value)
        isShowingPartialHistory = displayedFromDay.map { $0 > from } ?? false
        // A keep-warm Progress model may still display yesterday's live value.
        // Label it before refreshing today's key, even without a cache-only read.
        if let displayedThroughDay, displayedThroughDay < through, state.value != nil {
            cachedThrough = displayedThroughDay
        }
        let timeZone = calendar.timeZone.identifier
        if state.value == nil || displayedThroughDay != through {
            // Custom/extended windows only probe their exact key. A default 180-day
            // snapshot cannot stand in for the requested wider history.
            let candidates = hasExtendedHistory || state.value != nil ? [today] : (0...7).compactMap {
                calendar.date(byAdding: .day, value: -$0, to: today)
            }
            for day in candidates {
                guard version == loadVersion, !Task.isCancelled else { return }
                let candidateFromDate = hasExtendedHistory ? historyStart :
                    (calendar.date(byAdding: .day, value: -179, to: day) ?? day)
                guard case let .string(candidateFrom) = GraphQLScalars.date(candidateFromDate, calendar: calendar),
                      case let .string(candidateThrough) = GraphQLScalars.date(day, calendar: calendar) else { continue }
                let cached = try? await repository.cachedMuscleSetProgress(
                    fromDay: candidateFrom, throughDay: candidateThrough, timeZone: timeZone
                )
                guard version == loadVersion, !Task.isCancelled else { return }
                if let cached {
                    cachedThrough = candidateThrough == through ? nil : candidateThrough
                    displayedFromDay = candidateFrom
                    displayedThroughDay = candidateThrough
                    isShowingPartialHistory = candidateFrom > from
                    state = .loaded(cached)
                    break
                }
            }
        }
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
