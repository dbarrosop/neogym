import NeoGymKit
import SwiftUI

struct ProgressPhotoRecord<Content: View>: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let id: String
    let title: String
    @ViewBuilder let content: (ProgressPhoto) -> Content
    @State private var state = LoadState.loading
    @State private var retry = 0

    private enum LoadState {
        case loading, ready(ProgressPhoto), missing, failed
    }

    var body: some View {
        Group {
            switch state {
            case let .ready(photo): content(photo)
            case .loading: FormScrollContainer { AppLoadingStateView(title: "Loading progress photo") }
            case .missing:
                FormScrollContainer {
                    AppEmptyStateView(title: "Photo unavailable", message: "This photo is no longer available in your history.", systemImage: "photo")
                }
            case .failed:
                FormScrollContainer {
                    AppErrorStateView(title: "Couldn't load the photo", message: "Check your connection and try again.") { retry += 1 }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: retry) { await load() }
    }

    private func load() async {
        state = .loading
        do {
            try scope.check()
            let photo = try await repository.reservation(id)
            try scope.check()
            if let photo, photo.id == id, photo.isReady { state = .ready(photo) }
            else { state = .missing }
        } catch {
            if (try? scope.check()) != nil { state = .failed }
        }
    }
}

struct ProgressPhotoViewer: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let photo: ProgressPhoto
    let onStep: (String) -> Void
    let onDeleted: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var neighbors: ProgressPhotoHistory.Neighbors?
    @State private var canCompare = false
    @State private var measurement: BodyMeasurement?
    @State private var historyFailed = false
    @State private var historyRequest = 0
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteRequest = 0
    @State private var deleteFailed = false
    @State private var deleteAttempt: ProgressPhotoDeleteAttempt?

    var body: some View {
        FormScrollContainer {
            Text(photo.label.name).font(.title2.weight(.semibold)).accessibilityAddTraits(.isHeader)
            Text(ProgressPhotoDate.display(photo.takenOn)).foregroundStyle(NeoGymTheme.textSecondary)
            PhotoMeasurementCaption(measurement: measurement, date: photo.takenOn)
            if let neighbors, neighbors.total > 1 {
                let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 6)) : AnyLayout(HStackLayout(spacing: 8))
                layout {
                    Button("Older", systemImage: "chevron.left") { step(neighbors.older) }
                        .disabled(neighbors.older == nil)
                    Text("\(neighbors.position) of \(neighbors.total)")
                        .font(.footnote).monospacedDigit().foregroundStyle(NeoGymTheme.textSecondary)
                        .frame(maxWidth: .infinity)
                    Button("Newer", systemImage: "chevron.right") { step(neighbors.newer) }
                        .disabled(neighbors.newer == nil)
                }
                .buttonStyle(.bordered).controlSize(.large)
            } else if historyFailed {
                Button("Retry photo history") { historyRequest += 1 }.frame(minHeight: 44)
            }
            ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id,
                                 label: "\(photo.label.name) progress photo")
                .clipShape(.rect(cornerRadius: 14))
                .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { gesture in
                    let offset = gesture.translation
                    guard abs(offset.width) > max(55, 2 * abs(offset.height)) else { return }
                    step(offset.width < 0 ? neighbors?.newer : neighbors?.older)
                })
            if canCompare {
                NavigationLink(value: ProgressRoute.progressPhotoCompare(label: photo.label.value, from: photo.id)) {
                    Label("Compare", systemImage: "rectangle.split.2x1").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered).controlSize(.large).disabled(deleting)
            }
            if deleting { InlineProgressLabel(title: "Deleting photo…") }
            if deleteFailed { FeedbackBanner(message: "Couldn't confirm deletion. Check the connection and try Delete again.") }
            FormDeleteButton(title: "Delete photo", isDisabled: deleting) { confirmDelete = true }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink("Edit", value: ProgressRoute.progressPhotoEdit(photo.id)).disabled(deleting)
            }
        }
        .confirmationDialog("Delete this progress photo?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { deleting = true; deleteRequest += 1 }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The photo will no longer be available in your history. Storage cleanup may continue after it disappears.")
        }
        .task(id: historyRequest) { await loadHistory() }
        .task { await loadMeasurement() }
        .task(id: deleteRequest) { if deleting { await delete() } }
    }

    private func step(_ destination: ProgressPhoto?) {
        if let destination, !deleting, (try? scope.check()) != nil { onStep(destination.id) }
    }

    private func loadHistory() async {
        historyFailed = false
        do {
            let photos = try await repository.history(angle: photo.label.value)
            try scope.check()
            neighbors = ProgressPhotoHistory.neighbors(photos, id: photo.id)
            canCompare = photos.count >= 2
        } catch {
            if (try? scope.check()) != nil { historyFailed = true }
        }
    }

    private func loadMeasurement() async {
        guard let rows = try? await repository.measurements(on: [photo.takenOn]), (try? scope.check()) != nil else { return }
        measurement = ProgressPhotoHistory.measurement(rows, for: photo.takenOn)
    }

    private func delete() async {
        deleteFailed = false
        let attempt = deleteAttempt ?? ProgressPhotoDeleteAttempt(repository: repository, id: photo.id)
        deleteAttempt = attempt
        do {
            let deleted = try await attempt.run()
            try scope.check()
            if deleted { onDeleted(); return }
        } catch {
            guard (try? scope.check()) != nil else { return }
        }
        deleteFailed = true
        deleting = false
    }
}
