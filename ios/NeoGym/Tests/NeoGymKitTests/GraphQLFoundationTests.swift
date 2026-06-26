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
