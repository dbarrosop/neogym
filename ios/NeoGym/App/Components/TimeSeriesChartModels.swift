import NeoGymKit
import SwiftUI

struct TimeSeriesChartDataPoint: Identifiable, Equatable {
    let id: String
    let date: Date
    let value: Double
}

enum TimeSeriesChartAxis: String, Hashable {
    case left
    case right
}

struct TimeSeriesChartSeries: Identifiable {
    let id: String
    let name: String
    let color: Color
    let axis: TimeSeriesChartAxis
    /// Keeps zero on the value axis: counts and energy start at 0, and
    /// signed series (net calories) show where they cross it.
    let includesZero: Bool
    let points: [TimeSeriesChartDataPoint]
    let valueFormatter: (Double) -> String

    init(
        id: String,
        name: String,
        color: Color,
        axis: TimeSeriesChartAxis = .left,
        includesZero: Bool = false,
        points: [TimeSeriesChartDataPoint],
        valueFormatter: @escaping (Double) -> String = { String(format: "%.1f", $0) }
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.axis = axis
        self.includesZero = includesZero
        self.points = points.sorted { $0.date < $1.date }
        self.valueFormatter = valueFormatter
    }
}

/// One value axis: which side, and its rounded `ChartAxisScale`. Labels are
/// bare numbers in the secondary text colour, whatever the series colour.
struct ChartAxisDescriptor {
    let axis: TimeSeriesChartAxis
    let scale: ChartAxisScale
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
