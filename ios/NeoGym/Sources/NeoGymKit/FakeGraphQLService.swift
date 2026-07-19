import Foundation
import Nhost

public struct GraphQLRequestRecord: Equatable, Sendable {
    public let query: String
    public let variables: [String: JSONValue]?
    public let operationName: String?

    public init(query: String, variables: [String: JSONValue]? = nil, operationName: String? = nil) {
        self.query = query
        self.variables = variables
        self.operationName = operationName
    }
}

public struct GraphQLCachedRequestRecord: Equatable, Sendable {
    public let request: GraphQLRequestRecord
    public let namespace: String
    public let tags: Set<String>

    public init(request: GraphQLRequestRecord, namespace: String, tags: Set<String>) {
        self.request = request
        self.namespace = namespace
        self.tags = tags
    }
}

public enum FakeGraphQLReply: Sendable {
    case json(JSONValue)
    case data(Data)
    case graphQLErrors([GraphQLError])
    case missingData
    case failure(any Error)
}

public actor FakeGraphQLService: GraphQLServicing {
    private var replies: [FakeGraphQLReply]
    private var requests: [GraphQLRequestRecord]
    private var cachedRequests: [GraphQLCachedRequestRecord]
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(
        replies: [FakeGraphQLReply] = [],
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.replies = replies
        self.requests = []
        self.cachedRequests = []
        self.encoder = encoder
        self.decoder = decoder
    }

    public func enqueue(_ reply: FakeGraphQLReply) {
        replies.append(reply)
    }

    public func requestsSnapshot() -> [GraphQLRequestRecord] {
        requests
    }

    public func cachedRequestsSnapshot() -> [GraphQLCachedRequestRecord] {
        cachedRequests
    }

    public nonisolated func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        namespace: String,
        tags: Set<String> = []
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                await recordCachedRequest(
                    query: query,
                    variables: variables,
                    operationName: operationName,
                    namespace: namespace,
                    tags: tags
                )
                do {
                    let value: ResponseData = try await execute(
                        responseType,
                        query: query,
                        variables: variables,
                        operationName: operationName
                    )
                    continuation.yield(.fresh(value))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }

    public func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil
    ) async throws -> ResponseData {
        requests.append(GraphQLRequestRecord(query: query, variables: variables, operationName: operationName))

        guard !replies.isEmpty else {
            throw GraphQLDomainError.missingData(operationName: operationName)
        }

        let reply = replies.removeFirst()
        do {
            switch reply {
            case let .json(value):
                return try decode(responseType, from: encoder.encode(value))
            case let .data(data):
                return try decode(responseType, from: data)
            case let .graphQLErrors(errors):
                throw GraphQLDomainError.graphQLErrors(errors.map(GraphQLErrorDetail.init(error:)))
            case .missingData:
                throw GraphQLDomainError.missingData(operationName: operationName)
            case let .failure(error):
                throw GraphQLDomainError.map(error)
            }
        } catch let domainError as GraphQLDomainError {
            throw domainError
        } catch {
            throw GraphQLDomainError.decoding(String(describing: error))
        }
    }

    private func recordCachedRequest(
        query: String,
        variables: [String: JSONValue]?,
        operationName: String?,
        namespace: String,
        tags: Set<String>
    ) {
        cachedRequests.append(GraphQLCachedRequestRecord(
            request: GraphQLRequestRecord(
                query: query,
                variables: variables,
                operationName: operationName
            ),
            namespace: namespace,
            tags: tags
        ))
    }

    private func decode<ResponseData: Decodable>(
        _ responseType: ResponseData.Type,
        from data: Data
    ) throws -> ResponseData {
        do {
            return try decoder.decode(responseType, from: data)
        } catch {
            throw GraphQLDomainError.decoding(String(describing: error))
        }
    }
}
