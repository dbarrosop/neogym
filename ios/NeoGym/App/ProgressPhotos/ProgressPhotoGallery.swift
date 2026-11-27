import NeoGymKit
import SwiftUI

struct ProgressPhotoGallery: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    @Binding var angle: String
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var catalog: [ProgressPhotoAngle] = []
    @State private var rows = ProgressPhotoGalleryRows()
    @State private var measurements: [BodyMeasurement] = []
    @State private var request = 0
    @State private var olderRequest = 0
    @State private var generation = 0
    @State private var loading = true
    @State private var loadingOlder = false
    @State private var failed = false
    @State private var olderFailed = false
    @State private var slots = PhotoImageSlots()

    var body: some View {
        FormScrollContainer {
            if !catalog.isEmpty {
                PhotoAngleChips(catalog: catalog, selection: $angle, includesAll: true)
            }
            content
        }
        .navigationTitle("Progress photos")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if let label = ProgressPhotoHistory.comparableAngle(rows.photos), !loading {
                    NavigationLink(value: ProgressRoute.progressPhotoCompare(label: label, from: nil)) {
                        Label("Compare", systemImage: "rectangle.split.2x1")
                    }
                    .accessibilityIdentifier("progressPhotos.compare")
                }
                NavigationLink(value: ProgressRoute.progressPhotoCreate(date: nil, angle: nil)) {
                    Label("Add photos", systemImage: "plus")
                }
                .accessibilityIdentifier("progressPhotos.add")
            }
        }
        .task(id: LoadKey(angle: angle, request: request)) { await loadFirst() }
        .task(id: olderRequest) { if loadingOlder { await loadOlder() } }
        .refreshable { await loadFirst() }
    }

    private struct LoadKey: Equatable { let angle: String; let request: Int }

    @ViewBuilder private var content: some View {
        if loading {
            AppLoadingStateView(title: "Loading progress photos")
        } else if failed {
            AppErrorStateView(title: "Couldn't load progress photos", message: "Check your connection and try again.") {
                request += 1
            }
        } else if rows.photos.isEmpty && rows.next == nil {
            AppEmptyStateView(
                title: angle.isEmpty ? "No progress photos yet" : "No photos for this angle",
                message: angle.isEmpty ? "Add photos to start your private history." : "Choose another angle or show all photos.",
                systemImage: "photo"
            )
        } else {
            if angle.isEmpty { contactSheet } else { angleGrid }
            if rows.next != nil {
                Button(loadingOlder ? "Loading older photos…" : "Load older photos") {
                    loadingOlder = true
                    olderRequest += 1
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(loadingOlder)
                if olderFailed { FeedbackBanner(message: "Couldn't load older photos. Try again.") }
            }
        }
    }

    private var contactSheet: some View {
        let sheet = ProgressPhotoHistory.sheet(rows.photos, catalog: catalog)
        let columnCount = max(1, min(sheet.columns.count, typeSize.isAccessibilitySize ? 1 : 4))
        return LazyVStack(alignment: .leading, spacing: 16) {
            ForEach(sheet.days) { day in
                VStack(alignment: .leading, spacing: 8) {
                    Text(ProgressPhotoDate.display(day.date)).font(.headline).accessibilityAddTraits(.isHeader)
                    PhotoMeasurementCaption(measurement: ProgressPhotoHistory.measurement(measurements, for: day.date), date: day.date)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .top), count: columnCount), spacing: 10) {
                        ForEach(sheet.columns) { label in
                            let photos = day.photos.filter { $0.label.value == label.value }
                            if let first = photos.first {
                                tile(first, caption: label.name, extra: photos.count > 1 ? "\(photos.count) photos" : nil)
                            } else if catalog.contains(where: { $0.value == label.value }) {
                                NavigationLink(value: ProgressRoute.progressPhotoCreate(date: day.date, angle: label.value)) {
                                    VStack(spacing: 4) {
                                        Image(systemName: "plus")
                                        Text("Add").font(.subheadline.weight(.medium))
                                        Text(label.name).font(.caption)
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 100)
                                    .padding(.vertical, 4)
                                    .overlay { RoundedRectangle(cornerRadius: 12).strokeBorder(NeoGymTheme.textTertiary, style: StrokeStyle(lineWidth: 1, dash: [4, 4])) }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Add \(label.name) photo for \(ProgressPhotoDate.display(day.date))")
                            } else {
                                Color.clear.frame(height: 1).accessibilityHidden(true)
                            }
                        }
                    }
                }
                .padding(12)
                .cardSurface()
            }
        }
    }

    private var angleGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 12) {
            ForEach(rows.photos) { photo in
                tile(photo, caption: ProgressPhotoDate.display(photo.takenOn), height: 152,
                     extra: PhotoMeasurementCaption.text(ProgressPhotoHistory.measurement(measurements, for: photo.takenOn)))
            }
        }
    }

    private func tile(_ photo: ProgressPhoto, caption: String, height: CGFloat = 100, extra: String?) -> some View {
        NavigationLink(value: ProgressRoute.progressPhotoDetail(photo.id)) {
            VStack(alignment: .leading, spacing: 4) {
                ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id, thumbnailSlots: slots, label: "", thumbnailHeight: height)
                    .accessibilityHidden(true)
                Text(caption).font(.caption.weight(.semibold)).padding(.horizontal, 6)
                if let extra { Text(extra).font(.caption2).foregroundStyle(NeoGymTheme.textSecondary).padding(.horizontal, 6) }
            }
            .padding(.bottom, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardSurface(cornerRadius: 12)
            .clipShape(.rect(cornerRadius: 12))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel([photo.label.name, ProgressPhotoDate.display(photo.takenOn), extra].compactMap { $0 }.joined(separator: ", "))
    }

    private func loadFirst() async {
        generation += 1
        let run = generation
        let selected = angle
        loading = true
        loadingOlder = false
        olderFailed = false
        failed = false
        rows = .init()
        measurements = []
        do {
            let angles = try await repository.angles()
            try scope.check()
            guard run == generation, angle == selected else { return }
            catalog = angles
            if !selected.isEmpty && !angles.contains(where: { $0.value == selected }) {
                angle = ""
                return
            }
            let page = try await repository.page(angle: selected.isEmpty ? nil : selected, after: nil)
            try scope.check()
            guard run == generation, angle == selected else { return }
            rows.append(page)
            loading = false
            await loadMeasurements(for: page, run: run)
        } catch {
            guard (try? scope.check()) != nil, run == generation, angle == selected else { return }
            loading = false
            failed = true
        }
    }

    private func loadOlder() async {
        guard let cursor = rows.next else { loadingOlder = false; return }
        let run = generation
        let selected = angle
        olderFailed = false
        do {
            let page = try await repository.page(angle: selected.isEmpty ? nil : selected, after: cursor)
            try scope.check()
            guard run == generation, angle == selected else { return }
            rows.append(page)
            loadingOlder = false
            await loadMeasurements(for: page, run: run)
        } catch {
            guard (try? scope.check()) != nil, run == generation, angle == selected else { return }
            loadingOlder = false
            olderFailed = true
        }
    }

    private func loadMeasurements(for page: ProgressPhotoPage, run: Int) async {
        guard let result = try? await repository.measurements(on: page.photos.map(\.takenOn)),
              (try? scope.check()) != nil, run == generation else { return }
        let refreshed = Set(result.map(\.measuredOn))
        measurements.removeAll { refreshed.contains($0.measuredOn) }
        measurements.append(contentsOf: result)
    }
}
