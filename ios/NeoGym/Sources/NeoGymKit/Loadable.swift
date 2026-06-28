import Foundation

public enum Loadable<Value: Sendable>: Sendable {
    case idle
    case loading(previous: Value? = nil)
    case loaded(Value)
    case failed(message: String, previous: Value? = nil)

    public var value: Value? {
        switch self {
        case .idle:
            return nil
        case let .loading(previous):
            return previous
        case let .loaded(value):
            return value
        case let .failed(_, previous):
            return previous
        }
    }

    public var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    public var errorMessage: String? {
        if case let .failed(message, _) = self { return message }
        return nil
    }

    public func map<NewValue: Sendable>(_ transform: (Value) -> NewValue) -> Loadable<NewValue> {
        switch self {
        case .idle:
            return .idle
        case let .loading(previous):
            return .loading(previous: previous.map(transform))
        case let .loaded(value):
            return .loaded(transform(value))
        case let .failed(message, previous):
            return .failed(message: message, previous: previous.map(transform))
        }
    }
}

extension Loadable: Equatable where Value: Equatable {}
