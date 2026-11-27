import NeoGymKit
import SwiftUI
import UIKit

/// Scoped to the topmost photo route. A pushed child or another tab cannot keep
/// the previous route's private state or work alive.
struct PhotoRouteBoundary<Content: View>: View {
    let route: ProgressRoute
    @Binding var path: [ProgressRoute]
    @Binding var selectedTab: AppTab
    var onBackground: () -> Void = {}
    @ViewBuilder let content: (any ProgressPhotoRepositoryProtocol, ProgressPhotoRouteScope) -> Content

    var body: some View {
        PhotoPrivacyBoundary(isPresented: selectedTab == .progress && path.last == route,
                             fillsRoute: true, onBackground: onBackground, content: content)
    }
}

/// Also protects the photo card when it is embedded in the Body root.
struct PhotoPrivacyBoundary<Content: View>: View {
    let isPresented: Bool
    var fillsRoute = false
    var onBackground: () -> Void = {}
    @ViewBuilder let content: (any ProgressPhotoRepositoryProtocol, ProgressPhotoRouteScope) -> Content
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.privateProgressPhotos) private var repository
    @State private var scope: ProgressPhotoRouteScope?

    private var visible: Bool { repository != nil && isPresented }

    var body: some View {
        ZStack {
            if visible, scenePhase != .background, let repository, let scope {
                // Inactive can be a system chooser, not retirement. Keep the
                // picker host attached, but conceal metadata, previews and controls.
                content(ScopedProgressPhotoRepository(repository, scope: scope), scope)
                    .id(scope.id)
                    .privacySensitive()
                    .opacity(scenePhase == .active ? 1 : 0)
                    .accessibilityHidden(scenePhase != .active)
                    .allowsHitTesting(scenePhase == .active)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: fillsRoute ? .infinity : nil)
        .overlay {
            // UIKit handles willDeactivate before waiting for a SwiftUI redraw.
            if visible {
                if fillsRoute {
                    cover.ignoresSafeArea()
                } else {
                    cover
                }
            }
        }
        .onAppear { reconcile() }
        .onDisappear { retire() }
        .onChange(of: visible) { reconcile() }
        .onChange(of: scenePhase) {
            if scenePhase == .background { background() }
            else { reconcile() }
        }
    }

    private var cover: some View {
        PhotoSnapshotCover(onBackground: background)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private func reconcile() {
        if !visible { retire() }
        else if scenePhase == .active && scope == nil { scope = ProgressPhotoRouteScope() }
    }

    private func retire() {
        scope?.retire()
        scope = nil
    }

    private func background() {
        guard scope != nil else { return }
        retire()
        onBackground()
    }
}

private struct PhotoSnapshotCover: UIViewRepresentable {
    let onBackground: () -> Void

    func makeUIView(context: Context) -> Cover { Cover() }
    func updateUIView(_ view: Cover, context: Context) { view.onBackground = onBackground }

    final class Cover: UIView {
        var onBackground: (() -> Void)?

        init() {
            super.init(frame: .zero)
            backgroundColor = UIColor(NeoGymTheme.background)
            isUserInteractionEnabled = false
            isAccessibilityElement = false
            let notes = NotificationCenter.default
            notes.addObserver(self, selector: #selector(deactivating(_:)), name: UIScene.willDeactivateNotification, object: nil)
            notes.addObserver(self, selector: #selector(backgrounded(_:)), name: UIScene.didEnterBackgroundNotification, object: nil)
            notes.addObserver(self, selector: #selector(activated(_:)), name: UIScene.didActivateNotification, object: nil)
        }

        required init?(coder: NSCoder) { nil }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            isHidden = window?.windowScene?.activationState == .foregroundActive
        }

        @objc private func deactivating(_ note: Notification) {
            if isOurScene(note) { isHidden = false }
        }

        @objc private func backgrounded(_ note: Notification) {
            if isOurScene(note) { isHidden = false; onBackground?() }
        }

        @objc private func activated(_ note: Notification) {
            if isOurScene(note) { isHidden = true }
        }

        private func isOurScene(_ note: Notification) -> Bool {
            guard let scene = window?.windowScene else { return false }
            return note.object as? UIScene === scene
        }
    }
}
