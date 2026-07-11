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
    let centersAxisOnZero: Bool
    let points: [TimeSeriesChartDataPoint]
    let valueFormatter: (Double) -> String

    init(
        id: String,
        name: String,
        color: Color,
        axis: TimeSeriesChartAxis = .left,
        centersAxisOnZero: Bool = false,
        points: [TimeSeriesChartDataPoint],
        valueFormatter: @escaping (Double) -> String = { String(format: "%.1f", $0) }
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.axis = axis
        self.centersAxisOnZero = centersAxisOnZero
        self.points = points.sorted { $0.date < $1.date }
        self.valueFormatter = valueFormatter
    }
}

func timeSeriesChartMetricRange(values: [Double], centersOnZero: Bool = false) -> ChartMetricRange? {
    guard let minValue = values.min(), let maxValue = values.max() else { return nil }
    if centersOnZero {
        let magnitude = max(abs(minValue), abs(maxValue), 1)
        let paddedMagnitude = magnitude * 1.1
        return ChartMetricRange(min: -paddedMagnitude, max: paddedMagnitude)
    }
    if minValue == maxValue {
        let padding = max(abs(minValue) * 0.05, 1)
        return ChartMetricRange(min: minValue - padding, max: maxValue + padding)
    }
    let padding = max((maxValue - minValue) * 0.1, 0.5)
    return ChartMetricRange(min: minValue - padding, max: maxValue + padding)
}

struct ChartAxisDescriptor {
    let axis: TimeSeriesChartAxis
    let range: ChartMetricRange
    let color: Color
    let formatter: (Double) -> String
}

struct ChartMetricRange {
    let min: Double
    let max: Double
    var midpoint: Double { (min + max) / 2 }
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

let timeSeriesChartShortDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .short
    formatter.timeStyle = .none
    return formatter
}()
