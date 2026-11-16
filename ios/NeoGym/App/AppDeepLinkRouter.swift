import Combine
import Foundation
import NeoGymKit

/// Widget and Live Activity navigation links (`neogym://today`, `neogym://session/<id>`),
/// held until the signed-in shell can apply them, including after a cold launch.
@MainActor
final class AppDeepLinkRouter: ObservableObject {
    @Published private(set) var pending: AppDeepLink?

    func open(_ link: AppDeepLink) {
        pending = link
    }

    func consume(_ link: AppDeepLink) {
        guard pending == link else { return }
        pending = nil
    }
}
