import XCTest

/// Opt-in, simulator-only documentation driver. Normal test runs skip it.
/// Use only on a newly created simulator: Exit may restore an existing account.
@MainActor
final class DemoGuideCaptureUITests: XCTestCase {
    private let app = XCUIApplication()

    func testCaptureGuide() throws {
        guard ProcessInfo.processInfo.environment["NEOGYM_CAPTURE_GUIDE"] == "1" else {
            throw XCTSkip("Opt in with TEST_RUNNER_NEOGYM_CAPTURE_GUIDE=1 on a fresh simulator.")
        }
        continueAfterFailure = false
        executionTimeAllowance = 7200
        let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("NeoGymGuide", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let images = root.appendingPathComponent("screenshots", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        let requestURL = root.appendingPathComponent("request.json")
        let responseURL = root.appendingPathComponent("response.json")
        try? FileManager.default.removeItem(at: requestURL)
        try? FileManager.default.removeItem(at: responseURL)
        try write(["ready": true, "root": root.path, "version": 1], to: root.appendingPathComponent("ready.json"))
        print("NEOGYM_GUIDE_READY \(root.path)")

        var lastID = ""
        let deadline = Date().addingTimeInterval(7100)
        while Date() < deadline {
            guard let data = try? Data(contentsOf: requestURL),
                  let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let id = request["id"] as? String, id != lastID
            else {
                Thread.sleep(forTimeInterval: 0.1)
                continue
            }
            lastID = id
            do {
                let result = try execute(request, images: images)
                try write(["id": id, "ok": true, "result": result], to: responseURL)
                if request["action"] as? String == "finish" {
                    if let failure = request["failure"] as? String { XCTFail(failure) }
                    return
                }
            } catch {
                try write(["id": id, "ok": false, "error": error.localizedDescription,
                           "tree": app.debugDescription], to: responseURL)
            }
        }
        XCTFail("Documentation driver timed out before receiving finish.")
    }

    private func execute(_ request: [String: Any], images: URL) throws -> [String: Any] {
        let action = request["action"] as? String ?? ""
        let handlers: [String: () throws -> [String: Any]] = [
            "launch": { self.launch(request) },
            "activate": { self.app.activate(); return ["running": true] },
            "terminate": { self.app.terminate(); return [:] },
            "tree": { ["tree": self.app.debugDescription] },
            "query": { self.inspect(request) },
            "exists": { self.exists(request) },
            "tap": { try self.interact(request, action: action) },
            "press": { try self.interact(request, action: action) },
            "type": { try self.interact(request, action: action) },
            "adjust": { try self.interact(request, action: action) },
            "swipe": { self.swipe(request) },
            "drag": { self.coordinate(request, tap: false) },
            "coordinate": { self.coordinate(request, tap: true) },
            "screenshot": { try self.screenshot(request, images: images) },
            "finish": { ["finished": true] }
        ]
        guard let handler = handlers[action] else { throw failure("Unknown documentation action: \(action)") }
        return try handler()
    }

    private func launch(_ request: [String: Any]) -> [String: Any] {
        app.terminate()
        var arguments = request["arguments"] as? [String]
            ?? ["--demo", "--demo-screen", request["screen"] as? String ?? "today"]
        if request["reset"] as? Bool == true { arguments.append("--demo-reset") }
        app.launchArguments = arguments + ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        return ["running": true]
    }

    private func inspect(_ request: [String: Any]) -> [String: Any] {
        let matches = query(request["element"] as? [String: Any] ?? [:], within: app)
        return ["elements": matches.allElementsBoundByIndex.prefix(100).map(describe)]
    }

    private func exists(_ request: [String: Any]) -> [String: Any] {
        let target = element(request)
        let found = target.waitForExistence(timeout: request["timeout"] as? Double ?? 5)
        return ["exists": found, "hittable": found && target.isHittable, "enabled": found && target.isEnabled]
    }

    private func interact(_ request: [String: Any], action: String) throws -> [String: Any] {
        let target = element(request)
        guard target.waitForExistence(timeout: request["timeout"] as? Double ?? 8) else {
            throw failure("Element not found: \(request["element"] ?? "unspecified")")
        }
        switch action {
        case "press":
            target.press(forDuration: request["duration"] as? Double ?? 1)
        case "type":
            try typeText(request, into: target)
        case "adjust":
            target.adjust(toPickerWheelValue: request["value"] as? String ?? "")
        default:
            guard target.isHittable else { throw failure("Element exists but is offscreen or obscured: \(target.label)") }
            target.tap()
        }
        return [:]
    }

    private func typeText(_ request: [String: Any], into target: XCUIElement) throws {
        target.tap()
        let expected = request["text"] as? String ?? ""
        if request["selection"] as? String == "doubleTap" {
            // Ingredient/plan rows own a long-press context menu; double-tap selects their number instead.
            if let tapX = request["tapX"] as? Double {
                target.coordinate(withNormalizedOffset: CGVector(dx: tapX, dy: 0.5)).doubleTap()
            } else {
                target.doubleTap()
            }
        } else if request["replace"] as? Bool == true, let current = target.value as? String, !current.isEmpty {
            target.press(forDuration: 1)
            let selectAll = app.buttons["Select All"].firstMatch
            let selectAllMenu = app.menuItems["Select All"].firstMatch
            if selectAll.waitForExistence(timeout: 0.3), selectAll.isHittable {
                selectAll.tap()
            } else if selectAllMenu.exists, selectAllMenu.isHittable {
                selectAllMenu.tap()
            } else {
                // Right-aligned number wells can initially place the caret before their zero.
                // Reposition at the end before backspacing, rather than appending to that zero.
                target.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5)).tap()
                target.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
            }
        }
        guard app.keyboards.firstMatch.waitForExistence(timeout: 0.5) else {
            throw failure("Text field did not retain keyboard focus: \(target.label)")
        }
        target.typeText(expected)
        // A search field can change its placeholder (and therefore its locator) while typing.
        if target.exists, let actual = target.value as? String,
           actual != expected, !(expected.isEmpty && actual == target.placeholderValue) {
            throw failure("Input read-back differs from requested text: \(target.label)")
        }
    }

