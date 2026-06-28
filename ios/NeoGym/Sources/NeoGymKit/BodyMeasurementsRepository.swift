import Foundation

public protocol BodyMeasurementsRepositoryProtocol: Sendable {
    func listMeasurements() async throws -> [BodyMeasurement]
    func measurement(id: String) async throws -> BodyMeasurement?
    func editMeasurement(id: String) async throws -> BodyMeasurement?
    func createMeasurement(_ values: BodyMeasurementFormValues) async throws -> String
    func updateMeasurement(id: String, values: BodyMeasurementFormValues) async throws
    func deleteMeasurement(id: String) async throws
}

public struct BodyMeasurementsRepository: BodyMeasurementsRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listMeasurements() async throws -> [BodyMeasurement] {
        let data: BodyMeasurementsData = try await graphQL.execute(
            query: Self.bodyMeasurementsQuery,
            operationName: "BodyMeasurements"
        )
        return data.bodyMeasurements
    }

    public func measurement(id: String) async throws -> BodyMeasurement? {
        let data: BodyMeasurementByIdData = try await graphQL.execute(
            query: Self.bodyMeasurementByIdQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "BodyMeasurementById"
        )
        return data.bodyMeasurement
    }

    public func editMeasurement(id: String) async throws -> BodyMeasurement? {
        let data: EditBodyMeasurementData = try await graphQL.execute(
            query: Self.editBodyMeasurementQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditBodyMeasurement"
        )
        return data.bodyMeasurement
    }

    public func createMeasurement(_ values: BodyMeasurementFormValues) async throws -> String {
        let data: InsertBodyMeasurementData = try await graphQL.execute(
            query: Self.insertBodyMeasurementMutation,
            variables: ["obj": Self.measurementObject(values)],
            operationName: "InsertBodyMeasurement"
        )
        guard let id = data.insertBodyMeasurement?.id else {
            throw GraphQLDomainError.missingData(operationName: "InsertBodyMeasurement")
        }
        return id
    }

    public func updateMeasurement(id: String, values: BodyMeasurementFormValues) async throws {
        let _: UpdateBodyMeasurementData = try await graphQL.execute(
            query: Self.updateBodyMeasurementMutation,
            variables: [
                "id": GraphQLScalars.uuid(id),
                "set": Self.measurementObject(values)
            ],
            operationName: "UpdateBodyMeasurement"
        )
    }

    public func deleteMeasurement(id: String) async throws {
        let _: DeleteBodyMeasurementData = try await graphQL.execute(
            query: Self.deleteBodyMeasurementMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteBodyMeasurement"
        )
    }

    public static func measurementObject(_ values: BodyMeasurementFormValues) -> JSONValue {
        .object([
            "measuredOn": GraphQLScalars.date(values.measuredOn),
            "weightKg": values.weightKg.isEmpty ? .null : .string(values.weightKg),
            "bodyFatPct": values.bodyFatPct.isEmpty ? .null : .string(values.bodyFatPct),
            "notes": values.notes.isEmpty ? .null : .string(values.notes)
        ])
    }
}

private struct BodyMeasurementsData: Decodable, Sendable {
    let bodyMeasurements: [BodyMeasurement]
}

private struct BodyMeasurementByIdData: Decodable, Sendable {
    let bodyMeasurement: BodyMeasurement?
}

private struct EditBodyMeasurementData: Decodable, Sendable {
    let bodyMeasurement: BodyMeasurement?
}

private struct InsertBodyMeasurementData: Decodable, Sendable {
    let insertBodyMeasurement: MutationIdPayload?
}

private struct UpdateBodyMeasurementData: Decodable, Sendable {
    let updateBodyMeasurement: MutationIdPayload?
}

private struct DeleteBodyMeasurementData: Decodable, Sendable {
    let deleteBodyMeasurement: MutationIdPayload?
}

private struct MutationIdPayload: Decodable, Sendable {
    let id: String
}

public extension BodyMeasurementsRepository {
    static let bodyMeasurementsQuery = """
    query BodyMeasurements {
      bodyMeasurements(order_by: { measuredOn: desc }) {
        id
        measuredOn
        weightKg
        bodyFatPct
        notes
      }
    }
    """

    static let bodyMeasurementByIdQuery = """
    query BodyMeasurementById($id: uuid!) {
      bodyMeasurement(id: $id) {
        id
        measuredOn
        weightKg
        bodyFatPct
        notes
        updatedAt
      }
    }
    """

    static let editBodyMeasurementQuery = """
    query EditBodyMeasurement($id: uuid!) {
      bodyMeasurement(id: $id) {
        id
        measuredOn
        weightKg
        bodyFatPct
        notes
      }
    }
    """

    static let insertBodyMeasurementMutation = """
    mutation InsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {
      insertBodyMeasurement(object: $obj) {
        id
      }
    }
    """

    static let updateBodyMeasurementMutation = """
    mutation UpdateBodyMeasurement($id: uuid!, $set: bodyMeasurements_set_input!) {
      updateBodyMeasurement(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let deleteBodyMeasurementMutation = """
    mutation DeleteBodyMeasurement($id: uuid!) {
      deleteBodyMeasurement(id: $id) {
        id
      }
    }
    """
}
