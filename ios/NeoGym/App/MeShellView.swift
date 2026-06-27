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

    var icon: String {
        switch self {
        case .profile: "person.crop.circle"
        case .body: "heart.text.square"
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
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .safeAreaInset(edge: .top, spacing: 0) {
                    SecondarySectionBar(selection: $selection)
                }
                .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
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
