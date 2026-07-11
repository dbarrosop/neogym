import NeoGymKit
import SwiftUI

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
    @State private var visibilityState = ChartSeriesVisibilityState()

    var candidateSeries: [TimeSeriesChartSeries] {
        series.filter { !$0.points.isEmpty }
    }

    var effectiveVisibleSeries: [TimeSeriesChartSeries] {
        let visibleIDs = Set(visibilityState.visibleIDs(among: candidateSeries.map(\.id)))
        return candidateSeries.filter { visibleIDs.contains($0.id) }
    }

    private var allPoints: [TimeSeriesChartDataPoint] {
        effectiveVisibleSeries.flatMap(\.points)
    }

    private var visiblePointIdentity: [String] {
        effectiveVisibleSeries.flatMap { singleSeries in
            singleSeries.points.map { point in "\(singleSeries.id)-\(point.id)" }
        }
    }

    var body: some View {
        if candidateSeries.isEmpty {
            Text(emptyMessage)
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
                .frame(maxWidth: .infinity, minHeight: 180)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                GeometryReader { proxy in
                    chartBody(size: proxy.size)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(accessibilityLabel))
                .accessibilityValue(Text(accessibilityValue ?? defaultAccessibilityValue))

                if showsLegend {
                    legend
                }
            }
            .onChange(of: visiblePointIdentity) { _, _ in
                selectedPoint = nil
            }
        }
    }

    private func chartBody(size: CGSize) -> some View {
        let leftAxis = axisDescriptor(for: .left)
        let rightAxis = axisDescriptor(for: .right)
        let leftAxisWidth: CGFloat = showsAxes && leftAxis != nil ? 42 : 0
        let rightAxisWidth: CGFloat = showsAxes && rightAxis != nil ? 42 : 0
        let xAxisHeight: CGFloat = showsAxes ? 24 : 0
        let axisSpacing: CGFloat = showsAxes ? 8 : 0
        let axisCount = [leftAxis, rightAxis].compactMap { $0 }.count
        let horizontalAxisSpacing = axisSpacing * CGFloat(axisCount)
        let plotWidth = max(size.width - leftAxisWidth - rightAxisWidth - horizontalAxisSpacing, 1)
        let plotHeight = max(size.height - xAxisHeight, 1)

        return HStack(alignment: .top, spacing: axisSpacing) {
            if let leftAxis {
                yAxisLabels(for: leftAxis)
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

            if let rightAxis {
                yAxisLabels(for: rightAxis)
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
            ForEach(effectiveVisibleSeries) { singleSeries in
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
            Text(timeSeriesChartCalloutDateFormatter.string(from: plottedPoint.point.date))
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
        effectiveVisibleSeries.flatMap { plottedPoints(for: $0, size: size) }
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
        let range = axisDescriptor(for: series.axis)?.range
            ?? timeSeriesChartMetricRange(values: series.points.map(\.value), centersOnZero: series.centersAxisOnZero)
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

    private func yAxisLabels(for axis: ChartAxisDescriptor) -> some View {
        VStack(alignment: .trailing) {
            Text(axis.formatter(axis.range.max))
            Spacer()
            Text(axis.formatter(axis.range.midpoint))
            Spacer()
            Text(axis.formatter(axis.range.min))
        }
        .font(.caption2.monospacedDigit())
        .foregroundColor(axis.color)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var xAxisLabels: some View {
        let sortedPoints = allPoints.sorted { $0.date < $1.date }
        return HStack(alignment: .top) {
            Text(sortedPoints.first.map { timeSeriesChartShortDateFormatter.string(from: $0.date) } ?? "")
            Spacer(minLength: 4)
            if sortedPoints.count > 2 {
                Text(timeSeriesChartShortDateFormatter.string(from: sortedPoints[sortedPoints.count / 2].date))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(sortedPoints.last.map { timeSeriesChartShortDateFormatter.string(from: $0.date) } ?? "")
        }
        .font(.caption2)
        .foregroundColor(NeoGymTheme.mutedText)
    }

    private var legend: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(candidateSeries) { singleSeries in
                    legendButton(for: singleSeries)
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 2)
        }
        .accessibilityElement(children: .contain)
    }

    private func legendButton(for singleSeries: TimeSeriesChartSeries) -> some View {
        let isEffectivelyVisible = effectiveVisibleSeries.contains { $0.id == singleSeries.id }

        return Button {
            visibilityState.toggle(singleSeries.id, among: candidateSeries.map(\.id))
            selectedPoint = nil
        } label: {
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(singleSeries.color.opacity(isEffectivelyVisible ? 1 : 0.35))
                    .frame(width: 16, height: 3)
                Text(singleSeries.name)
                    .lineLimit(1)
            }
            .font(.caption)
            .foregroundColor(isEffectivelyVisible ? NeoGymTheme.mutedText : NeoGymTheme.mutedText.opacity(0.55))
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("\(singleSeries.name) series"))
        .accessibilityValue(Text(isEffectivelyVisible ? "Visible" : "Hidden"))
        .accessibilityHint(Text(isEffectivelyVisible ? "Double-tap to hide this series." : "Double-tap to show this series."))
        .accessibilityAddTraits(isEffectivelyVisible ? .isSelected : [])
    }

    private func axisDescriptor(for axis: TimeSeriesChartAxis) -> ChartAxisDescriptor? {
        let axisSeries = effectiveVisibleSeries.filter { $0.axis == axis }
        guard let firstSeries = axisSeries.first else { return nil }
        let values = axisSeries.flatMap { $0.points.map(\.value) }
        guard let range = timeSeriesChartMetricRange(
            values: values,
            centersOnZero: axisSeries.contains(where: \.centersAxisOnZero)
        ) else { return nil }
        return ChartAxisDescriptor(
            axis: axis,
            range: range,
            color: firstSeries.color,
            formatter: firstSeries.valueFormatter
        )
    }

}
