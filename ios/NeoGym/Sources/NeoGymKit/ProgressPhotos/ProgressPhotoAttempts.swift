import Foundation

public enum ProgressPhotoUploadResult: Equatable, Sendable {
    case ready(String), checkAgain, processing, unconfirmedReservation, unavailableReservation
}

/// One explicit submission. Never reserve again, even when the first response is lost.
public actor ProgressPhotoUploadAttempt {
    private let repository: any ProgressPhotoRepositoryProtocol
    private let fields: ProgressPhotoFields
    private let jpeg: Data
    private let delays: [UInt64]
    private let now: @Sendable () -> Date
    private let startedAt: Date
    private var started = false
    private var busy = false
    private var id: String?
    private var sawFile = false
    private var terminal: ProgressPhotoUploadResult?

    public init(repository: any ProgressPhotoRepositoryProtocol, fields: ProgressPhotoFields, jpeg: Data) {
        self.init(repository: repository, fields: fields, jpeg: jpeg,
                  delays: [300_000_000, 750_000_000, 1_500_000_000], now: { Date() })
    }

    init(repository: any ProgressPhotoRepositoryProtocol, fields: ProgressPhotoFields, jpeg: Data,
         delays: [UInt64], now: @escaping @Sendable () -> Date) {
        self.repository = repository
        self.fields = fields
        self.jpeg = jpeg
        self.delays = delays
        self.now = now
        startedAt = now()
    }

    public func run() async throws -> ProgressPhotoUploadResult {
        try Task.checkCancellation()
        if let terminal { return terminal }
        guard !busy else { return .checkAgain }
        busy = true
        defer { busy = false }
        if started { return try await reconcile(allowUpload: true) }
        started = true
        do {
            id = try await repository.reserve(fields)
            try Task.checkCancellation()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            try Task.checkCancellation()
            return finish(.unconfirmedReservation)
        }
        guard let id, ProgressPhoto.canonical(id) else { return finish(.unconfirmedReservation) }
        return try await upload(id)
    }

    private func upload(_ id: String) async throws -> ProgressPhotoUploadResult {
        do {
            let confirmed = try await repository.upload(jpeg, to: id)
            try Task.checkCancellation()
            if confirmed { return finish(.ready(id)) }
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            try Task.checkCancellation()
        }
        return try await reconcile(allowUpload: false)
    }

    private func reconcile(allowUpload: Bool) async throws -> ProgressPhotoUploadResult {
        guard let id else { return finish(.unconfirmedReservation) }
        for delay in [0] + delays {
            if delay > 0 { try await Task.sleep(nanoseconds: delay) }
            let row: ProgressPhoto?
            do {
                row = try await repository.reservation(id)
                try Task.checkCancellation()
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                try Task.checkCancellation()
                return .checkAgain
            }
            guard let row, row.id == id else { return finish(.unavailableReservation) }
            if row.isReady { return finish(.ready(id)) }
            if let file = row.file {
                guard file.id == id else { return finish(.unavailableReservation) }
                sawFile = true
            } else {
                guard !sawFile, now().timeIntervalSince(startedAt) < 3_600 else {
                    return finish(.unavailableReservation)
                }
                return allowUpload ? try await upload(id) : .checkAgain
            }
        }
        return .processing
    }

    private func finish(_ result: ProgressPhotoUploadResult) -> ProgressPhotoUploadResult {
        terminal = result
        return result
    }
}

/// `true` means no longer available, not that the physical bytes were purged.
public actor ProgressPhotoDeleteAttempt {
    private let repository: any ProgressPhotoRepositoryProtocol
    private let id: String
    private var attempted = false
    private var busy = false
    private var confirmed = false

    public init(repository: any ProgressPhotoRepositoryProtocol, id: String) {
        self.repository = repository
        self.id = id
    }

    public func run() async throws -> Bool {
        try Task.checkCancellation()
        if confirmed { return true }
        guard !busy else { return false }
        busy = true
        defer { busy = false }
        if attempted {
            // A user-confirmed retry starts with a read, never another DELETE on a vanished file.
            let row = try await repository.reservation(id)
            try Task.checkCancellation()
            guard let row else { confirmed = true; return true }
            guard row.id == id, row.isReady else { return false }
        }
        attempted = true
        do {
            let deleted = try await repository.delete(id)
            try Task.checkCancellation()
            if deleted { confirmed = true; return true }
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            try Task.checkCancellation()
        }
        let row = try await repository.reservation(id)
        try Task.checkCancellation()
        confirmed = row == nil
        return confirmed
    }
}
