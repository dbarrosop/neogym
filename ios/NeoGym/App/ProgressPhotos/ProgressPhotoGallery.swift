import NeoGymKit
import SwiftUI

struct ProgressPhotoGallery: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var catalog: [ProgressPhotoAngle] = []
    @State private var angle = ""
    @State private var paging = ProgressPhotoPaging()
    @State private var page: ProgressPhotoPage?
    @State private var request = 0
    @State private var generation = 0
    @State private var failed = false
    @State private var loading = true
    @State private var slots = PhotoImageSlots()

    var body: some View {
        ScrollViewReader { scroll in
            FormScrollContainer {
                Color.clear.frame(height: 0).id("photo-gallery-top").accessibilityHidden(true)
                if !catalog.isEmpty {
                    Picker("Filter by angle", selection: angleSelection) {
                        Text("All angles").tag("")
                        ForEach(catalog) { Text($0.name).tag($0.value) }
                    }
                    .pickerStyle(.menu)
                    .frame(minHeight: 44)
                }
                pageContent
            }
            .onChange(of: request) { scroll.scrollTo("photo-gallery-top", anchor: .top) }
        }
        .navigationTitle("Progress photos")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: ProgressRoute.progressPhotoCreate) {
                    Label("Add photo", systemImage: "plus")
                }
                .accessibilityIdentifier("progressPhotos.add")
            }
        }
        .task(id: request) { await load() }
        .refreshable { await load(fromStart: true) }
    }

    @ViewBuilder private var pageContent: some View {
        if loading {
            AppLoadingStateView(title: "Loading progress photos")
        } else if failed {
            AppErrorStateView(title: "Couldn't load progress photos", message: "Check your connection and try again.") {
                request += 1
            }
        } else if let page {
            if page.photos.isEmpty {
                AppEmptyStateView(
                    title: angle.isEmpty ? "No progress photos" : "No photos for this angle",
                    message: angle.isEmpty ? "Add a photo to begin your private history." : "Choose another angle or show all angles.",
                    systemImage: "photo"
                )
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: typeSize.isAccessibilitySize ? 290 : 145), spacing: 12)], spacing: 12) {
                    ForEach(page.photos) { photo in
                        NavigationLink(value: ProgressRoute.progressPhotoDetail(photo.id)) {
                            tile(photo)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(photo.label.name), \(ProgressPhotoDate.display(photo.takenOn))")
                    }
                }
            }
        }
        if !loading && (paging.number > 1 || page?.next != nil) {
            pageControls
        }
    }

    private var angleSelection: Binding<String> {
        Binding(get: { angle }, set: { selection in
            guard selection != angle else { return }
            angle = selection
            paging.reset()
            requestPage()
        })
    }

    private var pageControls: some View {
        VStack(spacing: 8) {
            Text("Page \(paging.number)")
                .font(.footnote).foregroundStyle(NeoGymTheme.textSecondary)
            let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
            layout {
                Button("Previous") {
                    if paging.previous() { requestPage() }
                }
                .disabled(!paging.canGoBack)
                Button("Next") {
                    if let next = page?.next, paging.next(after: next) { requestPage() }
                }
                .disabled(page?.next == nil)
            }
            .buttonStyle(NeoGymSecondaryButtonStyle())
        }
        .frame(maxWidth: .infinity)
    }

    private func tile(_ photo: ProgressPhoto) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id, thumbnailSlots: slots, label: "")
                .accessibilityHidden(true)
            Text(photo.label.name).font(.headline).padding(.horizontal, 12)
            Text(ProgressPhotoDate.display(photo.takenOn)).font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .padding(.horizontal, 12).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
        .contentShape(Rectangle())
    }

    private func requestPage() {
        loading = true
        page = nil
        generation += 1
        request += 1
    }

    private func load(fromStart: Bool = false) async {
        generation += 1
        let run = generation
        if fromStart { paging.reset() }
        page = nil
        loading = true
        failed = false
        let requestedAngle = angle
        let after = paging.cursor
        do {
            try scope.check()
            let freshCatalog = try await repository.angles()
            try scope.check()
            let filter = freshCatalog.contains { $0.value == requestedAngle } ? requestedAngle : ""
            let result = try await repository.page(angle: filter.isEmpty ? nil : filter, after: filter == requestedAngle ? after : nil)
            try scope.check()
            guard run == generation, angle == requestedAngle else { return }
            catalog = freshCatalog
            if filter != angle {
                angle = filter
                paging.reset()
            }
            page = result
            loading = false
        } catch {
            guard (try? scope.check()) != nil, run == generation else { return }
            failed = true
            loading = false
        }
    }
}
