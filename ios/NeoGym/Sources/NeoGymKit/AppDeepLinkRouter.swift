import Combine
import Foundation

/// Holds the latest widget or Live Activity destination until the signed-in
/// shell can take it, including after a cold launch.
@MainActor
public final class AppDeepLinkRouter: ObservableObject {
    @Published public private(set) var pending: AppDeepLink?

    /// One stable stream, deferred past @Published's willSet so taking an
    /// emitted link sees the stored value. Subscribe again safely after a render.
    public private(set) lazy var pendingLinks: AnyPublisher<AppDeepLink?, Never> = $pending
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()

    public init() {}

    public func open(_ link: AppDeepLink) {
        pending = link
    }

    /// Claim before navigating: stale or duplicate deliveries must do nothing.
    public func take(_ link: AppDeepLink) -> Bool {
        guard pending == link else { return false }
        pending = nil
        return true
    }
}
