import NeoGymKit
import Nhost
import SwiftUI

enum MeSection: String, CaseIterable, Identifiable {
    case profile
    case body
    case energy
    case journal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .profile: "Profile"
        case .body: "Body"
        case .energy: "Energy"
        case .journal: "Journal"
        }
    }

    var systemImage: String? {
        switch self {
        case .profile: "person.crop.circle"
        case .body: "scalemass"
        case .energy: "flame"
        case .journal: "book.closed"
        }
    }
}

struct MeNavigationView: View {
    let session: StoredSession
    let bodyRepository: any BodyMeasurementsRepositoryProtocol
    let bodyHealthImporter: (any BodyMeasurementsHealthImporting)?
    let energyRepository: any DailyEnergyRepositoryProtocol
    let energyHealthImporter: (any DailyEnergyHealthImporting)?
    let journalRepository: any JournalRepositoryProtocol
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void
    @Binding var areaSelection: AppDestination

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
        List {
            ForEach(MeSection.allCases) { section in
                Button {
                    path.append(subsectionRoute(for: section))
                } label: {
                    MeHubRow(section: section)
                }
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets(
                    top: NeoGymTheme.spacingXS,
                    leading: NeoGymTheme.screenHorizontalPadding,
                    bottom: NeoGymTheme.spacingXS,
                    trailing: NeoGymTheme.screenHorizontalPadding
                ))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .accessibilityLabel(section.title)
                .accessibilityHint("Opens \(section.title)")
                .accessibilityAddTraits(.isButton)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .navigationTitle("Me")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Area", selection: $areaSelection) {
                    ForEach(AppDestination.allCases) { destination in
                        Text(destination.title).tag(destination)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Primary area")
            }
        }
    }

    private func subsectionRoute(for section: MeSection) -> MeRoute {
        switch section {
        case .profile: .profile
        case .body: .bodyList
        case .energy: .energyList
        case .journal: .journalList
        }
    }

    @ViewBuilder
    private func routeDestination(for route: MeRoute) -> some View {
        switch route {
        case .profile, .bodyList, .energyList, .journalList:
            subsectionListDestination(for: route)
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

    @ViewBuilder
    private func subsectionListDestination(for route: MeRoute) -> some View {
        switch route {
        case .profile:
            ProfileView(
                session: session,
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
        case .bodyList:
            BodyMeasurementsListView(
                repository: bodyRepository,
                healthImporter: bodyHealthImporter,
                reloadToken: reloadToken
            )
            .navigationTitle("Body")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                RootPrimaryActionToolbar(
                    title: "Log measurement",
                    systemImage: "plus",
                    action: openBodyMeasurementCreate
                )
            }
        case .energyList:
            DailyEnergyListView(
                repository: energyRepository,
                healthImporter: energyHealthImporter
            )
            .navigationTitle("Energy")
            .navigationBarTitleDisplayMode(.inline)
        case .journalList:
            JournalListView(repository: journalRepository, reloadToken: reloadToken)
                .navigationTitle("Journal")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    RootPrimaryActionToolbar(
                        title: "New entry",
                        systemImage: "plus",
                        action: openJournalEntryCreate
                    )
                }
        case .bodyMeasurementDetail, .bodyMeasurementCreate, .journalEntryDetail, .journalEntryCreate:
            EmptyView()
        }
    }

    private func openBodyMeasurementCreate() {
        path.append(.bodyMeasurementCreate)
    }

    private func openJournalEntryCreate() {
        path.append(.journalEntryCreate)
    }

    private func openRouteAfterCurrentTransition(_ route: MeRoute) {
        // The create view calls `dismiss()` right after `onCreated`, which pops the
        // create route synchronously; deferring the append to the next runloop tick
        // lands the new detail above its subsection list (Back returns to the list).
        DispatchQueue.main.async {
            path.append(route)
        }
    }

    private func invalidateLists() {
        reloadToken += 1
    }
}

private struct MeHubRow: View {
    let section: MeSection

    var body: some View {
        GlassPanel(
            contentPadding: EdgeInsets(
                top: NeoGymTheme.spacingMD,
                leading: NeoGymTheme.spacingLG,
                bottom: NeoGymTheme.spacingMD,
                trailing: NeoGymTheme.spacingLG
            )
        ) {
            HStack(spacing: NeoGymTheme.spacingMD) {
                Image(systemName: section.systemImage ?? "circle")
                    .font(.title3)
                    .foregroundStyle(NeoGymTheme.accent)
                    .frame(width: 32)
                Text(section.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.primaryText)
                Spacer(minLength: NeoGymTheme.spacingSM)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.mutedText)
            }
            .frame(minHeight: 44)
        }
    }
}
