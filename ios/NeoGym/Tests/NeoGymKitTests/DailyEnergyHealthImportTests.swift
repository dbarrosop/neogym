import Foundation
import XCTest
@testable import NeoGymKit

final class HealthDailyEnergyGrouperTests: XCTestCase {
    func testSumsMultipleSamplesPerDayAndSortsNewestFirst() {
        let entries = HealthDailyEnergyGrouper.sum(
            active: [
                (measuredOn: "2026-06-25", value: 120.25),
                (measuredOn: "2026-06-25", value: 30.5),
                (measuredOn: "2026-06-24", value: 200)
            ],
            resting: [
                (measuredOn: "2026-06-25", value: 1500),
                (measuredOn: "2026-06-24", value: 1450.75)
            ]
        )

        XCTAssertEqual(entries.map(\.energyOn), ["2026-06-25", "2026-06-24"])
        XCTAssertEqual(entries[0].activeKcal, 150.75)
        XCTAssertEqual(entries[0].restingKcal, 1500)
        XCTAssertEqual(entries[1].activeKcal, 200)
        XCTAssertEqual(entries[1].restingKcal, 1450.75)
    }

    func testKeepsActiveOnlyRestingOnlyAndCombinedDays() {
        let entries = HealthDailyEnergyGrouper.sum(
            active: [
                (measuredOn: "2026-06-25", value: 400),
                (measuredOn: "2026-06-23", value: 550)
            ],
            resting: [
                (measuredOn: "2026-06-24", value: 1600),
                (measuredOn: "2026-06-23", value: 1550)
            ]
        )

        XCTAssertEqual(entries, [
            HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 400, restingKcal: nil),
            HealthDailyEnergy(energyOn: "2026-06-24", activeKcal: nil, restingKcal: 1600),
            HealthDailyEnergy(energyOn: "2026-06-23", activeKcal: 550, restingKcal: 1550)
        ])
    }

    func testDropsInvalidMetricValuesIndependentlyAndSkipsOnlyBothNilDays() {
        let entries = HealthDailyEnergyGrouper.sum(
            active: [
                (measuredOn: "2026-06-25", value: 0),
                (measuredOn: "2026-06-24", value: -10),
                (measuredOn: "2026-06-23", value: .infinity),
                (measuredOn: "2026-06-22", value: .nan)
            ],
            resting: [
                (measuredOn: "2026-06-25", value: 1500),
                (measuredOn: "2026-06-24", value: 0),
                (measuredOn: "2026-06-23", value: -1),
                (measuredOn: "2026-06-22", value: 1600)
            ]
        )

        XCTAssertEqual(entries, [
            HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: nil, restingKcal: 1500),
            HealthDailyEnergy(energyOn: "2026-06-22", activeKcal: nil, restingKcal: 1600)
        ])
    }

    func testHealthDailyEnergyFormValuesRoundIntoDatabaseValidationShape() throws {
        let values = try XCTUnwrap(HealthDailyEnergy(
            energyOn: "2026-06-25",
            activeKcal: 123.456,
            restingKcal: 29999.994
        ).formValues(notes: "Imported from Apple Health"))

        XCTAssertEqual(values, DailyEnergyFormValues(
            energyOn: "2026-06-25",
            activeKcal: "123.46",
            restingKcal: "29999.99",
            notes: "Imported from Apple Health"
        ))
        guard case .success = DailyEnergyValidation.validate(values) else {
            return XCTFail("Expected rounded health values to satisfy daily energy validation")
        }
    }
}
