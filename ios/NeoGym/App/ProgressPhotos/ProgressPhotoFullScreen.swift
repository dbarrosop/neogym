import NeoGymKit
import SwiftUI

struct ProgressPhotoFullScreen: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let selection: PhotoViewerSelection
    let onClose: (PhotoViewerSelection) -> Void
    @State private var browsed: ProgressPhoto?
    @State private var loadedHistory: [ProgressPhoto] = []
    @State private var loadedMeasurement: BodyMeasurement?

    private var photo: ProgressPhoto { browsed ?? selection.photo }
    private var history: [ProgressPhoto] { loadedHistory.isEmpty ? selection.history : loadedHistory }
    private var measurement: BodyMeasurement? {
        if loadedMeasurement?.measuredOn == photo.takenOn { return loadedMeasurement }
        return selection.measurement?.measuredOn == photo.takenOn ? selection.measurement : nil
    }
    private var snapshot: PhotoViewerSelection { .init(photo: photo, history: history, measurement: measurement) }
    private var neighbors: ProgressPhotoHistory.Neighbors? { snapshot.neighbors }

    var body: some View {
        ZStack(alignment: .bottom) {
            ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id,
                                 label: "\(photo.label.name) progress photo", fullScreen: true, prefetch: snapshot.adjacentIDs)
                .ignoresSafeArea()
            caption
        }
        .foregroundStyle(.white)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 20).onEnded { drag in
            let offset = drag.translation
            switch ProgressPhotoSwipe(horizontal: Double(offset.width), vertical: Double(offset.height)) {
            case .older: step(to: neighbors?.older)
            case .newer: step(to: neighbors?.newer)
            case .dismiss: close()
            case nil: break
            }
        })
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("progressPhotos.fullScreen")
        .accessibilityAction(.escape, close)
        .accessibilityActions {
            if let older = neighbors?.older { Button("Older photo") { step(to: older) } }
            if let newer = neighbors?.newer { Button("Newer photo") { step(to: newer) } }
            Button("Close full screen", action: close)
        }
        .task { if history.isEmpty { await loadHistory() } }
        .task(id: photo.takenOn) { await loadMeasurement(for: photo.takenOn) }
    }

    private var caption: some View {
        let weight = measurement?.weightKg.map { "\(MetricFormat.trimmed($0, digits: 2)) kg" } ?? "—"
        let fat = measurement?.bodyFatPct.map { "\(MetricFormat.decimal($0))%" } ?? "—"
        return VStack(alignment: .leading, spacing: 4) {
            Text(photo.label.name).font(.headline)
            if repository.isDemo { Text("Demo illustration").font(.caption) }
            Text(ProgressPhotoDate.display(photo.takenOn))
            Text("Weight: \(weight) · Body fat: \(fat)").monospacedDigit()
            if let neighbors {
                Text("\(neighbors.position) of \(neighbors.total)")
                    .monospacedDigit()
                    .accessibilityLabel("Photo \(neighbors.position) of \(neighbors.total)")
            } else {
                Text("—").accessibilityHidden(true)
            }
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.black.opacity(0.8), in: .rect(cornerRadius: 14))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func loadHistory() async {
        guard let rows = try? await repository.history(angle: selection.photo.label.value),
              (try? scope.check()) != nil else { return }
        loadedHistory = rows.contains { $0.id == selection.photo.id } ? rows : [selection.photo]
    }

    private func loadMeasurement(for date: String) async {
        guard measurement == nil, let rows = try? await repository.measurements(on: [date]),
              (try? scope.check()) != nil, photo.takenOn == date else { return }
        loadedMeasurement = ProgressPhotoHistory.measurement(rows, for: date)
    }

    private func step(to next: ProgressPhoto?) {
        if let next, (try? scope.check()) != nil { browsed = next }
    }

    private func close() {
        guard (try? scope.check()) != nil else { return }
        onClose(snapshot)
    }
}
