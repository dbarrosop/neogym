import SwiftUI

struct StorageImageView: View {
    let url: URL?
    var aspectRatio: CGFloat = 16 / 9

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        AppLoadingStateView(title: "Loading image")
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
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(NeoGymTheme.border)
        )
    }
}

struct AlternatingStorageImageView: View {
    let urls: [URL]
    var aspectRatio: CGFloat = 16 / 9
    var interval: TimeInterval = 2

    @State private var activeIndex = 0

    var body: some View {
        Group {
            if urls.isEmpty {
                StorageImagePlaceholderView()
            } else if urls.count == 1 {
                StorageImageView(url: urls[0], aspectRatio: aspectRatio)
            } else {
                TabView(selection: $activeIndex) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                        StorageImageView(url: url, aspectRatio: aspectRatio)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .aspectRatio(aspectRatio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
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
            NeoGymTheme.mutedFill
            VStack(spacing: 8) {
                Image(systemName: "photo")
                    .font(.title2)
                Text("Image unavailable")
                    .font(.caption)
            }
            .foregroundColor(NeoGymTheme.mutedText)
        }
    }
}

extension URL {
    static func nhostStorageFile(baseURL: URL, fileId: String?) -> URL? {
        guard let fileId, !fileId.isEmpty else { return nil }
        return baseURL.appendingPathComponent("files").appendingPathComponent(fileId)
    }
}
