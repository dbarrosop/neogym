import XCTest

// Run on a fresh, dedicated simulator. Never clear a developer's Keychain or
// sign out their real account to satisfy the public-entry assertion below.
@MainActor
final class DemoModeUITests: XCTestCase {
    private let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAllAreasAndHonestConnectionDisclosure() {
        launch(screen: "today", reset: true)
        for title in ["Today", "Train", "Nutrition", "Progress", "Me"] {
            app.tabBars.buttons[title].tap()
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 10))
            XCTAssertEqual(app.alerts.count, 0, "Demo must not ask for system permissions")
            attachScreenshot(title)
        }
        app.buttons["Account"].tap()
        XCTAssertTrue(app.staticTexts["Local sample profile"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Not connected in demo"].exists)
        XCTAssertFalse(app.buttons["Change email"].exists)
    }

    func testBodyKeepsMeasurementLoggingAndShowsReadOnlyProgressPhotos() {
        launch(screen: "progress/body", reset: true)
        let measurement = app.navigationBars.buttons["Log measurement"]
        XCTAssertTrue(measurement.waitForExistence(timeout: 10))
        measurement.tap()
        XCTAssertTrue(app.navigationBars.buttons["Cancel"].waitForExistence(timeout: 10))
        app.navigationBars.buttons["Cancel"].tap()
        XCTAssertTrue(measurement.waitForExistence(timeout: 10))

        let open = app.buttons["progressPhotos.open"]
        // The interactive charts consume drags; scroll through the right gutter.
        for _ in 0..<5 where !open.isHittable { scrollPhotoPage() }
        XCTAssertTrue(open.isHittable, "The Body photo card should be reachable below the charts")
        XCTAssertTrue(app.staticTexts["Fictional sample photos · Read-only"].exists)
        XCTAssertFalse(app.buttons["progressPhotos.addFromBody"].exists)
        attachScreenshot("Demo progress photos — Body shortcut")
        open.tap()
        let tile = app.buttons.matching(identifier: "progressPhotos.tile.front_a").firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["progressPhotos.add"].exists)
        XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Add Back A photo'")).firstMatch.exists)
        attachScreenshot("Demo progress photos — Gallery")
        tile.tap()

        let photo = app.buttons["progressPhotos.openFullScreen"]
        XCTAssertTrue(photo.waitForExistence(timeout: 10))
        XCTAssertFalse(app.navigationBars.buttons["Edit"].exists)
        XCTAssertFalse(app.buttons["Delete photo"].exists)
        attachScreenshot("Demo progress photos — Detail")

        let older = app.buttons["Older"]
        XCTAssertTrue(older.waitForExistence(timeout: 10))
        let position = app.staticTexts["3 of 3"]
        XCTAssertTrue(position.waitForExistence(timeout: 10))
        let frame = photo.frame
        let controlsY = older.frame.minY
        older.tap()
        XCTAssertTrue(app.staticTexts["2 of 3"].waitForExistence(timeout: 5))
        XCTAssertTrue(photo.waitForExistence(timeout: 5))
        XCTAssertEqual(photo.frame.height, frame.height, accuracy: 1)
        XCTAssertEqual(photo.frame.minY, frame.minY, accuracy: 1)
        XCTAssertEqual(older.frame.minY, controlsY, accuracy: 1)

        app.buttons["Newer"].tap()
        XCTAssertTrue(position.waitForExistence(timeout: 5))
        photo.tap()
        let fullScreen = app.descendants(matching: .any)["progressPhotos.fullScreen"].firstMatch
        XCTAssertTrue(fullScreen.waitForExistence(timeout: 10))
        let fullScreenImage = app.images["Front A progress photo"]
        let first = NSPredicate(format: "label CONTAINS 'Photo 3 of 3'")
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: first, object: fullScreen)], timeout: 10), .completed)
        XCTAssertTrue(fullScreenImage.waitForExistence(timeout: 5))
        attachScreenshot("Demo progress photos — Full screen")
        fullScreen.swipeRight()
        let second = NSPredicate(format: "label CONTAINS 'Photo 2 of 3'")
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: second, object: fullScreen)], timeout: 10), .completed)
        XCTAssertTrue(fullScreenImage.waitForExistence(timeout: 5))
        fullScreen.swipeDown()
        XCTAssertTrue(app.staticTexts["2 of 3"].waitForExistence(timeout: 5))
        XCTAssertTrue(photo.waitForExistence(timeout: 5))
        photo.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: second, object: fullScreen)], timeout: 5), .completed)
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5) || app.state == .runningBackgroundSuspended)
        app.activate()
        XCTAssertTrue(app.navigationBars["Progress photo"].waitForExistence(timeout: 10))
        XCTAssertFalse(fullScreen.exists, "Backgrounding must retire the full-screen cover")
        let compare = app.buttons["Compare"]
        for _ in 0..<3 where !compare.isHittable { scrollPhotoPage() }
        XCTAssertTrue(compare.isHittable)
        XCTAssertTrue(app.staticTexts["2 of 3"].exists)
        compare.tap()
        XCTAssertTrue(app.navigationBars["Compare photos"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Two fictional sample photos, oldest on the left."].exists)
        let slider = app.sliders["progressPhotos.compareDivider"]
        XCTAssertTrue(slider.waitForExistence(timeout: 10))
        let beforeImage = app.images.matching(NSPredicate(format: "label BEGINSWITH 'Before, Front A'")).firstMatch
        XCTAssertTrue(beforeImage.waitForExistence(timeout: 10))
        attachScreenshot("Demo progress photos — Compare")
        if !slider.isHittable { scrollPhotoPage(end: 0.58) }
        XCTAssertTrue(slider.isHittable)
        let initialPosition = slider.value as? String
        slider.adjust(toNormalizedSliderPosition: 0.35)
        XCTAssertNotEqual(slider.value as? String, initialPosition)
    }

    func testProgressPhotoGalleryKeepsAngleOnBackButResetsOnReopen() {
        launch(screen: "progress/body", reset: true)
        let open = app.buttons["progressPhotos.open"]
        for _ in 0..<5 where !open.isHittable { scrollPhotoPage() }
        XCTAssertTrue(open.isHittable)
        open.tap()

        let gallery = app.navigationBars["Progress photos"]
        let backAngle = app.buttons["Back A"]
        let frontTile = app.buttons.matching(identifier: "progressPhotos.tile.front_a").firstMatch
        let backTile = app.buttons.matching(identifier: "progressPhotos.tile.back_a").firstMatch
        XCTAssertTrue(backAngle.waitForExistence(timeout: 10))
        XCTAssertTrue(frontTile.waitForExistence(timeout: 10))
        backAngle.tap()
        XCTAssertTrue(backAngle.isSelected)
        XCTAssertTrue(backTile.waitForExistence(timeout: 10))
        XCTAssertFalse(frontTile.exists)
        backTile.tap()

        let detail = app.navigationBars["Progress photo"]
        XCTAssertTrue(detail.waitForExistence(timeout: 10))
        detail.buttons.firstMatch.tap()
        XCTAssertTrue(backTile.waitForExistence(timeout: 10))
        XCTAssertTrue(backAngle.isSelected, "Returning to the same gallery should preserve its filter")
        XCTAssertFalse(frontTile.exists)
        gallery.buttons.firstMatch.tap()

        for _ in 0..<5 where !open.isHittable { scrollPhotoPage() }
        XCTAssertTrue(open.isHittable)
        open.tap()
        let allPhotos = app.buttons["All photos"]
        XCTAssertTrue(allPhotos.waitForExistence(timeout: 10))
        XCTAssertTrue(allPhotos.isSelected, "A fresh View all must open unfiltered")
        XCTAssertTrue(frontTile.waitForExistence(timeout: 10))
        XCTAssertTrue(backTile.exists)
    }

    private func scrollPhotoPage(end: CGFloat = 0.28) {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.985, dy: 0.76)).press(forDuration: 0.05,
            thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.985, dy: end)))
    }

    func testDemoBannerLeavesNativeToolbarBackAndCreateUsable() {
        launch(screen: "today", reset: true)
        let quickLog = app.navigationBars.buttons["Quick log"]
        XCTAssertTrue(quickLog.waitForExistence(timeout: 10))
        XCTAssertTrue(quickLog.isHittable)
        quickLog.tap()
        app.buttons["Start session"].tap()
        let create = app.navigationBars.buttons["New workout"]
        XCTAssertTrue(create.waitForExistence(timeout: 10))
        create.tap()
        XCTAssertTrue(app.navigationBars["New workout"].waitForExistence(timeout: 10))
        app.navigationBars.buttons["Cancel"].tap()
        XCTAssertTrue(app.navigationBars["Train"].waitForExistence(timeout: 10))
        attachScreenshot("Native toolbar below demo banner")

        app.terminate()
        launch(screen: "train/session/current", reset: true)
        let back = app.navigationBars.buttons.matching(NSPredicate(format: "label == 'Train' OR label == 'Back'")).firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        XCTAssertTrue(back.isHittable)
        back.tap()
        XCTAssertTrue(app.navigationBars["Train"].waitForExistence(timeout: 10))
    }

    func testSetLoggingPersistsResetWorksAndPublicEntryReturns() {
        launch(screen: "train/session/current", reset: true)
        XCTAssertTrue(app.buttons["Log set 2"].waitForExistence(timeout: 10))
        app.buttons["Log set 2"].tap()
        XCTAssertTrue(app.buttons["Log set 3"].waitForExistence(timeout: 10))
        attachScreenshot("Logged demo set")

        app.terminate()
        launch(screen: "train/session/current", reset: false)
        XCTAssertTrue(app.buttons["Log set 3"].waitForExistence(timeout: 10), "Demo edits survive relaunch")
        app.buttons["demo.controls"].tap()
        app.buttons["Reset demo data"].tap()
        XCTAssertTrue(app.staticTexts["Reset all demo changes?"].waitForExistence(timeout: 5))
        app.buttons["Reset demo data"].tap()
        XCTAssertTrue(app.buttons["Log set 2"].waitForExistence(timeout: 10))

        app.buttons["demo.controls"].tap()
        app.buttons["Exit demo"].tap()
        XCTAssertTrue(app.buttons["demo.enter"].waitForExistence(timeout: 15),
                      "Use a clean test simulator: Exit intentionally restores any existing real session, not always Sign in.")
        app.buttons["demo.enter"].tap()
        XCTAssertTrue(banner.waitForExistence(timeout: 15))
    }

    func testLaunchResetDoesNotRepeatAfterExitAndPublicReentry() {
        launch(screen: "train/session/current", reset: true)
        XCTAssertTrue(app.buttons["Log set 2"].waitForExistence(timeout: 10))
        app.buttons["Log set 2"].tap()
        XCTAssertTrue(app.buttons["Log set 3"].waitForExistence(timeout: 10))

        app.buttons["demo.controls"].tap()
        app.buttons["Exit demo"].tap()
        XCTAssertTrue(app.buttons["demo.enter"].waitForExistence(timeout: 15),
                      "Use a clean test simulator: Exit intentionally restores any existing real session, not always Sign in.")
        app.buttons["demo.enter"].tap()
        XCTAssertTrue(app.buttons["Log set 3"].waitForExistence(timeout: 15), "Launch reset must not erase same-process demo edits on re-entry")
        attachScreenshot("Demo edit preserved after launch reset and re-entry")
    }

    func testPlannedNutritionLoggingUpdatesTotalsAndPersists() {
        launch(screen: "nutrition/log", reset: true)
        XCTAssertTrue(kcalLabel(425).waitForExistence(timeout: 10))
        let log = app.buttons["Log 07:30 slot"]
        for _ in 0..<5 {
            if log.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(log.isHittable)
        log.tap()
        XCTAssertTrue(app.staticTexts["Log this planned slot?"].waitForExistence(timeout: 5))
        app.buttons["Log slot"].tap()
        for _ in 0..<4 {
            if kcalLabel(850).isHittable { break }
            app.swipeDown()
        }
        XCTAssertTrue(kcalLabel(850).waitForExistence(timeout: 10))
        attachScreenshot("Logged planned breakfast")
        app.terminate()
        launch(screen: "nutrition/log", reset: false)
        XCTAssertTrue(kcalLabel(850).waitForExistence(timeout: 10))
    }

    func testIntakePickersSearchSelectAndCancelWithoutLosingTheDraft() {
        launch(screen: "nutrition/log", reset: true)
        app.navigationBars.buttons["Log food"].tap()
        let foodChoice = app.buttons["logIntake.chooseFood"]
        XCTAssertTrue(foodChoice.waitForExistence(timeout: 10))
        let originalFood = foodChoice.label
        foodChoice.tap()
        XCTAssertTrue(app.navigationBars["Choose food"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.navigationBars.buttons["New food"].exists)
        let foodSearch = app.textFields["Search foods"]
        foodSearch.tap()
        foodSearch.typeText("Greek yogurt")
        let yogurtRows = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Greek yogurt,"))
        let yogurt = yogurtRows.firstMatch
        XCTAssertTrue(yogurt.waitForExistence(timeout: 5))
        app.navigationBars["Choose food"].buttons["Cancel"].tap()
        XCTAssertTrue(foodChoice.waitForExistence(timeout: 5))
        XCTAssertEqual(foodChoice.label, originalFood, "Cancelling the search must preserve the draft choice")

        foodChoice.tap()
        foodSearch.tap()
        foodSearch.typeText("Greek yogurt")
        yogurt.tap()
        XCTAssertTrue(foodChoice.waitForExistence(timeout: 5))
        XCTAssertTrue(foodChoice.label.contains("Greek yogurt"))
        foodChoice.tap()
        XCTAssertTrue(app.navigationBars["Choose food"].waitForExistence(timeout: 5))
        let selectedYogurt = yogurtRows.allElementsBoundByIndex.first { $0.isHittable }
        XCTAssertEqual(selectedYogurt?.isSelected, true, "The current food must be marked for VoiceOver as well as visually")
        app.navigationBars["Choose food"].buttons["Cancel"].tap()

        app.buttons["Meal"].tap()
        let mealChoice = app.buttons["logIntake.chooseMeal"]
        XCTAssertTrue(mealChoice.waitForExistence(timeout: 5))
        mealChoice.tap()
        XCTAssertTrue(app.navigationBars["Choose meal"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.navigationBars.buttons["New meal"].exists)
        let mealSearch = app.textFields["Search meals or ingredients"]
        mealSearch.tap()
        mealSearch.typeText("Blueberries")
        let meal = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Yogurt and oats,")).firstMatch
        XCTAssertTrue(meal.waitForExistence(timeout: 5))
        meal.tap()
        XCTAssertTrue(mealChoice.waitForExistence(timeout: 5))
        XCTAssertTrue(mealChoice.label.contains("Yogurt and oats"))
        app.navigationBars["Log intake"].buttons["Cancel"].tap()
        XCTAssertTrue(app.navigationBars["Nutrition"].waitForExistence(timeout: 5))
    }

    private func kcalLabel(_ value: Int) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^\(value) of .+ planned kilocalories$")).firstMatch
    }

    func testDirectLaunchTargets() {
        for (screen, title) in [("train/workouts", "Train"), ("nutrition/log", "Nutrition"), ("progress/body", "Progress"), ("progress/energy", "Progress")] {
            app.terminate()
            launch(screen: screen, reset: true)
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 10))
            attachScreenshot(screen)
        }
    }

    private var banner: XCUIElement { app.descendants(matching: .any)["demo.banner"].firstMatch }

    private func launch(screen: String, reset: Bool) {
        app.launchArguments = ["--demo", "--demo-screen", screen]
        if reset { app.launchArguments.append("--demo-reset") }
        app.launch()
        XCTAssertTrue(banner.waitForExistence(timeout: 20))
    }

    private func attachScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
