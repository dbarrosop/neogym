import Foundation

/// Only fixed stage names, operation kinds, timestamps and elapsed time cross
/// this boundary. Never pass Health values, GraphQL variables or raw errors.
public struct WatchEnergyStageEvent: Sendable {
    public let stage: WatchEventStage
    public let backendOperation: WatchEventBackendOperation?
    public let outcome: WatchEventOutcome
    public let occurredAt: Date
    public let wallSeconds: Int?

    public init(stage: WatchEventStage, backendOperation: WatchEventBackendOperation? = nil,
                outcome: WatchEventOutcome, occurredAt: Date, wallSeconds: Int? = nil) {
        self.stage = stage
        self.backendOperation = backendOperation
        self.outcome = outcome
        self.occurredAt = occurredAt
        self.wallSeconds = wallSeconds
    }
}

public typealias WatchEnergyStageReporter = @Sendable (WatchEnergyStageEvent) -> Void

/// Emits the start before awaiting and a terminal event at the point where
/// the operation actually returns. Absence of a terminal event alone is not
/// proof of a hang: watchOS may suspend or terminate the process.
public struct WatchEnergyStageTrace: Sendable {
    private let reporter: WatchEnergyStageReporter?

    public init(_ reporter: WatchEnergyStageReporter?) { self.reporter = reporter }

    public func run<T>(
        _ stage: WatchEventStage, operation: WatchEventBackendOperation? = nil,
        body: () async throws -> T
    ) async rethrows -> T {
        let startedAt = Date()
        reporter?(WatchEnergyStageEvent(stage: stage, backendOperation: operation,
                                        outcome: .started, occurredAt: startedAt))
        do {
            let result = try await body()
            reportEnd(stage, operation: operation, outcome: .succeeded, since: startedAt)
            return result
        } catch {
            reportEnd(stage, operation: operation,
                      outcome: error is CancellationError || Task.isCancelled ? .skipped : .failed,
                      since: startedAt)
            throw error
        }
    }

    private func reportEnd(_ stage: WatchEventStage, operation: WatchEventBackendOperation?,
                           outcome: WatchEventOutcome, since start: Date) {
        let endedAt = Date()
        reporter?(WatchEnergyStageEvent(
            stage: stage, backendOperation: operation, outcome: outcome, occurredAt: endedAt,
            wallSeconds: max(0, Int(endedAt.timeIntervalSince(start).rounded(.up)))
        ))
    }
}

/// Implemented only by the watch's HealthKit importer. Host fakes and the
/// iPhone importer continue using DailyEnergyHealthImporting unchanged.
public protocol WatchEnergyHealthStageReporting: DailyEnergyHealthImporting {
    func dailyEnergyEntries(report: WatchEnergyStageReporter?) async throws -> [HealthDailyEnergy]
}
