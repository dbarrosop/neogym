import Foundation
import NeoGymKit
import Nhost

/// Lightweight fixtures used by SwiftUI previews for redesigned app-only screens.
enum NeoGymPreviewFixtures {
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
                    id: "user-1",
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

struct NeoGymPreviewAuthService: AuthServicing {
    func getUserSession() async throws -> StoredSession? { nil }

    func subscribeToSessionChanges(
        _ handler: @escaping @Sendable (StoredSession?) async -> Void
    ) async -> AuthSessionSubscription {
        AuthSessionSubscription {}
    }

    func requestSignInOTP(email: String) async throws {}
    func requestSignUpOTP(email: String, displayName: String) async throws {}
    func verifySignInOTP(email: String, otp: String) async throws -> StoredSession? { NeoGymPreviewFixtures.session }
    func requestEmailChange(newEmail: String, redirectTo: String, codeChallenge: String) async throws {}
    func exchangeToken(code: String, codeVerifier: String) async throws -> StoredSession? { NeoGymPreviewFixtures.session }
    func signOut(refreshToken: String?) async throws {}
    func clearSession() async throws {}
}

struct PreviewWorkoutsRepository: WorkoutsRepositoryProtocol {
    func listWorkouts() async throws -> WorkoutIndexPayload {
        WorkoutIndexPayload(workouts: previewWorkouts, labels: previewLabels)
    }

    func workoutDetail(id: String) async throws -> WorkoutDetailModel? {
        WorkoutDetailModel(
            id: id,
            name: previewWorkouts.first { $0.id == id }?.name ?? "Strength foundation",
            description: "Preview routine for glass list and detail chrome.",
            isPublic: false,
            userId: "user-1",
            workoutExercises: [
                WorkoutExerciseRow(
                    id: "row-1",
                    position: 1,
                    exercise: WorkoutExerciseListExercise(
                        id: "exercise-1",
                        name: "Goblet squat",
                        strength: ExerciseStrengthSummary(doubleWeight: false),
                        primaryMuscleGroup: "quadriceps"
                    )
                )
            ],
            workoutLabels: [WorkoutLabelLink(labelId: "label-1", label: previewLabels[0])]
        )
    }

    func editWorkout(id: String) async throws -> WorkoutEditPayload {
        WorkoutEditPayload(workout: try await workoutDetail(id: id), labels: previewLabels)
    }

    func labels() async throws -> [WorkoutLabel] { previewLabels }
    func createWorkout(_ values: WorkoutFormValues) async throws -> String { "workout-new" }
    func saveWorkout(id: String, initialValues: WorkoutFormValues, values: WorkoutFormValues) async throws {}
    func deleteWorkout(id: String) async throws {}
    func startSession(from workout: WorkoutDetailModel, startedAt: Date) async throws -> String { "session-preview" }

    private var previewLabels: [WorkoutLabel] {
        [
            WorkoutLabel(id: "label-1", name: "strength"),
            WorkoutLabel(id: "label-2", name: "travel")
        ]
    }

    private var previewWorkouts: [WorkoutListItem] {
        [
            WorkoutListItem(
                id: "workout-1",
                name: "Strength foundation",
                description: "A compact lower-body and push session.",
                isPublic: false,
                workoutExercisesAggregate: WorkoutExerciseCountAggregate(
                    aggregate: WorkoutExerciseCountAggregate.Aggregate(count: 5)
                ),
                workoutLabels: [WorkoutLabelLink(labelId: "label-1", label: previewLabels[0])]
            ),
            WorkoutListItem(
                id: "workout-2",
                name: "Hotel gym reset",
                description: "Public template with minimal equipment.",
                isPublic: true,
                workoutExercisesAggregate: WorkoutExerciseCountAggregate(
                    aggregate: WorkoutExerciseCountAggregate.Aggregate(count: 4)
                ),
                workoutLabels: [WorkoutLabelLink(labelId: "label-2", label: previewLabels[1])]
            )
        ]
    }
}

struct PreviewExercisesRepository: ExercisesRepositoryProtocol {
    func listExercises() async throws -> [ExerciseListItem] { previewExercises }
    func exerciseDetail(id: String) async throws -> ExerciseDetailModel? { nil }
    func exercisePickerExercises() async throws -> [ExerciseListItem] { previewExercises }
    func priorSessionsPerExercise(exerciseIds: [String]) async throws -> [ExercisePriorSessions] { [] }
    func startAdHocSession(exerciseId: String, startedAt: Date) async throws -> String { "session-preview" }

    private var previewExercises: [ExerciseListItem] {
        [
            ExerciseListItem(
                id: "exercise-1",
                name: "Goblet squat",
                strength: ExerciseStrengthSummary(doubleWeight: false),
                primaryMuscleGroup: "quadriceps",
                category: "strength",
                equipment: "kettlebell",
                level: "beginner",
                isPublic: true
            ),
            ExerciseListItem(
                id: "exercise-2",
                name: "Incline walk",
                primaryMuscleGroup: "cardiovascular system",
                category: "cardio",
                equipment: "treadmill",
                level: "beginner",
                isPublic: true
            )
        ]
    }
}
