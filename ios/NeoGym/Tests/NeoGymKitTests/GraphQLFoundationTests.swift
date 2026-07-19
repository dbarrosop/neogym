import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

final class GraphQLResponseMapperTests: XCTestCase {
    func testUnwrapReturnsNonOptionalData() throws {
        let response = GraphQLResponse(data: ViewerData(viewer: Viewer(id: "user-id")))

        let data = try GraphQLResponseMapper.unwrap(response, operationName: "Viewer")

        XCTAssertEqual(data.viewer.id, "user-id")
    }

    func testUnwrapMapsMissingData() {
        let response = GraphQLResponse<ViewerData>(data: nil)

        XCTAssertThrowsError(try GraphQLResponseMapper.unwrap(response, operationName: "Viewer")) { error in
            XCTAssertEqual(error as? GraphQLDomainError, .missingData(operationName: "Viewer"))
        }
    }

    func testUnwrapPreservesGraphQLErrorCodeAndConstraint() {
        let response = GraphQLResponse<ViewerData>(
            data: nil,
            errors: [constraintGraphQLError]
        )

        XCTAssertThrowsError(
            try GraphQLResponseMapper.unwrap(response, operationName: "InsertBodyMeasurement")
        ) { error in
            guard case let .graphQLErrors(details) = error as? GraphQLDomainError else {
                return XCTFail("Expected GraphQLDomainError.graphQLErrors, got \(error)")
            }

            XCTAssertEqual(details.map(\.message), ["Uniqueness violation"])
            XCTAssertEqual(details.map(\.code), ["constraint-violation"])
            XCTAssertEqual(details.map(\.constraintName), ["body_measurements_user_id_measured_on_key"])
        }
    }

    func testMapsExecutionErrorsToDomainErrors() {
        let executionError = GraphQLExecutionError(
            errors: [constraintGraphQLError],
            status: 200,
            headers: [:],
            rawBody: Data()
        )

        let domainError = GraphQLDomainError.map(executionError)

        XCTAssertEqual(
            domainError,
            .graphQLErrors([
                GraphQLErrorDetail(
                    message: "Uniqueness violation",
                    code: "constraint-violation",
                    constraintName: "body_measurements_user_id_measured_on_key",
                    extensions: constraintGraphQLError.extensions
                )
            ])
        )
    }
}

final class FakeGraphQLServiceTests: XCTestCase {
    func testFakeReturnsCannedSuccessAndRecordsRequest() async throws {
        let fake = FakeGraphQLService(
            replies: [
                .json(.object(["viewer": .object(["id": .string("user-id")])]))
            ]
        )
        let variables = GraphQLScalars.variables(
            ("id", GraphQLScalars.uuid("user-id")),
            ("includePrivate", .bool(true))
        )

        let data: ViewerData = try await fake.execute(
            query: "query Viewer($id: uuid!) { viewer { id } }",
            variables: variables,
            operationName: "Viewer"
        )

        XCTAssertEqual(data.viewer.id, "user-id")
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(
            requests,
            [
                GraphQLRequestRecord(
                    query: "query Viewer($id: uuid!) { viewer { id } }",
                    variables: variables,
                    operationName: "Viewer"
                )
            ]
        )
    }

    func testFakeMapsMissingData() async {
        let fake = FakeGraphQLService(replies: [.missingData])

        await XCTAssertThrowsErrorAsync(
            try await fake.execute(ViewerData.self, query: "query Viewer { viewer { id } }", operationName: "Viewer")
        ) { error in
            XCTAssertEqual(error as? GraphQLDomainError, .missingData(operationName: "Viewer"))
        }
    }

    func testFakeMapsGraphQLErrors() async {
        let fake = FakeGraphQLService(replies: [.graphQLErrors([constraintGraphQLError])])

        await XCTAssertThrowsErrorAsync(
            try await fake.execute(ViewerData.self, query: "mutation Insert { insert { id } }")
        ) { error in
            guard case let .graphQLErrors(details) = error as? GraphQLDomainError else {
                return XCTFail("Expected GraphQLDomainError.graphQLErrors, got \(error)")
            }

            XCTAssertEqual(details.first?.code, "constraint-violation")
            XCTAssertEqual(details.first?.constraintName, "body_measurements_user_id_measured_on_key")
        }
    }

    func testFakeMapsDecodingFailures() async {
        let fake = FakeGraphQLService(replies: [.json(.object(["viewer": .object(["id": .number(42)])]))])

        await XCTAssertThrowsErrorAsync(
            try await fake.execute(ViewerData.self, query: "query Viewer { viewer { id } }")
        ) { error in
            guard case .decoding = error as? GraphQLDomainError else {
                return XCTFail("Expected decoding error, got \(error)")
            }
        }
    }

