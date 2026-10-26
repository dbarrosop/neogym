import Combine
import Foundation

/// Shared bounded, exact-key cached history and foreground-day refresh behavior.
@MainActor
public class ProgressHistoryViewModel<Row: Sendable>: ObservableObject {
    @Published public private(set) var state: Loadable<[Row]> = .idle
    @Published public private(set) var cachedThrough: String?
    @Published public private(set) var isShowingPartialHistory = false
    private var displayedFromDay: String?
    private var displayedThroughDay: String?
    private var lastRequestedThroughDay: String?
    private var hasExtendedHistory = false
    private let updates: @Sendable (String, String, String) -> AsyncThrowingStream<[Row], Error>
    let calendar: Calendar
    let clock: @Sendable () -> Date
    private var historyStart: Date
    private var loadVersion = 0

    public init(
        updates: @escaping @Sendable (String, String, String) -> AsyncThrowingStream<[Row], Error>,
        calendar: Calendar = .current,
        clock: @escaping @Sendable () -> Date = Date.init
    ) {
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
        // The SDK stream emits only this query's exact cached key, then revalidates.
        // There is no older-day fallback for a cold key after local midnight.
        let timeZone = calendar.timeZone.identifier
        guard version == loadVersion, !Task.isCancelled else { return }
        do {
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
}
