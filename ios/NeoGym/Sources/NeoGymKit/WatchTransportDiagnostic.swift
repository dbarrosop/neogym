import Foundation
import Nhost

/// Allowlisted diagnostic categories. Raw error descriptions, hosts, request
/// paths and response bodies must never reach WatchEventStore or its export.
public enum WatchTransportKind: String, Codable, Sendable {
    case urlSession
    case http
    case service
    case invalidResponse
    case requestEncoding
    case sessionRefresh
    case unknown

    public var title: String {
        switch self {
        case .urlSession: "URLSession"
        case .http: "HTTP status"
        case .service: "Service"
        case .invalidResponse: "Invalid response"
        case .requestEncoding: "Request encoding"
        case .sessionRefresh: "Session refresh"
        case .unknown: "Unknown transport"
        }
    }
}

public struct WatchTransportDiagnostic: Equatable, Sendable {
    public let kind: WatchTransportKind
    /// URLSession error number or HTTP status, never an NSError bridge's enum
    /// case index or a code parsed from an arbitrary server message.
    public let code: Int?

    public init(kind: WatchTransportKind, code: Int? = nil) {
        self.kind = kind
        self.code = code
    }

    public static func classify(_ error: any Error) -> Self {
        if let urlError = error as? URLError {
            return .init(kind: .urlSession, code: urlError.code.rawValue)
        }
        if error is SessionRefreshError { return .init(kind: .sessionRefresh) }
        if let fetch = error as? FetchError {
            switch fetch {
            case let .http(response):
                return .init(kind: .http, code: response.status)
            case let .transport(message):
                // The pinned SDK's HTTPTransport formats a URLSession failure
                // as "URLError <numeric code>: <description>". Only take the
                // numeric prefix; never store or export the description.
                let prefix = "URLError "
                if message.hasPrefix(prefix), let colon = message.firstIndex(of: ":"),
                   let code = Int(message[message.index(message.startIndex, offsetBy: prefix.count)..<colon]),
                   (-3_000 ... -1).contains(code) {
                    return .init(kind: .urlSession, code: code)
                }
                return .init(kind: .unknown)
            case .invalidResponse, .decoding:
                return .init(kind: .invalidResponse)
            case .encoding:
                return .init(kind: .requestEncoding)
            }
        }
        if let service = error as? any NhostServiceError {
            return .init(kind: .service, code: service.statusCode)
        }
        return .init(kind: .unknown)
    }
}
