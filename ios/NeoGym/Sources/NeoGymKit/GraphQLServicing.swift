import Foundation
import Nhost

public enum GraphQLQueryEmission<Value: Sendable>: Sendable {
    case cached(Value)
    case fresh(Value)

    public var value: Value {
        switch self {
        case let .cached(value), let .fresh(value): value
        }
    }

    public func map<Transformed: Sendable>(
        _ transform: @Sendable (Value) -> Transformed
    ) -> GraphQLQueryEmission<Transformed> {
        switch self {
        case let .cached(value): .cached(transform(value))
        case let .fresh(value): .fresh(transform(value))
        }
    }
}

public protocol GraphQLServicing: Sendable {
    func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        query: String,
        variables: [String: JSONValue]?,
        operationName: String?
    ) async throws -> ResponseData

    func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        query: String,
        variables: [String: JSONValue]?,
        operationName: String?,
        namespace: String,
        tags: Set<String>
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error>
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

    func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        namespace: String,
        tags: Set<String> = []
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
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

    func cachedEmissions<ResponseData: Decodable & Sendable, Value: Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        namespace: String,
        tags: Set<String> = [],
        transform: @escaping @Sendable (ResponseData) -> Value
    ) -> AsyncThrowingStream<GraphQLQueryEmission<Value>, Error> {
        let updates = cachedQuery(
            responseType,
            query: query,
            variables: variables,
            operationName: operationName,
            namespace: namespace,
            tags: tags
        )
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await update in updates {
                        continuation.yield(update.map(transform))
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }

    func cachedValues<ResponseData: Decodable & Sendable, Value: Sendable>(
        _ responseType: ResponseData.Type = ResponseData.self,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        namespace: String,
        tags: Set<String> = [],
        transform: @escaping @Sendable (ResponseData) -> Value
    ) -> AsyncThrowingStream<Value, Error> {
        let updates = cachedEmissions(
            responseType,
            query: query,
            variables: variables,
            operationName: operationName,
            namespace: namespace,
            tags: tags,
            transform: transform
        )
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await update in updates {
                        continuation.yield(update.value)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }
}

public func singleValueUpdates<Value: Sendable>(
    _ operation: @escaping @Sendable () async throws -> Value
) -> AsyncThrowingStream<Value, Error> {
    AsyncThrowingStream { continuation in
        let task = Task {
            do {
                continuation.yield(try await operation())
                continuation.finish()
            } catch {
                continuation.finish(throwing: error)
            }
        }
        continuation.onTermination = { @Sendable _ in task.cancel() }
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
