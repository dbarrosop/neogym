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

    var body: some View {
        FormScrollContainer {
            Text(photo.label.name).font(.title2.weight(.semibold)).accessibilityAddTraits(.isHeader)
            Text(ProgressPhotoDate.display(photo.takenOn)).foregroundStyle(NeoGymTheme.textSecondary)
            ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id,
                                 label: "\(photo.label.name) progress photo")
                .clipShape(.rect(cornerRadius: 14))
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink("Edit", value: ProgressRoute.progressPhotoEdit(photo.id))
            }
        }
    }
}
