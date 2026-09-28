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
        await load()
    }

    public func load() async {
        loadVersion += 1
        let version = loadVersion
        state = .loading(previous: state.value)
        let fromDay = GraphQLScalars.date(historyStart, calendar: calendar)
        let throughDay = GraphQLScalars.date(clock(), calendar: calendar)
        guard case let .string(from) = fromDay, case let .string(through) = throughDay else { return }
        do {
            for try await rows in repository.muscleSetProgressUpdates(
                fromDay: from, throughDay: through, timeZone: calendar.timeZone.identifier
            ) {
                guard version == loadVersion, !Task.isCancelled else { return }
                state = .loaded(rows)
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
