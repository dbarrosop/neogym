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

    var body: some View {
        NavigationView {
            SecondarySectionContentHost(selection: $selection) { section in
                sectionPage(for: section)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    SecondarySectionBar(selection: $selection)
                }
            }
        }
        .navigationViewStyle(.stack)
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
            BodyMeasurementsListView(repository: bodyRepository, healthImporter: bodyHealthImporter)
        case .journal:
            JournalListView(repository: journalRepository)
        }
    }
}
