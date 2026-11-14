import NeoGymKit
import Nhost
import SwiftUI

/// Me tab: Journal · Account.
struct MeNavigationView: View {
    let session: StoredSession
    let journalRepository: any JournalRepositoryProtocol
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void
    @Binding var section: MeSection

    @State private var path: [MeRoute] = []
    @State private var reloadToken = 0

    var body: some View {
        NavigationStack(path: $path) {
            sectionContent
                .environment(\.areaSectionHeader, AnyView(AreaSectionPicker(label: "Me sections", selection: $section)))
                .areaRoot(title: "Me")
                .toolbar { primaryAction }
                .navigationDestination(for: MeRoute.self) { route in
                    routeDestination(for: route)
                        .screenBackground()
                }
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .journal:
            JournalListView(repository: journalRepository, reloadToken: reloadToken)
        case .account:
            ProfileView(
                session: session,
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
        }
    }

    @ToolbarContentBuilder
    private var primaryAction: some ToolbarContent {
        switch section {
        case .journal:
            AreaPrimaryAction(title: "New journal entry") { path.append(.journalEntryCreate) }
        case .account:
            ToolbarItem(placement: .topBarTrailing) { EmptyView() }
        }
    }

    @ViewBuilder
    private func routeDestination(for route: MeRoute) -> some View {
        switch route {
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

    private func openRouteAfterCurrentTransition(_ route: MeRoute) {
        // The create view calls `dismiss()` right after `onCreated`, which pops the
        // create route synchronously; deferring the append to the next runloop tick
        // lands the new detail above the section root (Back returns to the list).
        DispatchQueue.main.async {
            path.append(route)
        }
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}
