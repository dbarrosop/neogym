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
            sectionPages
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .safeAreaInset(edge: .top, spacing: 0) {
                    SecondarySectionBar(selection: $selection)
                }
                .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }

    private var sectionPages: some View {
        TabView(selection: $selection) {
            ProfileView(
                session: session,
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
            .navigationTitle("Profile")
            .tag(MeSection.profile)

            BodyMeasurementsListView(repository: bodyRepository, healthImporter: bodyHealthImporter)
                .tag(MeSection.body)

            JournalListView(repository: journalRepository)
                .tag(MeSection.journal)
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
    }
}
