import NeoGymKit
import SwiftUI

/// Only visible tiles retain decoded pixels. At most three thumbnails can
/// fetch and decode concurrently within the active photo surface.
actor PhotoImageSlots {
    private var active = 0
    private var waiters: [UUID: AsyncStream<Void>.Continuation] = [:]

    func acquire() async throws {
        while active >= 3 {
            try Task.checkCancellation()
            let id = UUID()
            let signal = AsyncStream<Void> { waiters[id] = $0 }
            var iterator = signal.makeAsyncIterator()
            _ = await iterator.next()
            waiters[id] = nil
        }
        try Task.checkCancellation()
        active += 1
    }

    func release() {
        active -= 1
        for waiter in waiters.values { waiter.finish() }
        waiters.removeAll()
    }
}

struct ProgressPhotoDisplay: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let id: String
    var thumbnailSlots: PhotoImageSlots?
    let label: String
    var thumbnailHeight: CGFloat = 160
    var fillFrame = false
    var fullScreen = false
    var onOpenFullScreen: (() -> Void)?
    var prefetch: [String] = []
    @Environment(\.progressPhotoImageCache) private var cache
    @State private var visible = false
    @State private var loaded: Loaded?
    @State private var failedKey: ProgressPhotoImageCache.Key?
    @State private var retry = 0

    private struct Loaded {
        let key: ProgressPhotoImageCache.Key
        let image: CGImage
    }

    private struct Request: Equatable {
        let key: ProgressPhotoImageCache.Key
        let retry: Int
        let active: Bool
    }

    private struct Prefetch: Equatable {
        let key: ProgressPhotoImageCache.Key
        let ids: [String]
    }

    private var thumbnail: Bool { thumbnailSlots != nil }
    private var key: ProgressPhotoImageCache.Key { .init(id: id, thumbnail: thumbnail) }
    private var active: Bool { !thumbnail || visible }
    private var image: CGImage? {
        guard active, failedKey != key else { return nil }
        if loaded?.key == key { return loaded?.image }
        return cache?.image(for: key) ?? (!thumbnail ? cache?.image(for: .init(id: id, thumbnail: true)) : nil)
    }

    var body: some View {
        Group {
            if thumbnail {
                NeoGymTheme.inset.frame(height: thumbnailHeight).overlay { content }.clipped()
            } else if fullScreen || fillFrame {
                (fullScreen ? Color.black : NeoGymTheme.inset)
                    .frame(maxWidth: .infinity, maxHeight: .infinity).overlay { content }.clipped()
            } else {
                NeoGymTheme.inset.aspectRatio(4.0 / 5.0, contentMode: .fit)
                    .frame(maxWidth: 496).overlay { content }.clipped()
                    .frame(maxWidth: .infinity)
            }
        }
        .onScrollVisibilityChange(threshold: 0.01) { isVisible in
            if thumbnail {
                visible = isVisible
                if !isVisible { loaded = nil; failedKey = nil }
            }
        }
        .task(id: Request(key: key, retry: retry, active: active)) {
            if active { await load(key) }
        }
        .task(id: Prefetch(key: key, ids: loaded?.key == key ? prefetch : [])) {
            if loaded?.key == key, let cache {
                for neighbor in prefetch where !Task.isCancelled {
                    _ = try? await cache.load(.init(id: neighbor, thumbnail: false), repository: repository, scope: scope)
                }
            }
        }
        .onDisappear { loaded = nil }
    }

    @ViewBuilder private var content: some View {
        if let image {
            let photo = Image(image, scale: 1, label: Text(label)).resizable()
                .aspectRatio(contentMode: thumbnail || fillFrame ? .fill : .fit)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if let onOpenFullScreen {
                Button(action: onOpenFullScreen) { photo.contentShape(Rectangle()) }
                    .buttonStyle(.plain)
                    .accessibilityLabel(label)
                    .accessibilityHint("Opens full screen")
                    .accessibilityIdentifier("progressPhotos.openFullScreen")
            } else { photo }
        } else if failedKey == key {
            VStack(spacing: 4) {
                Text(thumbnail ? "Preview unavailable" : "Image unavailable").font(.caption)
                if !thumbnail && !fullScreen {
                    Button("Retry image") { failedKey = nil; retry += 1 }.frame(minHeight: 44)
                }
            }
        } else {
            Image(systemName: "photo").foregroundStyle(.secondary).accessibilityLabel("Loading image")
        }
    }

    private func load(_ requestKey: ProgressPhotoImageCache.Key) async {
        do {
            try scope.check()
            if let thumbnailSlots { try await thumbnailSlots.acquire() }
            let result: CGImage
            do {
                let storage = cache ?? ProgressPhotoImageCache(byteLimit: 0)
                result = try await storage.load(requestKey, repository: repository, scope: scope)
            } catch {
                if let thumbnailSlots { await thumbnailSlots.release() }
                throw error
            }
            if let thumbnailSlots { await thumbnailSlots.release() }
            try scope.check()
            if active { loaded = .init(key: requestKey, image: result); failedKey = nil }
        } catch is CancellationError {
            // A cancelled offscreen or superseded request cannot change the current image.
        } catch {
            if (try? scope.check()) != nil { loaded = nil; failedKey = requestKey }
        }
    }
}
