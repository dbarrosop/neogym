import Foundation
import XCTest
@testable import NeoGymKit

final class ChartAccessibilitySummaryTests: XCTestCase {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private func day(_ value: Int) -> Date {
        calendar.date(from: DateComponents(year: 2026, month: 11, day: value))!
    }

    private func formatDate(_ date: Date) -> String {
        "\(calendar.component(.day, from: date)) Nov"
    }

    private let kcal: (Double) -> String = { "\(Int($0)) kcal" }

    func testPartialTodayIsLeftOutOfTheStatsAndNamedLast() {
        let consumed = ChartAccessibilitySummary.Series(
            name: "Consumed",
            points: [
                .init(date: day(9), value: 2_140),
                .init(date: day(10), value: 2_584),
                .init(date: day(11), value: 2_386),
                .init(date: day(12), value: 650, isPartial: true)
            ],
            format: kcal
        )
        XCTAssertEqual(
            ChartAccessibilitySummary.text(for: [consumed], formatDate: formatDate),
            "From 9 Nov to 11 Nov. Consumed: lowest 2140 kcal, highest 2584 kcal, average 2370 kcal, "
                + "latest 2386 kcal on 11 Nov. Today so far: 650 kcal."
        )
    }

    func testSeveralPartialSeriesShareOneClosingSentence() {
        let resting = ChartAccessibilitySummary.Series(
            name: "Resting",
            points: [.init(date: day(11), value: 1_842), .init(date: day(12), value: 679, isPartial: true)],
            format: kcal
        )
        let active = ChartAccessibilitySummary.Series(
            name: "Active",
            points: [.init(date: day(11), value: 728), .init(date: day(12), value: 531, isPartial: true)],
            format: kcal
        )
        XCTAssertEqual(
            ChartAccessibilitySummary.text(for: [resting, active], formatDate: formatDate),
            "On 11 Nov. Resting: latest 1842 kcal on 11 Nov. Active: latest 728 kcal on 11 Nov. "
                + "Today so far: Resting 679 kcal, Active 531 kcal."
        )
    }

    func testWeeklySeriesNameWeeksAndThisWeekSoFar() {
        let volume = ChartAccessibilitySummary.Series(
            name: "Volume",
            points: [
                .init(date: day(2), value: 28_400),
                .init(date: day(9), value: 48_600),
                .init(date: day(16), value: 20_500, isPartial: true)
            ],
            unit: .week,
            format: { "\(Int($0)) kg" }
        )
        XCTAssertEqual(
            ChartAccessibilitySummary.text(for: [volume], formatDate: formatDate),
            "Weeks of 2 Nov to 9 Nov. Volume: lowest 28400 kg, highest 48600 kg, average 38500 kg, "
                + "latest 48600 kg in the week of 9 Nov. This week so far: 20500 kg."
        )
    }

    func testRollingAverageSeriesLeaveOutTheirOwnAverage() {
        let daily = ChartAccessibilitySummary.Series(
            name: "Daily",
            points: [
                .init(date: day(9), value: 2_140),
                .init(date: day(10), value: 2_584),
                .init(date: day(11), value: 2_386),
                .init(date: day(12), value: 650, isPartial: true)
            ],
            format: kcal
        )
        let average = ChartAccessibilitySummary.Series(
            name: "7-day avg",
            points: [.init(date: day(10), value: 2_362), .init(date: day(11), value: 2_370)],
            isRollingAverage: true,
            format: kcal
        )
        XCTAssertEqual(
            ChartAccessibilitySummary.text(for: [daily, average], formatDate: formatDate),
            "From 9 Nov to 11 Nov. Daily: lowest 2140 kcal, highest 2584 kcal, average 2370 kcal, "
                + "latest 2386 kcal on 11 Nov. 7-day avg: lowest 2362 kcal, highest 2370 kcal, "
                + "latest 2370 kcal on 11 Nov. Today so far: 650 kcal.",
            "One partial series goes unnamed; the average line reports no average of its own"
        )
    }

    func testOnlyPartialPointsAndNoPartialPoints() {
        let todayOnly = ChartAccessibilitySummary.Series(
            name: "Consumed", points: [.init(date: day(12), value: 650, isPartial: true)], format: kcal
        )
        XCTAssertEqual(
            ChartAccessibilitySummary.text(for: [todayOnly], formatDate: formatDate),
            "Today so far: 650 kcal."
        )
        let complete = ChartAccessibilitySummary.Series(
            name: "Duration",
            points: [.init(date: day(10), value: 2_100), .init(date: day(3), value: 1_590)],
            format: CardioMetricsSchemaHelpers.formatSecondsAsDuration
        )
        XCTAssertEqual(
            ChartAccessibilitySummary.text(for: [complete], formatDate: formatDate),
            "From 3 Nov to 10 Nov. Duration: lowest 26:30, highest 35:00, average 30:45, latest 35:00 on 10 Nov."
        )
        XCTAssertEqual(ChartAccessibilitySummary.text(for: [], formatDate: formatDate), "")
    }
}
