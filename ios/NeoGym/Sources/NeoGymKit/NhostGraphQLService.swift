import Foundation
import Nhost

public struct NhostGraphQLService: GraphQLServicing {
    public let client: NhostClient

    public init(client: NhostClient) {
        self.client = client
    }

    public func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil
    ) async throws -> ResponseData {
        do {
            let response = try await client.graphql.request(
                responseType,
                query: query,
                variables: variables,
                operationName: operationName
            )

            return try GraphQLResponseMapper.unwrap(response.body, operationName: operationName)
        } catch let error as CancellationError {
            throw error
        } catch {
            throw GraphQLDomainError.map(error)
        }
    }
}
