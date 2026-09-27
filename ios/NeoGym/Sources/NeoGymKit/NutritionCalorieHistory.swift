import Combine
import Foundation

/// Inclusive local calendar dates to fetch, including six preceding days for 7-day chart averages.
public struct ChartHistoryRange: Equatable, Sendable {
    public let from: String
    public let through: String

    public init(from: String, through: String) {
        self.from = from
        self.through = through
    }

    public init(visibleStart: Date, endExclusive: Date, calendar: Calendar = .current) {
        let start = calendar.date(byAdding: .day, value: -6, to: visibleStart) ?? visibleStart
        from = DateOnly.formatLocalISO(start, calendar: calendar)
        through = DateOnly.formatLocalISO(endExclusive.addingTimeInterval(-1), calendar: calendar)
    }

    public static func recentDays(_ count: Int, now: Date = Date(), calendar: Calendar = .current) -> Self {
        let today = calendar.startOfDay(for: now)
        let start = calendar.date(byAdding: .day, value: -max(count - 1, 0), to: today) ?? today
        let end = calendar.dateInterval(of: .day, for: now)?.end ?? today
        return Self(visibleStart: start, endExclusive: end, calendar: calendar)
    }

    /// Exact cache keys for today's default chart and the preceding seven local days.
    /// Each read is SDK-scoped and capped by its configured stale-if-error age.
    public static func recentCacheCandidates(
        _ count: Int, now: Date = Date(), calendar: Calendar = .current
    ) -> [Self] {
        (0...7).compactMap { offset in
            calendar.date(byAdding: .day, value: -offset, to: now).map {
                recentDays(count, now: $0, calendar: calendar)
            }
        }
    }
}

@MainActor
public final class NutritionCalorieHistoryViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<NutritionCalorieHistory> = .idle
    @Published public private(set) var cachedThrough: String?
    private let repository: any NutritionFoodMealRepositoryProtocol
    private var requestGeneration = 0

    public init(repository: any NutritionFoodMealRepositoryProtocol) {
        self.repository = repository
    }

    public var history: NutritionCalorieHistory? { state.value }

    public func load(range: ChartHistoryRange, cacheCandidates: [ChartHistoryRange] = []) async {
        // Keep the chart mounted, including its selected period, while a wider range loads.
        requestGeneration += 1
        let generation = requestGeneration
        state = .loading(previous: state.value)
        if state.value == nil {
            for candidate in cacheCandidates {
                guard generation == requestGeneration, !Task.isCancelled else { return }
                if let cached = try? await repository.cachedNutritionCalorieHistory(range: candidate) {
                    guard generation == requestGeneration, !Task.isCancelled else { return }
                    cachedThrough = candidate == range ? nil : candidate.through
                    state = .loaded(cached)
                    break
                }
            }
        }
        do {
            for try await history in repository.nutritionCalorieHistoryUpdates(range: range) {
                guard generation == requestGeneration, !Task.isCancelled else { return }
                cachedThrough = nil
                state = .loaded(history)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            guard generation == requestGeneration else { return }
            state = state.cancellationFallback
        } catch {
            guard generation == requestGeneration, !Task.isCancelled else { return }
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}
