import Foundation
import NeoGymKit

struct GalleryScene: Decodable, Sendable {
    let id: String
    let platform: String
    let title: String
    let kind: String
    let variant: String
    let appearance: String
    let family: String?
    let region: String?
    let page: String?
    let width: Double?
    let height: Double?
}

struct GallerySpecification: Decodable, Sendable {
    struct Profile: Decodable, Sendable {
        let referenceDate: String
    }
    let profile: Profile
    let scenes: [GalleryScene]
}

/// This file belongs only to the separate, entitlement-free capture apps.
/// It never enables demo effects or writes a production snapshot.
enum GalleryFixtures {
    static let specification: GallerySpecification = {
        guard let url = Bundle.main.url(forResource: "scenes", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let result = try? JSONDecoder().decode(GallerySpecification.self, from: data)
        else { fatalError("Missing gallery specification") }
        return result
    }()

    static var scene: GalleryScene {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "--scene"), arguments.indices.contains(index + 1),
              let scene = specification.scenes.first(where: { $0.id == arguments[index + 1] })
        else { fatalError("A registered --scene is required; this app has no live mode") }
        return scene
    }

    static var now: Date { ISO8601DateFormatter().date(from: specification.profile.referenceDate)! }
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        calendar.locale = Locale(identifier: "en_US")
        return calendar
    }

    static func snapshot(_ variant: String) -> WatchEnergySnapshot? {
        if variant == "signed-out" { return nil }
        guard let baseline = try? JSONDecoder().decode(
            DailyRestingEnergyBaseline.self, from: Data(#"{"kcal":1781,"dayCount":7}"#.utf8)
        ) else { fatalError("Invalid fictional baseline") }
        let noEnergy = variant == "no-energy"
        return WatchEnergySnapshot(
            userID: "fictional-gallery-user", localDate: variant == "yesterday" ? "2025-01-14" : "2025-01-15",
            consumedKcal: 1_461, burnedKcal: noEnergy ? nil : 1_210,
            activeKcal: noEnergy ? nil : 531, restingKcal: noEnergy ? nil : 679,
            updatedAt: variant == "stale" ? now.addingTimeInterval(-7_200) : now,
            rowSource: .imported, pendingBackend: variant == "pending", restingBaseline: baseline,
            planKcal: variant == "no-plan" ? nil : 2_243, sevenDayAverageNet: -371
        )
    }

    static func display(_ variant: String) -> EnergyBalanceDisplay? {
        snapshot(variant).map {
            EnergyBalanceDisplay($0.displayInput, at: now, calendar: calendar, locale: Locale(identifier: "en_US"))
        }
    }

    /// The capture script waits for the requested scene, not an arbitrary shell delay.
    /// This receipt is app-private and means only that the fixture host appeared.
    @MainActor static func markReady(_ scene: GalleryScene) async {
        do {
            try await Task.sleep(for: .seconds(1))
            let directory = try FileManager.default.url(
                for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
            )
            let data = try JSONSerialization.data(withJSONObject: [
                "scene": scene.id, "profile": "widgets-watch-fixtures.v1",
                "locale": Locale.current.identifier,
                "timeZoneOffsetSeconds": TimeZone.current.secondsFromGMT(for: now)
            ])
            try data.write(to: directory.appendingPathComponent("gallery-ready.json"), options: .atomic)
        } catch { assertionFailure("Fixture readiness receipt failed: \(error)") }
    }
}
