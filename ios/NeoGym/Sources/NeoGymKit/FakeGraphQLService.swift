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
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(
        replies: [FakeGraphQLReply] = [],
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.replies = replies
        self.requests = []
        self.encoder = encoder
        self.decoder = decoder
    }

    public func enqueue(_ reply: FakeGraphQLReply) {
        replies.append(reply)
    }

    public func requestsSnapshot() -> [GraphQLRequestRecord] {
        requests
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
