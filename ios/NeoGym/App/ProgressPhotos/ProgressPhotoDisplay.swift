import NeoGymKit
import SwiftUI

/// A gallery keeps at most one page of thumbnails, and only visible tiles
/// retain decoded pixels. Three loads can simultaneously fetch and decode.
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
    @State private var visible = false
    @State private var pixels: CGImage?
    @State private var failed = false
    @State private var retry = 0

    private var thumbnail: Bool { thumbnailSlots != nil }

    var body: some View {
        Group {
            if thumbnail {
                NeoGymTheme.inset.frame(height: 160)
                    .overlay {
                        if let pixels {
                            Image(decorative: pixels, scale: 1).resizable().scaledToFill()
                        } else {
                            placeholder
                        }
                    }
                    .clipped()
            } else if let pixels {
                Image(pixels, scale: 1, label: Text(label)).resizable().scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: 620)
            } else {
                placeholder.frame(maxWidth: .infinity, minHeight: 180).background(NeoGymTheme.inset)
            }
        }
        .onScrollVisibilityChange(threshold: 0.01) { isVisible in
            if thumbnail {
                visible = isVisible
                if !isVisible { pixels = nil; failed = false }
            }
        }
        .task(id: thumbnail && !visible ? nil : retry) {
            if thumbnail && !visible { return }
            await load()
        }
        .onDisappear { pixels = nil }
    }

    @ViewBuilder private var placeholder: some View {
        if failed && thumbnail {
            Text("Preview unavailable").font(.caption)
        } else if failed {
            VStack {
                Text("Image unavailable")
                Button("Retry image") { failed = false; retry += 1 }.frame(minHeight: 44)
            }
        } else {
            ProgressView().accessibilityLabel("Loading image")
        }
    }

    private func load() async {
        do {
            try scope.check()
            if let thumbnailSlots { try await thumbnailSlots.acquire() }
            let result: CGImage
            do {
                try scope.check()
                let bytes = try await repository.imageBytes(id, thumbnail: thumbnail)
                result = try await Self.decode(bytes, thumbnail: thumbnail)
            } catch {
                if let thumbnailSlots { await thumbnailSlots.release() }
                throw error
            }
            if let thumbnailSlots { await thumbnailSlots.release() }
            try scope.check()
            if !thumbnail || visible { pixels = result }
        } catch {
            if (try? scope.check()) != nil { failed = true }
        }
    }

    nonisolated private static func decode(_ bytes: Data, thumbnail: Bool) async throws -> CGImage {
        try ProgressPhotoImage.display(bytes, thumbnail: thumbnail)
    }
}
