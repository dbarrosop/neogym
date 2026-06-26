import NeoGymKit
import Nhost
import SwiftUI

enum AppDestination: String, CaseIterable, Identifiable {
    case workouts
    case exercises
    case sessions
    case body
    case nutrition
    case journal
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .workouts: "Workouts"
        case .exercises: "Exercises"
        case .sessions: "Sessions"
        case .body: "Body"
        case .nutrition: "Nutrition"
        case .journal: "Journal"
        case .profile: "Profile"
        }
    }

    var icon: String {
        switch self {
        case .workouts: "figure.strengthtraining.traditional"
        case .exercises: "dumbbell"
        case .sessions: "timer"
        case .body: "heart.text.square"
        case .nutrition: "fork.knife"
        case .journal: "book.closed"
        case .profile: "person.crop.circle"
        }
    }

    var phase: String {
        switch self {
        case .profile: "Available now"
        case .exercises: "Phase 3"
        case .workouts: "Phase 4"
        case .sessions: "Available now"
        case .body: "Available now"
        case .journal: "Phase 8"
        case .nutrition: "Phases 9–11"
        }
    }
}

struct AppShellView: View {
    let session: StoredSession
    let environment: AppEnvironment
    let isSigningOut: Bool
    let changeEmailModel: ChangeEmailModel?
    let signOut: () -> Void

    @State private var selection: AppDestination = .workouts
    @State private var pendingSessionId: String?

    var body: some View {
        VStack(spacing: 0) {
            destinationBar
            Divider()
            content
        }
        .background(GridBackground())
    }

    private var destinationBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(AppDestination.allCases) { destination in
                    Button {
                        selection = destination
                    } label: {
                        Label(destination.title, systemImage: destination.icon)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .frame(minWidth: 118)
                            .foregroundColor(selection == destination ? .white : .primary)
                            .background(
                                selection == destination ? Color.accentColor : NeoGymTheme.cardFill,
                                in: Capsule(style: .continuous)
                            )
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(selection == destination ? Color.clear : NeoGymTheme.border)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(destination.title)
                    .accessibilityAddTraits(selection == destination ? .isSelected : [])
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(.ultraThinMaterial)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .workouts:
            WorkoutsNavigationView(
                workoutsRepository: WorkoutsRepository(graphQL: environment.graphQLService),
                exercisesRepository: ExercisesRepository(graphQL: environment.graphQLService),
                storageBaseURL: environment.client.serviceURLs.storage,
                currentUserId: session.user?.id
            ) { sessionId in
                pendingSessionId = sessionId
                selection = .sessions
            }
        case .exercises:
            ExercisesNavigationView(
                repository: ExercisesRepository(graphQL: environment.graphQLService),
                storageBaseURL: environment.client.serviceURLs.storage
            ) { sessionId in
                pendingSessionId = sessionId
                selection = .sessions
            }
        case .sessions:
            SessionsNavigationView(
                sessionsRepository: SessionsRepository(graphQL: environment.graphQLService),
                exercisesRepository: ExercisesRepository(graphQL: environment.graphQLService),
                storageBaseURL: environment.client.serviceURLs.storage,
                pendingSessionId: $pendingSessionId
            )
        case .body:
            BodyNavigationView(
                repository: BodyMeasurementsRepository(graphQL: environment.graphQLService)
            )
        case .profile:
            ProfileView(
                session: session,
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
        default:
            PlaceholderDestinationView(destination: selection)
        }
    }
}

private struct PlaceholderDestinationView: View {
    let destination: AppDestination

    var body: some View {
        ScrollView {
            SectionShell(title: destination.title, subtitle: "Native parity arrives in \(destination.phase).") {
                AppEmptyStateView(
                    title: "Coming next",
                    message: "This destination is wired into the native shell so future parity phases "
                        + "can attach list, detail, and form flows without changing auth or navigation again.",
                    systemImage: destination.icon
                )
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, 20)
            .padding(.vertical, 40)
            .frame(maxWidth: .infinity)
        }
    }
}

#Preview {
    AppShellView(
        session: PreviewSessionFactory.session,
        environment: NhostClientFactory.makeEnvironment(),
        isSigningOut: false,
        changeEmailModel: nil,
        signOut: {}
    )
}

private enum PreviewSessionFactory {
    static var session: StoredSession {
        do {
            return try StoredSession(
                accessToken: "header.payload.signature",
                accessTokenExpiresIn: 900,
                refreshTokenId: "refresh-token-id",
                refreshToken: "refresh-token",
                user: AuthUser(
                    avatarUrl: "",
                    createdAt: Date(timeIntervalSince1970: 1_700_000_000),
                    defaultRole: "user",
                    displayName: "Neo Athlete",
                    email: "athlete@example.com",
                    emailVerified: true,
                    id: "user-id",
                    isAnonymous: false,
                    locale: "en",
                    metadata: [:],
                    phoneNumberVerified: false,
                    roles: ["user"]
                ),
                decodedToken: DecodedToken(claims: [:])
            )
        } catch {
            preconditionFailure("Preview session fixture should be valid: \(error)")
        }
    }
}
