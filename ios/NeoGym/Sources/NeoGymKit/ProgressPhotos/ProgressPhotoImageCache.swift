import CoreGraphics
import Foundation

/// Decoded images only. The iPhone creates one cache per account shell and
/// clears it on background, memory pressure and sign-out. Nothing hits disk.
@MainActor
public final class ProgressPhotoImageCache {
    public struct Key: Hashable, Sendable {
        public let id: String
        public let thumbnail: Bool

        public init(id: String, thumbnail: Bool) {
            self.id = id
            self.thumbnail = thumbnail
        }
    }

    private struct Entry {
        let image: CGImage
        let etag: String?
        let validated: TimeInterval
        var access: UInt64
        var cost: Int { image.bytesPerRow * image.height }
    }

    private let byteLimit: Int
    private let freshness: TimeInterval
    private var uptime: TimeInterval { ProcessInfo.processInfo.systemUptime }
    private var entries: [Key: Entry] = [:]
    private var access: UInt64 = 0
    private var generation: UInt64 = 0
    private var inFlight: [UUID: String] = [:]

    public init(byteLimit: Int = 48 * 1024 * 1024, freshness: TimeInterval = 30) {
        self.byteLimit = byteLimit
        self.freshness = freshness
    }

    public func image(for key: Key) -> CGImage? { entries[key]?.image }

    public func remove(id: String) {
        inFlight = inFlight.filter { $0.value != id }
        evict(id: id)
    }

    private func evict(id: String) {
        entries.removeValue(forKey: Key(id: id, thumbnail: true))
        entries.removeValue(forKey: Key(id: id, thumbnail: false))
    }

    public func clear() {
        generation &+= 1
        entries.removeAll()
    }

    /// The caller can render `image(for:)` while this performs an authorized
    /// revalidation. A fresh hit avoids an immediate repeat request (e.g. open
    /// full screen after viewing detail); an older hit can receive a bodyless 304.
    public func load(_ key: Key, repository: any ProgressPhotoRepositoryProtocol,
                     scope: ProgressPhotoRouteScope) async throws -> CGImage {
        try scope.check()
        let old = entries[key]
        if let old, repository.isDemo || uptime - old.validated < freshness {
            touch(key)
            return old.image
        }
        let revision = generation
        let loadID = UUID()
        inFlight[loadID] = key.id
        defer { inFlight[loadID] = nil }
        do {
            let response = try await repository.fetchImage(key.id, thumbnail: key.thumbnail, ifNoneMatch: old?.etag)
            let image: CGImage
            let etag: String?
            switch response {
            case let .image(bytes, tag):
                image = try await Self.decode(bytes, thumbnail: key.thumbnail)
                etag = tag
            case .notModified:
                guard let old, old.etag != nil else { throw ProgressPhotoError.unavailable }
                image = old.image
                etag = old.etag
            }
            try scope.check()
            guard inFlight[loadID] != nil else { throw ProgressPhotoError.unavailable }
            // A memory purge must not refill the cache, but the still-active view can finish loading.
            if revision == generation {
                access &+= 1
                insert(.init(image: image, etag: etag, validated: uptime, access: access), for: key)
            }
            return image
        } catch {
            try scope.check()
            // Do not let invalidated work evict entries from newer loads.
            if revision == generation, inFlight[loadID] != nil { evict(id: key.id) }
            throw error
        }
    }

    private func touch(_ key: Key) {
        access &+= 1
        entries[key]?.access = access
    }

    private func insert(_ entry: Entry, for key: Key) {
        guard entry.cost <= byteLimit else { return }
        entries[key] = entry
        var bytes = entries.values.reduce(0) { $0 + $1.cost }
        while entries.count > 48 || bytes > byteLimit, let oldest = entries.min(by: { $0.value.access < $1.value.access }) {
            bytes -= oldest.value.cost
            entries.removeValue(forKey: oldest.key)
        }
    }

    @concurrent
    private static func decode(_ data: Data, thumbnail: Bool) async throws -> CGImage {
        try ProgressPhotoImage.display(data, thumbnail: thumbnail, displayMaxEdge: 1_600)
    }
}
