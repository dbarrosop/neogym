import Foundation
import NeoGymKit
import Nhost
import WatchKit

/// watchOS transfers file uploads in a system process, so the GraphQL write
/// can finish after this app is suspended. Viable same-owner uploads are
/// deduplicated, and stale ones are cancelled when a replacement is ready.
/// A deferred transfer never prevents a later in-process reconciliation.
@MainActor
final class WatchEnergyBackgroundUploader: NSObject, URLSessionDataDelegate {
    static let identifier = "io.nhost.dbarroso.neogym.watch-energy-upload.v1"
    var onResult: ((String?, Bool, Int?) async -> Void)?
    enum EnqueueResult {
        case queued
        case deduplicated
        case unavailable
    }

    private var responses: [Int: Data] = [:]
    private var replacedTaskIDs = Set<Int>()
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
                 isCurrentOwner: () -> Bool) async throws -> EnqueueResult {
        guard let body = try WatchEnergyBackgroundUpload.body(entries: entries, now: Date(), calendar: .current)
        else { return .unavailable }
        guard !enqueuingOwners.contains(ownerID) else { return .deduplicated }
        enqueuingOwners.insert(ownerID)
        defer { enqueuingOwners.remove(ownerID) }
        let existing = await session.allTasks.filter {
            WatchEnergyUploadTaskPolicy.ownerID(in: $0.taskDescription) == ownerID
        }
        try Task.checkCancellation()
        guard isCurrentOwner() else { throw CancellationError() }
        let now = Date()
        let fresh = existing.filter {
            WatchEnergyUploadTaskPolicy.canDedupe($0.taskDescription, ownerID: ownerID, now: now)
        }
        if !fresh.isEmpty {
            replace(existing.filter { old in !fresh.contains { $0.taskIdentifier == old.taskIdentifier } })
            return .deduplicated
        }
        // Force a new bearer for a discretionary transfer. The SDK may still
        // return an old unexpired token after transient Auth failures; do not
        // pin one with too little lifetime for a deferred upload.
        guard let auth = try await client.refreshSession(marginSeconds: 0), auth.user?.id == ownerID else {
            throw CancellationError()
        }
        try Task.checkCancellation()
        guard isCurrentOwner() else { throw CancellationError() }
        let expiry = auth.decodedToken.exp
        guard WatchEnergyUploadTaskPolicy.canPinBearer(expiresAt: expiry, now: Date()),
              let expiry else { return .unavailable }
        var request = URLRequest(url: client.serviceURLs.graphql)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try body.write(to: file, options: .atomic)
        defer { try? FileManager.default.removeItem(at: file) }
        let task = session.uploadTask(with: request, fromFile: file)
        task.taskDescription = WatchEnergyUploadTaskPolicy.description(ownerID: ownerID, expiresAt: expiry)
        guard isCurrentOwner(), !Task.isCancelled else { task.cancel(); throw CancellationError() }
        // A stale task can later overwrite newer imported totals. Replace it
        // only once a valid new upload exists, and suppress its expected cancel.
        replace(existing)
        task.resume()
        return .queued
    }

    private func replace(_ tasks: [URLSessionTask]) {
        for task in tasks {
            replacedTaskIDs.insert(task.taskIdentifier)
            task.cancel()
        }
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
            for task in tasks where ownerID == nil ||
                WatchEnergyUploadTaskPolicy.ownerID(in: task.taskDescription) == ownerID {
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
            let replaced = replacedTaskIDs.remove(task.taskIdentifier) != nil
            if replaced, let error = error as NSError?, error.domain == NSURLErrorDomain,
               error.code == NSURLErrorCancelled { return }
            let success = error == nil && WatchEnergyBackgroundUpload.succeeded(
                status: status, data: response
            )
            let ownerID = WatchEnergyUploadTaskPolicy.ownerID(in: task.taskDescription)
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
