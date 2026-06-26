import Foundation
import Nhost

public struct GraphQLErrorDetail: Equatable, Sendable {
    public let message: String
    public let code: String?
    public let constraintName: String?
    public let extensions: [String: JSONValue]?

    public init(
        message: String,
        code: String? = nil,
        constraintName: String? = nil,
        extensions: [String: JSONValue]? = nil
    ) {
        self.message = message
        self.code = code
        self.constraintName = constraintName
        self.extensions = extensions
    }

    public init(error: GraphQLError) {
        self.init(
            message: error.message,
            code: error.extensions?["code"]?.stringValue,
            constraintName: Self.findConstraintName(in: error.extensions),
            extensions: error.extensions
        )
    }

    private static func findConstraintName(in extensions: [String: JSONValue]?) -> String? {
        guard let extensions else { return nil }
        return findConstraintName(in: .object(extensions))
    }

    private static func findConstraintName(in value: JSONValue) -> String? {
        switch value {
        case let .object(object):
            for key in ["constraint", "constraint_name", "constraintName"] {
                if let constraint = object[key]?.stringValue, !constraint.isEmpty {
                    return constraint
                }
            }

            for child in object.values {
                if let constraint = findConstraintName(in: child) {
                    return constraint
                }
            }
        case let .array(values):
            for child in values {
                if let constraint = findConstraintName(in: child) {
                    return constraint
                }
            }
        case .null, .bool, .number, .string:
            return nil
        }

        return nil
    }
}

public enum GraphQLDomainError: Error, Equatable, Sendable {
    case graphQLErrors([GraphQLErrorDetail])
    case missingData(operationName: String?)
    case decoding(String)
    case transport(String)

    public static func map(_ error: Error) -> GraphQLDomainError {
        if let domainError = error as? GraphQLDomainError {
            return domainError
        }

        if let executionError = error as? GraphQLExecutionError {
            return .graphQLErrors(executionError.errors.map(GraphQLErrorDetail.init(error:)))
        }

        if let fetchError = error as? FetchError {
            switch fetchError {
            case let .decoding(message):
                return .decoding(message)
            case let .encoding(message), let .invalidResponse(message), let .transport(message):
                return .transport(message)
            case let .http(error):
                return .transport(error.messages.joined(separator: ", "))
            }
        }

        if let serviceError = error as? NhostServiceError, !serviceError.messages.isEmpty {
            return .transport(serviceError.messages.joined(separator: ", "))
        }

        return .transport(error.localizedDescription)
    }
}

extension GraphQLDomainError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case let .graphQLErrors(errors):
            return errors.map(\.message).joined(separator: ", ")
        case let .missingData(operationName):
            if let operationName, !operationName.isEmpty {
                return "GraphQL operation \(operationName) did not return data."
            }

            return "GraphQL operation did not return data."
        case let .decoding(message):
            return "GraphQL response could not be decoded: \(message)"
        case let .transport(message):
            return message
        }
    }
}
