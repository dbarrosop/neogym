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
