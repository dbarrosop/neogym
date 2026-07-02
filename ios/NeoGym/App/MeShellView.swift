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
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if path.isEmpty {
                ToolbarItem(placement: .principal) {
                    SecondarySectionBar(selection: $selection)
                }
            }
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
            .navigationTitle("Profile")
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

    private func openRoute(_ route: MeRoute) {
        path.append(route)
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
