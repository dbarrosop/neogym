import NeoGymKit
import Nhost
import SwiftUI
import UIKit

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
        case .journal: "Available now"
        case .nutrition: "Available now"
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
    @State private var isKeyboardVisible = false

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !isKeyboardVisible {
                    AppDestinationDock(selection: $selection)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.easeInOut(duration: 0.18), value: isKeyboardVisible)
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                isKeyboardVisible = true
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                isKeyboardVisible = false
            }
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
        case .journal:
            JournalNavigationView(
                repository: JournalRepository(graphQL: environment.graphQLService)
            )
        case .nutrition:
            NutritionNavigationView(
                repository: NutritionFoodMealRepository(graphQL: environment.graphQLService),
                currentUserId: session.user?.id
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

private struct AppDestinationDock: View {
    @Binding var selection: AppDestination

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                ForEach(AppDestination.allCases) { destination in
                    AppDestinationDockItem(
                        destination: destination,
                        isSelected: selection == destination
                    ) {
                        selection = destination
                    }
                }
            }
            .padding(NeoGymTheme.spacingXS)
        }
        .frame(maxWidth: .infinity)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusXXL,
            material: .regular,
            tint: NeoGymTheme.glassStrongFill,
            stroke: NeoGymTheme.glassStroke,
            shadow: true
        )
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.top, NeoGymTheme.spacingXS)
        .padding(.bottom, NeoGymTheme.spacingXS)
        .accessibilityElement(children: .contain)
    }
}

private struct AppDestinationDockItem: View {
    let destination: AppDestination
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: NeoGymTheme.spacingXXS) {
                Image(systemName: destination.icon)
                    .font(.headline.weight(.semibold))
                    .imageScale(.medium)
                    .frame(height: 20)

                Text(destination.title)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .foregroundColor(isSelected ? .white : NeoGymTheme.primaryText)
            .frame(minWidth: 72, minHeight: 52)
            .padding(.horizontal, NeoGymTheme.spacingXXS)
            .padding(.vertical, NeoGymTheme.spacingXXS)
            .background(itemBackground)
            .overlay(alignment: .bottom) {
                Capsule(style: .continuous)
                    .fill(isSelected ? Color.white.opacity(0.92) : Color.clear)
                    .frame(width: 18, height: 3)
                    .offset(y: -4)
            }
            .contentShape(RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(destination.title)
        .accessibilityValue(isSelected ? "Selected" : "")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var itemBackground: some View {
        if isSelected {
            RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous)
                .fill(NeoGymTheme.primaryActionGradient)
                .overlay(
                    RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous)
                        .stroke(Color.white.opacity(0.32), lineWidth: NeoGymTheme.hairline)
                )
        } else {
            RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous)
                .fill(NeoGymTheme.glassSubtleFill)
                .overlay(
                    RoundedRectangle(cornerRadius: NeoGymTheme.radiusLG, style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
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
