import Combine
import NeoGymKit
import XCTest

@MainActor
final class AppDeepLinkRouterTests: XCTestCase {
    func testColdLinkIsTakenOnceAndDoesNotReplayOnResubscription() async {
        let router = AppDeepLinkRouter()
        router.open(.today)
        var applied: [AppDeepLink] = []
        var subscription = subscribe(router) { applied.append($0) }
        await drainDeliveries()
        XCTAssertNil(router.pending)
        XCTAssertEqual(applied, [.today])

        subscription.cancel()
        subscription = subscribe(router) { applied.append($0) }
        await drainDeliveries()
        XCTAssertEqual(applied, [.today])
        withExtendedLifetime(subscription) {}
    }

    func testWarmTodayOpenDoesNotUndoTheNextTabSelection() async {
        let router = AppDeepLinkRouter()
        var selection = "today"
        var applications = 0
        var subscription = subscribe(router) { _ in
            selection = "today"
            applications += 1
        }
        router.open(.today)
        await drainDeliveries()
        XCTAssertNil(router.pending)
        XCTAssertEqual(applications, 1)

        // A user tab tap and shell re-render must not replay the warm Today URL.
        selection = "train"
        subscription.cancel()
        subscription = subscribe(router) { _ in
            selection = "today"
            applications += 1
        }
        await drainDeliveries()
        XCTAssertEqual(selection, "train")
        XCTAssertEqual(applications, 1)
        withExtendedLifetime(subscription) {}
    }

    func testWarmSessionIsTakenBeforeApplyingAndCanBeOpenedAgain() async {
        let router = AppDeepLinkRouter()
        let link = AppDeepLink.session("session-1")
        var applied: [AppDeepLink] = []
        let subscription = subscribe(router) {
            XCTAssertNil(router.pending, "Claim the link before mutating navigation")
            applied.append($0)
        }
        router.open(link)
        await drainDeliveries()
        XCTAssertNil(router.pending)
        XCTAssertEqual(applied, [link])
        router.open(link)
        await drainDeliveries()
        XCTAssertNil(router.pending)
        XCTAssertEqual(applied, [link, link])
        withExtendedLifetime(subscription) {}
    }

    func testDuplicateQueuedDeliveriesAreTakenOnlyOnce() async {
        let router = AppDeepLinkRouter()
        var applied: [AppDeepLink] = []
        let first = subscribe(router) { applied.append($0) }
        router.open(.session("session-1"))
        // Re-subscribing before deferred delivery enqueues the same pending value.
        let second = subscribe(router) { applied.append($0) }
        await drainDeliveries()
        XCTAssertNil(router.pending)
        XCTAssertEqual(applied, [.session("session-1")])
        withExtendedLifetime((first, second)) {}
    }

    func testSupersededDeliveryCannotClearOrApplyTheLatestPendingLink() async {
        let router = AppDeepLinkRouter()
        var applied: [AppDeepLink] = []
        let subscription = subscribe(router) { applied.append($0) }
        router.open(.today)
        router.open(.session("session-1"))
        XCTAssertFalse(router.take(.today))
        XCTAssertEqual(router.pending, .session("session-1"))
        await drainDeliveries()
        XCTAssertNil(router.pending)
        XCTAssertEqual(applied, [.session("session-1")])
        withExtendedLifetime(subscription) {}
    }

    private func subscribe(
        _ router: AppDeepLinkRouter,
        apply: @escaping (AppDeepLink) -> Void
    ) -> AnyCancellable {
        router.pendingLinks.sink { link in
            guard let link, router.take(link) else { return }
            apply(link)
        }
    }

    /// FIFO barrier behind the stream's main-queue deliveries, without sleeps.
    private func drainDeliveries() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
    }
}
