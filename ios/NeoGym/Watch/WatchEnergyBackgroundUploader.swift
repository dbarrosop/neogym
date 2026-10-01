import Foundation
import NeoGymKit
import Nhost
import WatchKit

/// watchOS transfers file uploads in a system process, so the GraphQL write
/// can finish after this app is suspended. Only one owner-scoped upload is
/// outstanding; the pending Health marker survives a failed/expired token.
@MainActor
final class WatchEnergyBackgroundUploader: NSObject, URLSessionDataDelegate {
    static let identifier = "io.nhost.dbarroso.neogym.watch-energy-upload.v1"
    var onResult: ((String?, Bool, Int?) async -> Void)?
    private var responses: [Int: Data] = [:]
    private var enqueuingOwners = Set<String>()
    private let followUps = WatchBackgroundUploadFollowUps()
    private var wakeTask: WKURLSessionRefreshBackgroundTask?
    private var wakeGate: WatchCompletionGate?
    private var finishTask: Task<Void, Never>?
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: Self.identifier)
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.waitsForConnectivity = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: .main)
    }()

    func enqueue(entries: [HealthDailyEnergy], ownerID: String, client: NhostClient,
                 isCurrentOwner: () -> Bool) async throws -> Bool {
        guard let body = try WatchEnergyBackgroundUpload.body(entries: entries, now: Date(), calendar: .current)
        else { return false }
        guard !enqueuingOwners.contains(ownerID) else { return true }
        enqueuingOwners.insert(ownerID)
        defer { enqueuingOwners.remove(ownerID) }
        let existing = await session.allTasks
        guard !existing.contains(where: { $0.taskDescription == ownerID }) else { return true }
        guard let auth = try await client.refreshSession(marginSeconds: 120), auth.user?.id == ownerID else {
            throw CancellationError()
        }
        // A session replacement while refreshing must never enqueue another
        // user's Health data. Caller rechecks its current account after await.
        try Task.checkCancellation()
        guard isCurrentOwner() else { throw CancellationError() }
        var request = URLRequest(url: client.serviceURLs.graphql)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try body.write(to: file, options: .atomic)
        defer { try? FileManager.default.removeItem(at: file) }
        let task = session.uploadTask(with: request, fromFile: file)
        task.taskDescription = ownerID
        guard isCurrentOwner() else { task.cancel(); throw CancellationError() }
        task.resume()
        return true
    }

    func handle(_ task: WKURLSessionRefreshBackgroundTask) {
        guard task.sessionIdentifier == Self.identifier else {
            task.setTaskCompletedWithSnapshot(false)
            return
        }
        // Reattach the same identifier after a watchOS background launch.
        _ = session
        // A replacement wake must not strand the previous system task.
        wakeTask?.expirationHandler = nil
        wakeGate?.complete()
        finishTask?.cancel()
        let gate = WatchCompletionGate { task.setTaskCompletedWithSnapshot(false) }
        wakeTask = task
        wakeGate = gate
        task.expirationHandler = { [weak self] in
            // watchOS can invoke this outside the main actor; release the wake
            // promptly, then cancel the work on its owning actor.
            gate.complete()
            Task { @MainActor [weak self] in
                guard let self, self.wakeGate === gate else { return }
                self.finishTask?.cancel()
                self.followUps.cancelPending()
                self.wakeTask?.expirationHandler = nil
                self.wakeTask = nil
                self.wakeGate = nil
                self.finishTask = nil
            }
        }
    }

    func cancel(ownerID: String?) {
        session.getAllTasks { tasks in
            for task in tasks where ownerID == nil || task.taskDescription == ownerID {
                task.cancel()
            }
        }
    }

    nonisolated func urlSession(_ session: URLSession, dataTask: URLSessionDataTask,
                                didReceive data: Data) {
        MainActor.assumeIsolated {
            responses[dataTask.taskIdentifier, default: Data()].append(data)
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask,
                                didCompleteWithError error: (any Error)?) {
        MainActor.assumeIsolated {
            let status = (task.response as? HTTPURLResponse)?.statusCode
            let response = responses.removeValue(forKey: task.taskIdentifier)
            let success = error == nil && WatchEnergyBackgroundUpload.succeeded(
                status: status, data: response
            )
            let ownerID = task.taskDescription
            followUps.submit { [weak self] in
                await self?.onResult?(ownerID, success, status)
            }
        }
    }

    nonisolated func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        MainActor.assumeIsolated {
            guard let gate = wakeGate else { return }
            finishTask = Task { [weak self] in
                guard let self else { gate.complete(); return }
                await self.followUps.finishEvents(completion: gate)
                guard self.wakeGate === gate else { return }
                self.wakeTask?.expirationHandler = nil
                self.wakeTask = nil
                self.wakeGate = nil
                self.finishTask = nil
            }
        }
    }
}
