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
            ZStack {
                sectionPages
                    .id(selection)
                    .transition(.opacity.combined(with: .scale(scale: 0.985)))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .animation(.easeInOut(duration: 0.28), value: selection)
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
    private var sectionPages: some View {
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
