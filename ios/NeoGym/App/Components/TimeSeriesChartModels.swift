import NeoGymKit
import SwiftUI

struct TimeSeriesChartDataPoint: Identifiable, Equatable {
    let id: String
    let date: Date
    let value: Double
    /// Today's (or this week's) value so far: drawn as an open dot, off the line.
    var isPartial = false
}

enum TimeSeriesChartSeriesStyle {
    /// A solid 2.5 pt line (a 7-day average, weekly volume, sets).
    case line
    /// Daily readings under their average: a thin half-opacity line with dots.
    case readings
}

enum TimeSeriesChartAxis: String, Hashable {
    case left
    case right
}

struct TimeSeriesChartSeries: Identifiable {
    let id: String
    let name: String
    let color: Color
    let style: TimeSeriesChartSeriesStyle
    let axis: TimeSeriesChartAxis
    /// Keeps zero on the value axis: counts and energy start at 0, and
    /// signed series (net calories) show where they cross it.
    let includesZero: Bool
    /// Shown after the top value-axis label ("72 kg") when two axes pair
    /// different units on a summary card.
    let unit: String?
    let points: [TimeSeriesChartDataPoint]
    let valueFormatter: (Double) -> String

    init(
        id: String,
        name: String,
        color: Color,
        style: TimeSeriesChartSeriesStyle = .line,
        axis: TimeSeriesChartAxis = .left,
        includesZero: Bool = false,
        unit: String? = nil,
        points: [TimeSeriesChartDataPoint],
        valueFormatter: @escaping (Double) -> String = { String(format: "%.1f", $0) }
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.style = style
        self.axis = axis
        self.includesZero = includesZero
        self.unit = unit
        self.points = points.sorted { $0.date < $1.date }
        self.valueFormatter = valueFormatter
    }

    /// The same series keeping only the points that pass `isIncluded`.
    func filtered(_ isIncluded: (TimeSeriesChartDataPoint) -> Bool) -> TimeSeriesChartSeries {
        TimeSeriesChartSeries(
            id: id, name: name, color: color, style: style, axis: axis, includesZero: includesZero,
            unit: unit, points: points.filter(isIncluded), valueFormatter: valueFormatter
        )
    }
}

/// One chart under a shared Period menu, such as Consumed above Net.
struct TimeSeriesChartPanel: Identifiable {
    let id: String
    var title: String?
    let series: [TimeSeriesChartSeries]
    var emptyMessage = "No data in this range."
    var accessibilityLabel = "Time series chart"
    var accessibilityValue: String?
}

/// One value axis: which side, and its rounded `ChartAxisScale`. Labels are
/// bare numbers in the secondary text colour, whatever the series colour.
struct ChartAxisDescriptor {
    let axis: TimeSeriesChartAxis
    let scale: ChartAxisScale
    /// Appended to the top label only.
    var unit: String?
}

struct PlottedChartPoint: Identifiable {
    let id: String
    let seriesName: String
    let color: Color
    let point: TimeSeriesChartDataPoint
    let formattedValue: String
    let position: CGPoint
}

let timeSeriesChartCalloutDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter
}()

/// Day and short month ("18 Sep", or the locale's order).
let timeSeriesChartAxisDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.setLocalizedDateFormatFromTemplate("d MMM")
    return formatter
}()
