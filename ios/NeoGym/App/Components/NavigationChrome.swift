import SwiftUI

extension View {
    /// Temporary source-compatible alias while pushed screens migrate to typed
    /// navigation and route-local bottom actions.
    func hidesBottomTabBarWhenPushed() -> some View {
        toolbar(.hidden, for: .tabBar)
    }
}
