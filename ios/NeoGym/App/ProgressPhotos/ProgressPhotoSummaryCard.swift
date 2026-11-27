import NeoGymKit
import SwiftUI

struct ProgressPhotoSummaryCard: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let refreshToken: Int
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var summary: ProgressPhotoSummary?
    @State private var photos: [ProgressPhoto] = []
    @State private var failed = false
    @State private var retry = 0
    @State private var slots = PhotoImageSlots()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Progress photos", systemImage: "photo.on.rectangle.angled")
                .font(.headline).accessibilityAddTraits(.isHeader)
            if let summary {
                let count = summary.count == 1 ? "1 photo" : "\(summary.count) photos"
                if summary.count == 0 {
                    Text("No photos yet")
                } else if let latest = summary.latestDate {
                    Text("\(count) · Last taken \(ProgressPhotoDate.display(latest))").monospacedDigit()
                } else {
                    Text(count).monospacedDigit()
                }
            }
            if failed {
                Text(summary == nil ? "Couldn't load your photos." : "Couldn't refresh your photos.")
                Button("Retry") { retry += 1 }.frame(minHeight: 44)
            } else if summary == nil {
                InlineProgressLabel(title: "Loading photo history…")
            }
            if !photos.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: typeSize.isAccessibilitySize ? 2 : 4), spacing: 8) {
                    ForEach(photos) { photo in
                        NavigationLink(value: ProgressRoute.progressPhotoDetail(photo.id)) {
                            ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id,
                                                 thumbnailSlots: slots, label: "", thumbnailHeight: 85)
                                .clipShape(.rect(cornerRadius: 8))
                                .accessibilityHidden(true)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(photo.label.name), \(ProgressPhotoDate.display(photo.takenOn))")
                    }
                }
            }
            let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
            layout {
                NavigationLink("View all", value: ProgressRoute.progressPhotoGallery)
                    .accessibilityLabel("View all progress photos")
                    .accessibilityIdentifier("progressPhotos.open")
                NavigationLink(value: ProgressRoute.progressPhotoCreate(date: nil, angle: nil)) {
                    Label("Add photos", systemImage: "plus")
                }
                .accessibilityIdentifier("progressPhotos.addFromBody")
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .cardSurface()
        .task(id: LoadKey(refresh: refreshToken, retry: retry)) { await load() }
    }

    private struct LoadKey: Equatable { let refresh: Int; let retry: Int }

    private func load() async {
        failed = false
        do {
            let value = try await repository.summary()
            try scope.check()
            summary = value
            photos = []
            if let date = value.latestDate {
                let items = try await repository.photos(on: date)
                try scope.check()
                photos = ProgressPhotoHistory.latestTiles(items)
            }
        } catch {
            if (try? scope.check()) != nil { failed = true }
        }
    }
}

struct PhotoAngleChips: View {
    let catalog: [ProgressPhotoAngle]
    @Binding var selection: String
    var includesAll = false

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                if includesAll { chip("All photos", value: "") }
                ForEach(catalog) { chip($0.name, value: $0.value) }
            }
        }
        .scrollIndicators(.hidden)
        .accessibilityLabel("Photo angles")
    }

    private func chip(_ title: String, value: String) -> some View {
        Button { selection = value } label: {
            Text(title).font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(selection == value ? NeoGymTheme.accent : NeoGymTheme.inset, in: Capsule())
                .foregroundStyle(selection == value ? .white : NeoGymTheme.text)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selection == value ? .isSelected : [])
    }
}

struct PhotoMeasurementCaption: View {
    let measurement: BodyMeasurement?
    let date: String

    var body: some View {
        if let values = Self.text(measurement) {
            VStack(alignment: .leading, spacing: 2) {
                Text(values).monospacedDigit()
                if let measuredOn = measurement?.measuredOn, measuredOn != date {
                    Text("Measured \(ProgressPhotoDate.display(measuredOn))").font(.caption2)
                }
            }
            .font(.caption).foregroundStyle(NeoGymTheme.textSecondary)
        }
    }

    static func text(_ measurement: BodyMeasurement?) -> String? {
        let weight = measurement?.weightKg.map { "\(MetricFormat.trimmed($0, digits: 2)) kg" }
        let fat = measurement?.bodyFatPct.map { "\(MetricFormat.decimal($0))% body fat" }
        let values = [weight, fat].compactMap { $0 }
        return values.isEmpty ? nil : values.joined(separator: " · ")
    }
}
