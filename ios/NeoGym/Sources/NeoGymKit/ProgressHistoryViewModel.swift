import Combine
import Foundation

/// Shared bounded SDK-cached history and foreground-day refresh behavior.
@MainActor
public class ProgressHistoryViewModel<Row: Sendable>: ObservableObject {
    @Published public private(set) var state: Loadable<[Row]> = .idle
    @Published public private(set) var cachedThrough: String?
    @Published public private(set) var isShowingPartialHistory = false
    private var displayedFromDay: String?
    private var displayedThroughDay: String?
    private var lastRequestedThroughDay: String?
    private var hasExtendedHistory = false
    private let cachedSnapshot: @Sendable (String, String, String) async throws -> [Row]?
    private let updates: @Sendable (String, String, String) -> AsyncThrowingStream<[Row], Error>
    let calendar: Calendar
    let clock: @Sendable () -> Date
    private var historyStart: Date
    private var loadVersion = 0

    public init(
        cachedSnapshot: @escaping @Sendable (String, String, String) async throws -> [Row]?,
        updates: @escaping @Sendable (String, String, String) -> AsyncThrowingStream<[Row], Error>,
        calendar: Calendar = .current,
        clock: @escaping @Sendable () -> Date = Date.init
    ) {
        self.cachedSnapshot = cachedSnapshot
        self.updates = updates
        self.calendar = calendar
        self.clock = clock
        let today = calendar.startOfDay(for: clock())
        historyStart = calendar.date(byAdding: .day, value: -179, to: today) ?? today
    }

    public var rows: [Row]? { state.value }

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
        let timeZone = calendar.timeZone.identifier
        guard version == loadVersion, !Task.isCancelled else { return }
        do {
            // Only a cold default window searches prior daily keys, without network.
            // Extended/custom windows remain exact-key streams, never shorter substitutes.
            if state.value == nil, !hasExtendedHistory {
                try await restoreCachedDefaultHistory(today: today, timeZone: timeZone, version: version)
            }
            guard version == loadVersion, !Task.isCancelled else { return }
            // Today's exact stream still revalidates, replacing any labeled fallback.
            for try await rows in updates(from, through, timeZone) {
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

    private func restoreCachedDefaultHistory(today: Date, timeZone: String, version: Int) async throws {
        for daysAgo in 0...7 {
            guard version == loadVersion, !Task.isCancelled else { return }
            guard let end = calendar.date(byAdding: .day, value: -daysAgo, to: today),
                  let start = calendar.date(byAdding: .day, value: -179, to: end),
                  case let .string(from) = GraphQLScalars.date(start, calendar: calendar),
                  case let .string(through) = GraphQLScalars.date(end, calendar: calendar) else { continue }
            let cached: [Row]?
            do {
                cached = try await cachedSnapshot(from, through, timeZone)
            } catch where GraphQLDomainError.isCancellation(error) {
                throw error
            } catch {
                // A corrupt/unavailable cache entry must not prevent normal revalidation.
                continue
            }
            guard version == loadVersion, !Task.isCancelled else { return }
            if let cached {
                displayedFromDay = from
                displayedThroughDay = through
                cachedThrough = daysAgo == 0 ? nil : through
                state = .loaded(cached)
                return
            }
        }
    }
}
