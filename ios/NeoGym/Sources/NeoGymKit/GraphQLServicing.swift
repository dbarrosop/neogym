import Foundation
import Nhost

public protocol GraphQLServicing: Sendable {
    func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        query: String,
        variables: [String: JSONValue]?,
        operationName: String?
    ) async throws -> ResponseData
}

public extension GraphQLServicing {
    func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil
    ) async throws -> ResponseData {
        try await execute(responseType, query: query, variables: variables, operationName: operationName)
    }
}

public enum GraphQLResponseMapper {
    public static func unwrap<ResponseData: Decodable & Sendable>(
        _ response: GraphQLResponse<ResponseData>,
        operationName: String? = nil
    ) throws -> ResponseData {
        if let errors = response.errors, !errors.isEmpty {
            throw GraphQLDomainError.graphQLErrors(errors.map(GraphQLErrorDetail.init(error:)))
        }

        guard let data = response.data else {
            throw GraphQLDomainError.missingData(operationName: operationName)
        }

        return data
    }
}
