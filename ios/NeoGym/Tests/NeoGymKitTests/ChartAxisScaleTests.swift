import Foundation
@testable import NeoGymKit
import XCTest

final class ChartAxisScaleTests: XCTestCase {
    private let enUS = Locale(identifier: "en_US")

    func testNiceStepRoundsUpToOneTwoTwoAndAHalfOrFive() {
        XCTAssertEqual(ChartAxisScale.niceStep(atLeast: 0.7), 1)
        XCTAssertEqual(ChartAxisScale.niceStep(atLeast: 1.3), 2)
        XCTAssertEqual(ChartAxisScale.niceStep(atLeast: 2.2), 2.5)
        XCTAssertEqual(ChartAxisScale.niceStep(atLeast: 3.4), 5)
        XCTAssertEqual(ChartAxisScale.niceStep(atLeast: 6), 10)
        XCTAssertEqual(ChartAxisScale.niceStep(atLeast: 13_300), 20_000)
    }

    func testCountAxisStartsAtZero() throws {
        let scale = try XCTUnwrap(ChartAxisScale.rounded(values: [3, 7.5, 11], includesZero: true))
        XCTAssertEqual(scale.min, 0)
        XCTAssertEqual(scale.mid, 10)
        XCTAssertEqual(scale.max, 20)
        let tight = try XCTUnwrap(ChartAxisScale.rounded(values: [3, 9, 10], includesZero: true))
        XCTAssertEqual([tight.min, tight.mid, tight.max], [0, 5, 10])
    }

    func testBodyWeightAxisHugsTheReadings() throws {
        let scale = try XCTUnwrap(ChartAxisScale.rounded(values: [70.45, 71.25, 71.9]))
        XCTAssertEqual([scale.min, scale.mid, scale.max], [70, 71, 72])
        XCTAssertEqual(scale.label(71, locale: enUS), "71")
    }

    func testRangeAlwaysContainsTheData() throws {
        for values in [[22_000.0, 48_596], [1_812, 2_640], [0.4, 0.9], [-1_180, 360], [158, 186]] {
            let scale = try XCTUnwrap(ChartAxisScale.rounded(values: values))
            XCTAssertLessThanOrEqual(scale.min, values.min()!)
            XCTAssertGreaterThanOrEqual(scale.max, values.max()!)
        }
    }

    func testSingleValueGetsARange() throws {
        let scale = try XCTUnwrap(ChartAxisScale.rounded(values: [70]))
        XCTAssertLessThan(scale.min, 70)
        XCTAssertGreaterThan(scale.max, 70)
        let zero = try XCTUnwrap(ChartAxisScale.rounded(values: [0], includesZero: true))
        XCTAssertEqual(zero.min, 0)
        XCTAssertGreaterThan(zero.max, 0)
    }

    func testNoValuesHaveNoScale() {
        XCTAssertNil(ChartAxisScale.rounded(values: []))
        XCTAssertNil(ChartAxisScale.rounded(values: [.nan]))
    }

    func testLabelsAreBareCompactNumbers() throws {
        let volume = try XCTUnwrap(ChartAxisScale.rounded(values: [22_000, 48_596]))
        XCTAssertEqual(volume.label(volume.max, locale: enUS), "60k")
        XCTAssertEqual(volume.label(volume.mid, locale: enUS), "40k")
        let energy = ChartAxisScale(min: 0, step: 1_000)
        XCTAssertEqual(energy.label(2_000, locale: enUS), "2,000")
        XCTAssertEqual(energy.label(0, locale: enUS), "0")
        let fractional = ChartAxisScale(min: 0, step: 2.5)
        XCTAssertEqual(fractional.label(2.5, locale: enUS), "2.5")
        XCTAssertEqual(fractional.label(5, locale: enUS), "5")
    }

    func testAxisCrossingZeroShowsSigns() throws {
        let net = try XCTUnwrap(ChartAxisScale.rounded(values: [-1_180, 360], includesZero: true))
        XCTAssertLessThan(net.min, 0)
        XCTAssertTrue(net.label(net.max, locale: enUS).hasPrefix("+"))
        XCTAssertTrue(net.label(net.min, locale: enUS).hasPrefix("−"))
        XCTAssertEqual(ChartAxisScale(min: -2_000, step: 2_000).label(0, locale: enUS), "0")
    }

    func testStartAlignedAxesPutBothFirstValuesAtTheSameHeight() throws {
        let volume = [3_500.0, 3_000, 2_800, 3_100, 4_000, 2_660]
        let estimate = [166.7, 169, 173.3, 175.5, 180, 172.7]
        let (left, right) = try XCTUnwrap(ChartAxisScale.startAligned(volume, estimate))
        for (scale, values) in [(left, volume), (right, estimate)] {
            XCTAssertLessThanOrEqual(scale.min, values.min()!)
            XCTAssertGreaterThanOrEqual(scale.max, values.max()!)
        }
        let leftHeight = (volume[0] - left.min) / (left.max - left.min)
        let rightHeight = (estimate[0] - right.min) / (right.max - right.min)
        XCTAssertEqual(leftHeight, rightHeight, accuracy: 1e-9)
        XCTAssertFalse(left.label(left.max, locale: enUS).contains("."))
    }

    func testStartAlignedHandlesAFlatSeriesAndMissingData() throws {
        let (weight, fat) = try XCTUnwrap(ChartAxisScale.startAligned([70, 70], [13.2, 12.6, 12.9]))
        XCTAssertLessThan(weight.min, 70)
        XCTAssertGreaterThan(weight.max, 70)
        XCTAssertEqual((70 - weight.min) / (weight.max - weight.min), (13.2 - fat.min) / (fat.max - fat.min), accuracy: 1e-9)
        XCTAssertNil(ChartAxisScale.startAligned([], [1, 2]))
    }
}
