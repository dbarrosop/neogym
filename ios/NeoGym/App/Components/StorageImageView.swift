import SwiftUI

extension EnvironmentValues {
    /// Nhost Storage base URL for exercise images, set once by the app shell
    /// so rows, pickers and editors can show thumbnails.
    @Entry var storageBaseURL: URL?
}

struct StorageImageView: View {
    let url: URL?
    var aspectRatio: CGFloat = 16 / 9
    var cornerRadius: CGFloat = 18

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ZStack {
                            NeoGymTheme.fill
                            ProgressView()
                                .accessibilityLabel("Loading image")
                        }
                    case let .success(image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        StorageImagePlaceholderView()
                    @unknown default:
                        StorageImagePlaceholderView()
                    }
                }
            } else {
                StorageImagePlaceholderView()
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(NeoGymTheme.separator)
        )
    }
}

struct AlternatingStorageImageView: View {
    let urls: [URL]
    var aspectRatio: CGFloat = 16 / 9
    var cornerRadius: CGFloat = 18
    var interval: TimeInterval = 2

    @State private var activeIndex = 0

    var body: some View {
        Group {
            if urls.isEmpty {
                StorageImagePlaceholderView()
            } else if urls.count == 1 {
                StorageImageView(url: urls[0], aspectRatio: aspectRatio, cornerRadius: cornerRadius)
            } else {
                TabView(selection: $activeIndex) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                        StorageImageView(url: url, aspectRatio: aspectRatio, cornerRadius: cornerRadius)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .aspectRatio(aspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .overlay(alignment: .bottom) {
                    imagePageIndicator
                        .padding(.bottom, 6)
                }
                .onReceive(Timer.publish(every: interval, on: .main, in: .common).autoconnect()) { _ in
                    guard urls.count > 1 else { return }
                    activeIndex = (activeIndex + 1) % urls.count
                }
            }
        }
    }

    private var imagePageIndicator: some View {
        HStack(spacing: 5) {
            ForEach(urls.indices, id: \.self) { index in
                Circle()
                    .fill(index == activeIndex ? Color.white : Color.white.opacity(0.45))
                    .frame(width: 5, height: 5)
                    .shadow(color: .black.opacity(0.3), radius: 1, y: 1)
            }
        }
    }
}

struct StorageImagePlaceholderView: View {
    var body: some View {
        ZStack {
            NeoGymTheme.fill
            VStack(spacing: 8) {
                Image(systemName: "photo")
                    .font(.title2)
                Text("Image unavailable")
                    .font(.caption)
            }
            .foregroundColor(NeoGymTheme.textSecondary)
        }
    }
}

/// The design's exercise row thumbnail: the exercise's first image cropped
/// to fill a 48 pt square with radius 12, or the photo glyph on a well when
/// there is none. Decorative: the row names the exercise.
struct ExerciseThumbnail: View {
    let fileId: String?
    var size: CGFloat = 48

    @Environment(\.storageBaseURL) private var storageBaseURL

    private var url: URL? {
        storageBaseURL.flatMap { URL.nhostStorageFile(baseURL: $0, fileId: fileId) }
    }

    var body: some View {
        ZStack {
            NeoGymTheme.background
            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                    } else {
                        glyph
                    }
                }
            } else {
                glyph
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous))
        .accessibilityHidden(true)
    }

    private var glyph: some View {
        Image(systemName: "photo")
            .font(.title3)
            .foregroundStyle(NeoGymTheme.textTertiary)
    }
}

extension URL {
    static func nhostStorageFile(baseURL: URL, fileId: String?) -> URL? {
        guard let fileId, !fileId.isEmpty else { return nil }
        return baseURL.appendingPathComponent("files").appendingPathComponent(fileId)
    }
}
