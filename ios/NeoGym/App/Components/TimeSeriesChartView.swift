import SwiftUI

struct TimeSeriesChartDataPoint: Identifiable, Equatable {
    let id: String
    let date: Date
    let value: Double
}

struct TimeSeriesChartSeries: Identifiable {
    let id: String
    let name: String
    let color: Color
    let points: [TimeSeriesChartDataPoint]
    let valueFormatter: (Double) -> String

    init(
        id: String,
        name: String,
        color: Color,
        points: [TimeSeriesChartDataPoint],
        valueFormatter: @escaping (Double) -> String = { String(format: "%.1f", $0) }
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.points = points.sorted { $0.date < $1.date }
        self.valueFormatter = valueFormatter
    }
}


struct TimeSeriesChartView: View {
    let series: [TimeSeriesChartSeries]
    var maxRenderedPoints = 48
    var maxPointMarkers = 28
    var showsAxes = true
    var showsLegend = true
    var emptyMessage = "No data in this range."
    var accessibilityLabel = "Time series chart"
    var accessibilityValue: String?

    @State private var selectedPoint: PlottedChartPoint?

    private var nonEmptySeries: [TimeSeriesChartSeries] {
        series.filter { !$0.points.isEmpty }
    }

    private var allPoints: [TimeSeriesChartDataPoint] {
        nonEmptySeries.flatMap(\.points)
    }

    var body: some View {
        if allPoints.isEmpty {
            Text(emptyMessage)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
                .frame(maxWidth: .infinity, minHeight: 180)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                GeometryReader { proxy in
                    chartBody(size: proxy.size)
                }
                if showsLegend {
                    legend
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(accessibilityLabel))
            .accessibilityValue(Text(accessibilityValue ?? defaultAccessibilityValue))
        }
    }

    private func chartBody(size: CGSize) -> some View {
        let axisSeries = Array(nonEmptySeries.prefix(showsAxes ? 2 : 0))
        let leftAxisWidth: CGFloat = showsAxes && !axisSeries.isEmpty ? 42 : 0
        let rightAxisWidth: CGFloat = axisSeries.count > 1 ? 42 : 0
        let xAxisHeight: CGFloat = showsAxes ? 24 : 0
        let axisSpacing: CGFloat = showsAxes ? 8 : 0
        let horizontalAxisSpacing = axisSpacing * CGFloat(axisSeries.isEmpty ? 0 : axisSeries.count)
        let plotWidth = max(size.width - leftAxisWidth - rightAxisWidth - horizontalAxisSpacing, 1)
        let plotHeight = max(size.height - xAxisHeight, 1)

        return HStack(alignment: .top, spacing: axisSpacing) {
            if let leftSeries = axisSeries.first {
                yAxisLabels(for: leftSeries)
                    .frame(width: leftAxisWidth, height: plotHeight)
            }

            VStack(spacing: 4) {
                plotArea(size: CGSize(width: plotWidth, height: plotHeight))
                    .frame(width: plotWidth, height: plotHeight)
                if showsAxes {
                    xAxisLabels
                        .frame(width: plotWidth, height: xAxisHeight)
                }
            }

            if axisSeries.count > 1 {
                yAxisLabels(for: axisSeries[1])
                    .frame(width: rightAxisWidth, height: plotHeight)
            }
        }
    }

    private var chartGrid: some View {
        VStack {
            ForEach(0..<4, id: \.self) { _ in
                Divider().background(NeoGymTheme.border)
                Spacer()
            }
            Divider().background(NeoGymTheme.border)
        }
    }

