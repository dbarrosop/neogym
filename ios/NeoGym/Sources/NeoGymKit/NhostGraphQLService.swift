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

    public func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        namespace: String,
        tags: Set<String> = []
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error> {
        let cacheOptions = GraphQLCacheRequestOptions(
            policy: .cacheFirst,
            namespace: namespace,
            tags: tags
        )
        return AsyncThrowingStream { continuation in
            let task = Task {
                var emittedCachedValue = false
                let updates = client.graphql.staleWhileRevalidate(
                    responseType,
                    query: query,
                    variables: variables,
                    operationName: operationName,
                    cacheOptions: cacheOptions
                )
                do {
                    for try await update in updates {
                        switch update {
                        case let .cached(response, _):
                            do {
                                let value = try GraphQLResponseMapper.unwrap(
                                    response.body,
                                    operationName: operationName
                                )
                                emittedCachedValue = true
                                continuation.yield(.cached(value))
                            } catch {
                                // Treat a malformed or GraphQL-error cache entry as a miss so
                                // the in-flight network revalidation can repair it.
                                continue
                            }
                        case let .fresh(response, _):
                            continuation.yield(.fresh(try GraphQLResponseMapper.unwrap(
                                response.body,
                                operationName: operationName
                            )))
                        }
                    }
                    continuation.finish()
                } catch let error as CancellationError {
                    continuation.finish(throwing: error)
                } catch let error as FetchError where emittedCachedValue && error.isTransportFailure {
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: GraphQLDomainError.map(error))
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }
}

private extension FetchError {
    var isTransportFailure: Bool {
        if case .transport = self { return true }
        return false
    }
}
