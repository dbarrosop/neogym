import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

extension View {
    @ViewBuilder
    func hidesBottomTabBarWhenPushed() -> some View {
        if #available(iOS 16.0, *) {
            toolbar(.hidden, for: .tabBar)
                .background(HidesBottomTabBarWhenPushedAccessor())
        } else {
            background(HidesBottomTabBarWhenPushedAccessor())
        }
    }
}

#if canImport(UIKit)
private struct HidesBottomTabBarWhenPushedAccessor: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> HidesBottomTabBarWhenPushedController {
        HidesBottomTabBarWhenPushedController()
    }

    func updateUIViewController(_ uiViewController: HidesBottomTabBarWhenPushedController, context: Context) {
        uiViewController.apply()
    }
}

private final class HidesBottomTabBarWhenPushedController: UIViewController {
    override func didMove(toParent parent: UIViewController?) {
        super.didMove(toParent: parent)
        apply()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        apply()
    }

    func apply() {
        var controller = parent
        while let current = controller {
            current.hidesBottomBarWhenPushed = true
            controller = current.parent
        }
    }
}
#else
private struct HidesBottomTabBarWhenPushedAccessor: View {
    var body: some View { EmptyView() }
}
#endif