    private func plotArea(size: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            chartGrid
            if showsAxes { chartAxes(size: size) }
            ForEach(nonEmptySeries) { singleSeries in
                seriesLayer(singleSeries, size: size)
            }
            if let selectedPoint {
                selectedPointLayer(selectedPoint, size: size)
            }
            Color.clear
                .contentShape(Rectangle())
                .gesture(selectionGesture(size: size))
        }
    }

    private func chartAxes(size: CGSize) -> some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 0, y: size.height))
            path.addLine(to: CGPoint(x: size.width, y: size.height))
            path.move(to: CGPoint(x: size.width, y: 0))
            path.addLine(to: CGPoint(x: size.width, y: size.height))
        }
        .stroke(NeoGymTheme.mutedText.opacity(0.65), lineWidth: 1)
    }

    private func seriesLayer(_ singleSeries: TimeSeriesChartSeries, size: CGSize) -> some View {
        let plottedPoints = plottedPoints(for: singleSeries, size: size)
        let positions = plottedPoints.map(\.position)

        return Path { path in
            guard let first = positions.first else { return }
            path.move(to: first)
            for point in positions.dropFirst() {
                path.addLine(to: point)
            }
        }
        .stroke(singleSeries.color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
        .overlay {
            if positions.count <= maxPointMarkers {
                ForEach(plottedPoints) { plottedPoint in
                    Circle()
                        .fill(singleSeries.color)
                        .frame(width: 6, height: 6)
                        .position(plottedPoint.position)
                }
            }
        }
    }

    private func selectedPointLayer(_ plottedPoint: PlottedChartPoint, size: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            Path { path in
                path.move(to: CGPoint(x: plottedPoint.position.x, y: 0))
                path.addLine(to: CGPoint(x: plottedPoint.position.x, y: size.height))
            }
            .stroke(plottedPoint.color.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))

            Circle()
                .fill(plottedPoint.color)
                .frame(width: 10, height: 10)
                .overlay(Circle().stroke(.white, lineWidth: 2))
                .position(plottedPoint.position)

            selectedPointCallout(plottedPoint, size: size)
        }
        .allowsHitTesting(false)
    }

    private func selectedPointCallout(_ plottedPoint: PlottedChartPoint, size: CGSize) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(plottedPoint.seriesName)
                .font(.caption2.weight(.semibold))
                .foregroundColor(plottedPoint.color)
            Text(plottedPoint.formattedValue)
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundColor(.primary)
            Text(Self.calloutDateFormatter.string(from: plottedPoint.point.date))
                .font(.caption2)
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusSM,
            material: .ultraThin,
            tint: NeoGymTheme.glassFill,
            shadow: true
        )
        .position(calloutPosition(for: plottedPoint.position, size: size))
    }

    private func calloutPosition(for point: CGPoint, size: CGSize) -> CGPoint {
        let xPosition = min(max(point.x, 72), max(size.width - 72, 72))
        let yOffset: CGFloat = point.y > 74 ? -54 : 54
        let yPosition = min(max(point.y + yOffset, 38), max(size.height - 38, 38))
        return CGPoint(x: xPosition, y: yPosition)
    }

    private func plottedPoints(for singleSeries: TimeSeriesChartSeries, size: CGSize) -> [PlottedChartPoint] {
        let sampledPoints = sampled(singleSeries.points, maxCount: maxRenderedPoints)
        let positions = normalizedPoints(sampledPoints, series: singleSeries, size: size)

        return zip(sampledPoints, positions).map { point, position in
            PlottedChartPoint(
                id: "\(singleSeries.id)-\(point.id)",
                seriesName: singleSeries.name,
                color: singleSeries.color,
                point: point,
                formattedValue: singleSeries.valueFormatter(point.value),
                position: position
            )
        }
    }

    private func plottedPoints(size: CGSize) -> [PlottedChartPoint] {
        nonEmptySeries.flatMap { plottedPoints(for: $0, size: size) }
    }

    private func selectionGesture(size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                selectedPoint = nearestPoint(to: value.location, size: size)
            }
    }

    private func nearestPoint(to location: CGPoint, size: CGSize) -> PlottedChartPoint? {
        let points = plottedPoints(size: size)
        guard let nearest = points.min(by: {
            distanceSquared($0.position, location) < distanceSquared($1.position, location)
        }) else {
            return nil
        }

        return distanceSquared(nearest.position, location) <= 36 * 36 ? nearest : nil
    }

    private func distanceSquared(_ left: CGPoint, _ right: CGPoint) -> CGFloat {
        let dx = left.x - right.x
        let dy = left.y - right.y
        return dx * dx + dy * dy
    }

    private func normalizedPoints(
        _ points: [TimeSeriesChartDataPoint],
        series: TimeSeriesChartSeries,
        size: CGSize
    ) -> [CGPoint] {
        guard !points.isEmpty else { return [] }
        let minX = allPoints.map { $0.date.timeIntervalSince1970 }.min() ?? points[0].date.timeIntervalSince1970
        let maxX = allPoints.map { $0.date.timeIntervalSince1970 }.max() ?? points[0].date.timeIntervalSince1970
        let range = metricRange(values: series.points.map(\.value))
            ?? ChartMetricRange(min: points[0].value - 1, max: points[0].value + 1)
        let horizontalSpan = max(maxX - minX, 1)
        let verticalSpan = max(range.max - range.min, 0.000_001)
        let inset: CGFloat = 10
        let width = max(size.width - inset * 2, 1)
        let height = max(size.height - inset * 2, 1)

        return points.map { point in
            let time = point.date.timeIntervalSince1970
            let xPosition = inset + CGFloat((time - minX) / horizontalSpan) * width
            let yRatio = (point.value - range.min) / verticalSpan
            let yPosition = inset + CGFloat(1 - yRatio) * height
            return CGPoint(x: xPosition, y: yPosition)
        }
    }

    private func sampled(_ points: [TimeSeriesChartDataPoint], maxCount: Int) -> [TimeSeriesChartDataPoint] {
        guard maxCount > 1, points.count > maxCount else { return points }
        let lastIndex = points.count - 1
        let step = Double(lastIndex) / Double(maxCount - 1)
        var lastChosenIndex = -1
        var sampledPoints: [TimeSeriesChartDataPoint] = []

        for bucket in 0..<maxCount {
            let index = min(lastIndex, Int((Double(bucket) * step).rounded()))
            guard index != lastChosenIndex else { continue }
            sampledPoints.append(points[index])
            lastChosenIndex = index
        }

        if sampledPoints.last?.id != points.last?.id {
            sampledPoints.append(points[lastIndex])
        }
        return sampledPoints
    }

    private func yAxisLabels(for singleSeries: TimeSeriesChartSeries) -> some View {
        let range = metricRange(values: singleSeries.points.map(\.value))
        return VStack(alignment: .trailing) {
            Text(range.map { singleSeries.valueFormatter($0.max) } ?? "—")
            Spacer()
            Text(range.map { singleSeries.valueFormatter($0.midpoint) } ?? "—")
            Spacer()
            Text(range.map { singleSeries.valueFormatter($0.min) } ?? "—")
        }
        .font(.caption2.monospacedDigit())
        .foregroundColor(singleSeries.color)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var xAxisLabels: some View {
        let sortedPoints = allPoints.sorted { $0.date < $1.date }
        return HStack(alignment: .top) {
            Text(sortedPoints.first.map { Self.shortDateFormatter.string(from: $0.date) } ?? "")
            Spacer(minLength: 4)
            if sortedPoints.count > 2 {
                Text(Self.shortDateFormatter.string(from: sortedPoints[sortedPoints.count / 2].date))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(sortedPoints.last.map { Self.shortDateFormatter.string(from: $0.date) } ?? "")
        }
        .font(.caption2)
        .foregroundColor(NeoGymTheme.mutedText)
    }

    private var legend: some View {
        HStack(spacing: 14) {
            ForEach(nonEmptySeries) { singleSeries in
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(singleSeries.color)
                        .frame(width: 16, height: 3)
                    Text(singleSeries.name)
                }
            }
        }
        .font(.caption)
        .foregroundColor(NeoGymTheme.mutedText)
        .padding(.horizontal, 8)
        .padding(.top, 2)
    }

    private func metricRange(values: [Double]) -> ChartMetricRange? {
        guard let minValue = values.min(), let maxValue = values.max() else { return nil }
        if minValue == maxValue {
            let padding = max(abs(minValue) * 0.05, 1)
            return ChartMetricRange(min: minValue - padding, max: maxValue + padding)
        }
        let padding = max((maxValue - minValue) * 0.1, 0.5)
        return ChartMetricRange(min: minValue - padding, max: maxValue + padding)
    }

    private struct ChartMetricRange {
        let min: Double
        let max: Double
        var midpoint: Double { (min + max) / 2 }
    }

    private struct PlottedChartPoint: Identifiable {
        let id: String
        let seriesName: String
        let color: Color
        let point: TimeSeriesChartDataPoint
        let formattedValue: String
        let position: CGPoint
    }

    private static let calloutDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        return formatter
    }()
}