    private func swipe(_ request: [String: Any]) -> [String: Any] {
        let target: XCUIElement = request["element"] == nil ? app : element(request)
        switch request["direction"] as? String ?? "up" {
        case "down": target.swipeDown()
        case "left": target.swipeLeft()
        case "right": target.swipeRight()
        default: target.swipeUp()
        }
        return [:]
    }

    private func coordinate(_ request: [String: Any], tap: Bool) -> [String: Any] {
        let start = app.coordinate(withNormalizedOffset: CGVector(
            dx: request["x"] as? Double ?? 0.5, dy: request["y"] as? Double ?? 0.75
        ))
        if tap {
            start.tap()
        } else {
            let end = app.coordinate(withNormalizedOffset: CGVector(
                dx: request["toX"] as? Double ?? 0.5, dy: request["toY"] as? Double ?? 0.35
            ))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.2)
        }
        return [:]
    }

    private func screenshot(_ request: [String: Any], images: URL) throws -> [String: Any] {
        let name = request["name"] as? String ?? ""
        guard name.range(of: "^[a-z0-9][a-z0-9-]*$", options: .regularExpression) != nil else {
            throw failure("Screenshot names must be lowercase filename slugs.")
        }
        let path = images.appendingPathComponent(name + ".png")
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: path, options: .atomic)
        let tree = app.debugDescription
        try tree.write(to: images.appendingPathComponent(name + ".txt"), atomically: true, encoding: .utf8)
        return ["path": path.path, "tree": tree, "capturedAt": ISO8601DateFormatter().string(from: Date())]
    }

    private func element(_ request: [String: Any]) -> XCUIElement {
        let specification = request["element"] as? [String: Any] ?? [:]
        let matches = query(specification, within: app)
        if let index = specification["index"] as? Int { return matches.element(boundBy: index) }
        return matches.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? matches.firstMatch
    }

    private func query(_ specification: [String: Any], within root: XCUIElement) -> XCUIElementQuery {
        if let scope = specification["scope"] as? [String: Any] {
            let parents = query(scope, within: root)
            let parent: XCUIElement
            if let index = scope["index"] as? Int {
                parent = parents.element(boundBy: index)
            } else {
                parent = parents.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? parents.firstMatch
            }
            var child = specification
            child.removeValue(forKey: "scope")
            return query(child, within: parent)
        }
        let types: [String: XCUIElement.ElementType] = [
            "button": .button, "text": .staticText, "textField": .textField,
            "textView": .textView, "navigationBar": .navigationBar,
            "tabBar": .tabBar, "scrollView": .scrollView, "table": .table,
            "picker": .picker, "pickerWheel": .pickerWheel, "segmentedControl": .segmentedControl,
            "sheet": .sheet, "alert": .alert, "switch": .switch, "other": .other,
            "datePicker": .datePicker, "keyboard": .keyboard, "image": .image
        ]
        var result = root.descendants(matching: types[specification["type"] as? String ?? ""] ?? .any)
        if let label = specification["label"] as? String {
            let operation = specification["match"] as? String ?? "exact"
            let predicate: NSPredicate
            switch operation {
            case "contains": predicate = NSPredicate(format: "label CONTAINS %@", label)
            case "prefix": predicate = NSPredicate(format: "label BEGINSWITH %@", label)
            case "regex": predicate = NSPredicate(format: "label MATCHES %@", label)
            default:
                predicate = NSPredicate(
                    format: "label == %@ OR identifier == %@ OR placeholderValue == %@", label, label, label
                )
            }
            result = result.matching(predicate)
        }
        if specification["enabled"] as? Bool == true {
            result = result.matching(NSPredicate(format: "enabled == true"))
        }
        return result
    }

    private func describe(_ element: XCUIElement) -> [String: Any] {
        ["label": element.label, "identifier": element.identifier,
         "placeholder": element.placeholderValue ?? "",
         "value": element.value as? String ?? "", "enabled": element.isEnabled,
         "hittable": element.isHittable, "type": element.elementType.rawValue,
         "frame": [element.frame.minX, element.frame.minY, element.frame.width, element.frame.height]]
    }

    private func write(_ value: [String: Any], to url: URL) throws {
        try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
            .write(to: url, options: .atomic)
    }

    private func failure(_ message: String) -> NSError {
        NSError(domain: "NeoGymGuideCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
