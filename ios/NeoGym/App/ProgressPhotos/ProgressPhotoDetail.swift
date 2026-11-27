import NeoGymKit
import SwiftUI

struct ProgressPhotoRecord<Content: View>: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let id: String
    let title: String
    @ViewBuilder let content: (ProgressPhoto) -> Content
    @Environment(\.progressPhotoImageCache) private var cache
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
            else { cache?.remove(id: id); state = .missing }
        } catch {
            if (try? scope.check()) != nil { state = .failed }
        }
    }
}

struct PhotoViewerSelection {
    let photo: ProgressPhoto
    let history: [ProgressPhoto]
    let measurement: BodyMeasurement?

    var neighbors: ProgressPhotoHistory.Neighbors? { ProgressPhotoHistory.neighbors(history, id: photo.id) }
    var adjacentIDs: [String] { [neighbors?.older?.id, neighbors?.newer?.id].compactMap { $0 } }
}

struct ProgressPhotoViewer: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let photo: ProgressPhoto
    let selection: PhotoViewerSelection?
    let onOpenFullScreen: (PhotoViewerSelection) -> Void
    let onStep: (PhotoViewerSelection) -> Void
    let onDeleted: (String) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var history: [ProgressPhoto] = []
    @State private var measurement: BodyMeasurement?
    @State private var historyFailed = false
    @State private var historyRequest = 0
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteRequest = 0
    @State private var deleteFailed = false
    @State private var deleteAttempt: ProgressPhotoDeleteAttempt?

    private var displayed: ProgressPhoto { selection?.photo ?? photo }
    private var angleHistory: [ProgressPhoto] { history.isEmpty ? selection?.history ?? [] : history }
    private var reading: BodyMeasurement? {
        if measurement?.measuredOn == displayed.takenOn { return measurement }
        return selection?.measurement?.measuredOn == displayed.takenOn ? selection?.measurement : nil
    }
    private var snapshot: PhotoViewerSelection { .init(photo: displayed, history: angleHistory, measurement: reading) }

    var body: some View {
        let photo = displayed
        FormScrollContainer {
            Text(photo.label.name).font(.title2.weight(.semibold)).accessibilityAddTraits(.isHeader)
            Text(ProgressPhotoDate.display(photo.takenOn)).foregroundStyle(NeoGymTheme.textSecondary)
            PhotoMeasurementCaption(measurement: reading, date: photo.takenOn, reservesSpace: true)
            ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id,
                                 label: "\(photo.label.name) progress photo", onOpenFullScreen: openFullScreen,
                                 prefetch: snapshot.adjacentIDs)
                .clipShape(.rect(cornerRadius: 14))
            navigationControls(snapshot.neighbors)
            let canCompare = angleHistory.count >= 2
            NavigationLink(value: ProgressRoute.progressPhotoCompare(label: photo.label.value, from: photo.id)) {
                Label("Compare", systemImage: "rectangle.split.2x1").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered).controlSize(.large)
            .disabled(deleting || !canCompare).opacity(canCompare ? 1 : 0).accessibilityHidden(!canCompare)
            if !repository.isDemo {
                if deleting { InlineProgressLabel(title: "Deleting photo…") }
                if deleteFailed { FeedbackBanner(message: "Couldn't confirm deletion. Check the connection and try Delete again.") }
                FormDeleteButton(title: "Delete photo", isDisabled: deleting) { confirmDelete = true }
            }
        }
        .toolbar {
            if !repository.isDemo {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink("Edit", value: ProgressRoute.progressPhotoEdit(photo.id)).disabled(deleting)
                }
            }
        }
        .confirmationDialog("Delete this progress photo?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { deleting = true; deleteRequest += 1 }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The photo will no longer be available in your history. Storage cleanup may continue after it disappears.")
        }
        .task(id: historyRequest) { await loadHistory() }
        .task(id: photo.takenOn) { await loadMeasurement(for: photo.takenOn) }
        .task(id: deleteRequest) { if deleting { await delete() } }
        .onChange(of: photo.id) {
            deleteFailed = false
            deleteAttempt = nil
        }
    }

    private func openFullScreen() {
        guard !deleting, (try? scope.check()) != nil else { return }
        onOpenFullScreen(snapshot)
    }

    private func step(_ destination: ProgressPhoto?) {
        if let destination, !deleting, (try? scope.check()) != nil {
            onStep(.init(photo: destination, history: angleHistory, measurement: nil))
        }
    }

    private func navigationControls(_ neighbors: ProgressPhotoHistory.Neighbors?) -> some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 6)) : AnyLayout(HStackLayout(spacing: 8))
        return layout {
            Button("Older", systemImage: "chevron.left") { step(neighbors?.older) }
                .disabled(deleting || neighbors?.older == nil)
            Group {
                if let neighbors {
                    Text("\(neighbors.position) of \(neighbors.total)").monospacedDigit()
                } else if historyFailed {
                    Button("Retry") { historyRequest += 1 }.accessibilityLabel("Retry photo history")
                } else {
                    Text("—").accessibilityLabel("Loading photo history")
                }
            }
            .font(.footnote).foregroundStyle(NeoGymTheme.textSecondary)
            .frame(maxWidth: .infinity)
            Button("Newer", systemImage: "chevron.right") { step(neighbors?.newer) }
                .disabled(deleting || neighbors?.newer == nil)
        }
        .buttonStyle(.bordered).controlSize(.large)
    }

    private func loadHistory() async {
        let label = displayed.label.value
        historyFailed = false
        do {
            let photos = try await repository.history(angle: label)
            try scope.check()
            history = photos.contains { $0.id == displayed.id } ? photos : [displayed]
        } catch {
            if (try? scope.check()) != nil { historyFailed = true }
        }
    }

    private func loadMeasurement(for date: String) async {
        guard let rows = try? await repository.measurements(on: [date]),
              (try? scope.check()) != nil, displayed.takenOn == date else { return }
        measurement = ProgressPhotoHistory.measurement(rows, for: date)
    }

    private func delete() async {
        deleteFailed = false
        let id = displayed.id
        let attempt = deleteAttempt ?? ProgressPhotoDeleteAttempt(repository: repository, id: id)
        deleteAttempt = attempt
        do {
            let deleted = try await attempt.run()
            try scope.check()
            if deleted { onDeleted(id); return }
        } catch {
            guard (try? scope.check()) != nil else { return }
        }
        deleteFailed = true
        deleting = false
    }
}