    func testDisplayDetailRepositoriesUseCachedQueries() async {
        let fake = FakeGraphQLService(
            replies: Array(repeating: FakeGraphQLReply.missingData, count: 9)
        )

        await consumeIgnoringFailure(WorkoutsRepository(graphQL: fake).workoutDetailUpdates(id: "workout"))
        await consumeIgnoringFailure(SessionsRepository(graphQL: fake).sessionDetailUpdates(id: "session"))
        await consumeIgnoringFailure(ExercisesRepository(graphQL: fake).exerciseDetailUpdates(id: "exercise"))
        await consumeIgnoringFailure(JournalRepository(graphQL: fake).entryUpdates(id: "journal"))
        let nutrition = NutritionFoodMealRepository(graphQL: fake)
        await consumeIgnoringFailure(nutrition.foodUpdates(id: "food"))
        await consumeIgnoringFailure(nutrition.mealUpdates(id: "meal"))
        await consumeIgnoringFailure(nutrition.nutritionPlanUpdates(id: "plan"))
        await consumeIgnoringFailure(BodyMeasurementsRepository(graphQL: fake).measurementUpdates(id: "body"))
        await consumeIgnoringFailure(DailyEnergyRepository(graphQL: fake).entryUpdates(id: "energy"))

        let cachedRequests = await fake.cachedRequestsSnapshot()
        XCTAssertEqual(cachedRequests.map(\.request.operationName), [
            "WorkoutDetail",
            "SessionDetail",
            "ExerciseDetail",
            "JournalEntryById",
            "FoodDetail",
            "MealDetail",
            "NutritionPlanDetail",
            "BodyMeasurementById",
            "DailyEnergyById"
        ])
        XCTAssertEqual(cachedRequests.map(\.namespace), [
            "workouts",
            "sessions",
            "exercises",
            "journal",
            "foods",
            "meals",
            "nutrition-plans",
            "body-measurements",
            "daily-energy"
        ])
    }
}

final class NhostGraphQLCacheAdapterTests: XCTestCase {
    func testCachedQueryKeepsCachedValueWhenOfflineRefreshFails() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("neogym-cache-test-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let transportState = CacheTestTransportState()
        let service = try makeService(directory: directory, transportState: transportState)

        var firstSources: [GraphQLCacheSource] = []
        for try await update in service.cachedQuery(
            ViewerData.self,
            query: "query Viewer { viewer { id } }",
            operationName: "Viewer",
            namespace: "viewer",
            tags: ["viewer"]
        ) {
            switch update {
            case .cached: firstSources.append(.cached)
            case .fresh: firstSources.append(.fresh)
            }
        }
        XCTAssertEqual(firstSources, [.fresh])

        await transportState.setOffline(true)
        var offlineValues: [ViewerData] = []
        for try await update in service.cachedQuery(
            ViewerData.self,
            query: "query Viewer { viewer { id } }",
            operationName: "Viewer",
            namespace: "viewer",
            tags: ["viewer"]
        ) {
            offlineValues.append(update.value)
        }

        XCTAssertEqual(offlineValues, [ViewerData(viewer: Viewer(id: "cached-user"))])
    }

