import NeoGymKit
import Nhost
import SwiftUI
import UIKit

enum AppDestination: String, CaseIterable, Identifiable {
    case workouts
    case nutrition
    case me

    var id: String { rawValue }

    var title: String {
        switch self {
        case .workouts: "Workouts"
        case .nutrition: "Nutrition"
        case .me: "Me"
        }
    }

    var icon: String {
        switch self {
        case .workouts: "figure.strengthtraining.traditional"
        case .nutrition: "fork.knife"
        case .me: "person.crop.circle"
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
                    VStack(spacing: 0) {
                        Color.clear.frame(height: NeoGymTheme.dockContentExtraInset)
                        AppDestinationDock(selection: $selection)
                    }
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
            WorkoutsSectionNavigationView(
                workoutsRepository: WorkoutsRepository(graphQL: environment.graphQLService),
                sessionsRepository: SessionsRepository(graphQL: environment.graphQLService),
                exercisesRepository: ExercisesRepository(graphQL: environment.graphQLService),
                storageBaseURL: environment.client.serviceURLs.storage,
                currentUserId: session.user?.id,
                pendingSessionId: $pendingSessionId
            )
        case .nutrition:
            NutritionNavigationView(
                repository: NutritionFoodMealRepository(graphQL: environment.graphQLService),
                currentUserId: session.user?.id
            )
        case .me:
            MeNavigationView(
                session: session,
                bodyRepository: BodyMeasurementsRepository(graphQL: environment.graphQLService),
                journalRepository: JournalRepository(graphQL: environment.graphQLService),
                isSigningOut: isSigningOut,
                changeEmailModel: changeEmailModel,
                signOut: signOut
            )
        }
    }
}

private struct AppDestinationDock: View {
    @Binding var selection: AppDestination

    var body: some View {
        HStack(spacing: 3) {
            ForEach(AppDestination.allCases) { destination in
                AppDestinationDockItem(
                    destination: destination,
                    isSelected: selection == destination
                ) {
                    selection = destination
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(4)
        .frame(maxWidth: .infinity)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusXL,
            material: .regular,
            tint: NeoGymTheme.glassFallbackFill,
            stroke: NeoGymTheme.glassStroke,
            shadow: true
        )
        .padding(.horizontal, 10)
        .padding(.top, 2)
        .padding(.bottom, 0)
        .offset(y: 7)
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityElement(children: .contain)
    }
}

private struct AppDestinationDockItem: View {
    let destination: AppDestination
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: destination.icon)
                    .font(.subheadline.weight(.semibold))
                    .imageScale(.medium)
                    .frame(height: 17)

                Text(destination.title)
                    .font(.system(size: 8.5, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .foregroundColor(isSelected ? .white : NeoGymTheme.primaryText)
            .frame(maxWidth: .infinity, minHeight: 42)
            .padding(.horizontal, 1)
            .padding(.vertical, 2)
            .background(itemBackground)
            .overlay(alignment: .bottom) {
                Capsule(style: .continuous)
                    .fill(isSelected ? Color.white.opacity(0.92) : Color.clear)
                    .frame(width: 14, height: 2)
                    .offset(y: -3)
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

#Preview {
    AppShellView(
        session: NeoGymPreviewFixtures.session,
        environment: NhostClientFactory.makeEnvironment(),
        isSigningOut: false,
        changeEmailModel: nil,
        signOut: {}
    )
}
