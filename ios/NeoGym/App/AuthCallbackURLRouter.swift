import Foundation

@MainActor
final class AuthCallbackURLRouter: ObservableObject {
    @Published private(set) var pendingURL: URL?

    func open(_ url: URL) {
        pendingURL = url
    }

    func consume(_ url: URL) {
        guard pendingURL == url else { return }
        pendingURL = nil
    }
}