    func testCachedGraphQLErrorDoesNotBlockFreshRepair() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("neogym-cache-test-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let transportState = CacheTestTransportState()
        let service = try makeService(directory: directory, transportState: transportState)
        await transportState.setBody(Data(#"{"errors":[{"message":"temporary"}]}"#.utf8))

        do {
            for try await _ in service.cachedQuery(
                ViewerData.self,
                query: "query Viewer { viewer { id } }",
                operationName: "Viewer",
                namespace: "viewer",
                tags: ["viewer"]
            ) {}
            XCTFail("Expected the fresh GraphQL error")
        } catch {
            guard case .graphQLErrors = error as? GraphQLDomainError else {
                return XCTFail("Expected GraphQL errors, got \(error)")
            }
        }

        await transportState.setBody(Data(#"{"data":{"viewer":{"id":"repaired-user"}}}"#.utf8))
        var repairedSources: [GraphQLCacheSource] = []
        var repairedValues: [ViewerData] = []
        for try await update in service.cachedQuery(
            ViewerData.self,
            query: "query Viewer { viewer { id } }",
            operationName: "Viewer",
            namespace: "viewer",
            tags: ["viewer"]
        ) {
            repairedValues.append(update.value)
            switch update {
            case .cached: repairedSources.append(.cached)
            case .fresh: repairedSources.append(.fresh)
            }
        }

        XCTAssertEqual(repairedSources, [.fresh])
        XCTAssertEqual(repairedValues, [ViewerData(viewer: Viewer(id: "repaired-user"))])
    }

    func testNutritionOverviewTracksWhetherLoadReachedFreshData() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("neogym-cache-test-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let transportState = CacheTestTransportState()
        await transportState.setBody(Data(#"{"data":{"nutritionDays":[],"dailyEnergyEntries":[]}}"#.utf8))
        let service = try makeService(directory: directory, transportState: transportState)
        let viewModel = await NutritionDaysListViewModel(
            repository: NutritionFoodMealRepository(graphQL: service)
        )

        await viewModel.load()
        let firstLoadWasFresh = await viewModel.lastLoadIncludedFreshData
        XCTAssertTrue(firstLoadWasFresh)

        await transportState.setOffline(true)
        await viewModel.load()
        let offlineLoadWasFresh = await viewModel.lastLoadIncludedFreshData
        XCTAssertFalse(offlineLoadWasFresh)
    }

    private func makeService(
        directory: URL,
        transportState: CacheTestTransportState
    ) throws -> NhostGraphQLService {
        let client = createNhostClient(NhostClientOptions(
            graphqlURL: try XCTUnwrap(URL(string: "https://example.test/v1/graphql")),
            transport: StubTransport { request in
                try await transportState.fetch(request)
            },
            graphqlCache: GraphQLCacheConfiguration(directoryURL: directory)
        ))
        return NhostGraphQLService(client: client)
    }
}

final class GraphQLScalarsTests: XCTestCase {
    func testScalarHelpersFormatGraphQLVariables() throws {
        let uuid = try XCTUnwrap(UUID(uuidString: "A7D4E68C-77B3-4A15-9B77-68BB9718A18A"))
        let date = Date(timeIntervalSince1970: 1_700_000_000.123)
        let json = JSONValue.object(["distance": .number(5.5), "unit": .string("km")])

        XCTAssertEqual(GraphQLScalars.uuid(uuid), .string("a7d4e68c-77b3-4a15-9b77-68bb9718a18a"))
        XCTAssertEqual(GraphQLScalars.date(date), .string("2023-11-14"))
        XCTAssertEqual(GraphQLScalars.time(date), .string("22:13:20"))
        XCTAssertEqual(GraphQLScalars.timestamptz(date), .string("2023-11-14T22:13:20.123Z"))
        XCTAssertEqual(GraphQLScalars.numeric(Decimal(string: "12.50")!), .string("12.5"))
        XCTAssertEqual(GraphQLScalars.jsonb(json), json)
    }

    func testVariablesOmitNilValuesAndKeepJSONValueShapes() {
        let variables = GraphQLScalars.variables(
            ("required", .string("value")),
            ("optional", nil),
            ("payload", .object(["ok": .bool(true)]))
        )

        XCTAssertEqual(variables["required"], .string("value"))
        XCTAssertNil(variables["optional"])
        XCTAssertEqual(variables["payload"]?.objectValue?["ok"], .bool(true))
    }
}

final class LoadableTests: XCTestCase {
    func testLoadableExposesStateAndMapsValues() {
        let loaded = Loadable.loaded(["a", "b"])
        let loading = Loadable<[String]>.loading(previous: ["old"])
        let failed = Loadable<[String]>.failed(message: "Network error", previous: ["cached"])

        XCTAssertEqual(loaded.value, ["a", "b"])
        XCTAssertTrue(loading.isLoading)
        XCTAssertEqual(loading.value, ["old"])
        XCTAssertEqual(failed.errorMessage, "Network error")
        XCTAssertEqual(failed.map(\.count), .failed(message: "Network error", previous: 1))
    }
}

private actor CacheTestTransportState {
    private var isOffline = false
    private var body = Data(#"{"data":{"viewer":{"id":"cached-user"}}}"#.utf8)

    func setOffline(_ value: Bool) {
        isOffline = value
    }

    func setBody(_ value: Data) {
        body = value
    }

    func fetch(_ request: NhostRequest) throws -> NhostRawResponse {
        if isOffline {
            throw FetchError.transport("URLError -1009: offline")
        }
        return NhostRawResponse(
            status: 200,
            headers: ["content-type": "application/json"],
            body: body
        )
    }
}

private struct ViewerData: Decodable, Equatable, Sendable {
    let viewer: Viewer
}

private struct Viewer: Decodable, Equatable, Sendable {
    let id: String
}

private let constraintGraphQLError = GraphQLError(
    message: "Uniqueness violation",
    extensions: [
        "code": .string("constraint-violation"),
        "internal": .object([
            "error": .object([
                "constraint": .string("body_measurements_user_id_measured_on_key")
            ])
        ])
    ]
)

private func consumeIgnoringFailure<Value: Sendable>(
    _ updates: AsyncThrowingStream<Value, Error>
) async {
    do {
        for try await _ in updates {}
    } catch {}
}

private func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ errorHandler: (any Error) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("Expected error to be thrown", file: file, line: line)
    } catch {
        errorHandler(error)
    }
}
