import NeoGymKit
import Nhost
import SwiftUI

enum MeSection: String, CaseIterable, Identifiable, SecondaryTabSection {
    case profile
    case body
    case journal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .profile: "Profile"
        case .body: "Body"
        case .journal: "Journal"
        }
    }

    var systemImage: String? {
        switch self {
        case .profile: "person.crop.circle"
        case .body: "scalemass"
        case .journal: "book.closed"
        }
    }
}

struct MeNavigationView: View {
    let session: StoredSession
    let bodyRepository: any BodyMeasurementsRepositoryProtocol
    let bodyHealthImporter: (any BodyMeasurementsHealthImporting)?
    let journalRepository: any JournalRepositoryProtocol
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void
    @Binding var areaSelection: AppDestination

    @State private var selection: MeSection = .profile
    @State private var path: [MeRoute] = []
    @State private var reloadToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            rootContent
                .navigationDestination(for: MeRoute.self) { route in
                    routeDestination(for: route)
                }
        }
    }

    private var rootContent: some View {
        SecondarySectionContentHost(selection: $selection) { section in
            sectionPage(for: section)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle(selection.title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .top) {
            if path.isEmpty {
                AppAreaSwitcher(selection: $areaSelection)
            }
        }
        .toolbar {
            rootSectionToolbar
            rootActionToolbar
        }
    }

    @ToolbarContentBuilder
    private var rootSectionToolbar: some ToolbarContent {
        if path.isEmpty {
            ToolbarItem(placement: .principal) {
                SectionTitleMenu(selection: $selection)
            }
        }
    }

    @ToolbarContentBuilder
    private var rootActionToolbar: some ToolbarContent {
        if path.isEmpty, selection == .body {
            RootPrimaryActionToolbar(
                title: "Log measurement",
                systemImage: "plus",
                action: openBodyMeasurementCreate
            )
        }
        if path.isEmpty, selection == .journal {
            RootPrimaryActionToolbar(
                title: "New entry",
                systemImage: "plus",
                action: openJournalEntryCreate
            )
        }
    }

    @ViewBuilder
    private func sectionPage(for section: MeSection) -> some View {
        switch section {
        case .profile:
            ProfileView(
                session: session,
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
        case .body:
            BodyMeasurementsListView(
                repository: bodyRepository,
                healthImporter: bodyHealthImporter,
                reloadToken: reloadToken
            )
        case .journal:
            JournalListView(repository: journalRepository, reloadToken: reloadToken)
        }
    }

    @ViewBuilder
    private func routeDestination(for route: MeRoute) -> some View {
        switch route {
        case let .bodyMeasurementDetail(measurementId):
            BodyMeasurementDetailView(
                measurementId: measurementId,
                repository: bodyRepository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .bodyMeasurementCreate:
            BodyMeasurementCreateView(
                repository: bodyRepository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.bodyMeasurementDetail(id))
                },
                onFinished: invalidateLists
            )
        case let .journalEntryDetail(entryId):
            JournalEntryDetailView(
                entryId: entryId,
                repository: journalRepository,
                onDeleted: invalidateLists,
                onMutated: invalidateLists
            )
        case .journalEntryCreate:
            JournalEntryCreateView(
                repository: journalRepository,
                onCreated: { id in
                    invalidateLists()
                    openRouteAfterCurrentTransition(.journalEntryDetail(id))
                },
                onFinished: invalidateLists
            )
        }
    }

    private func openBodyMeasurementCreate() {
        path.append(.bodyMeasurementCreate)
    }

    private func openJournalEntryCreate() {
        path.append(.journalEntryCreate)
    }

    private func openRouteAfterCurrentTransition(_ route: MeRoute) {
        DispatchQueue.main.async {
            path = [route]
        }
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}
