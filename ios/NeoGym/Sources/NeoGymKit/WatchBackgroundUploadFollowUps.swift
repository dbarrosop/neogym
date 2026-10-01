import Foundation

/// Keeps URLSession result work alive until all delivered events have been
/// processed. The system wake is released by the caller only after this wait,
/// or immediately on expiration via the same completion gate.
@MainActor
public final class WatchBackgroundUploadFollowUps {
    private var tasks: [UUID: Task<Void, Never>] = [:]

    public init() {}

    public func submit(_ work: @escaping @MainActor () async -> Void) {
        let id = UUID()
        tasks[id] = Task {
            await work()
            tasks.removeValue(forKey: id)
        }
    }

    public func finishEvents(completion: WatchCompletionGate) async {
        // URLSession calls didFinishEvents after delivering this batch's task
        // callbacks. Capture the outstanding follow-ups before awaiting them.
        let delivered = Array(tasks.values)
        for task in delivered { await task.value }
        completion.complete()
    }

    public func cancelPending() {
        for task in tasks.values { task.cancel() }
        // An expired wake must not make the next batch wait on stale work
        // that ignores cancellation until watchOS suspends it.
        tasks.removeAll()
    }
}
