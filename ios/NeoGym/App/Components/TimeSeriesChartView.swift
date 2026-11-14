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
                .foregroundColor(NeoGymTheme.textSecondary)
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
            if showsAxes, let leftAxis {
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

            if showsAxes, let rightAxis {
                yAxisLabels(for: rightAxis)
                    .frame(width: rightAxisWidth, height: plotHeight)
            }
        }
    }

    /// Points sit this far inside the plot, so the axis top and bottom
    /// values (and their grid lines) are not clipped.
    private static let plotInset: CGFloat = 10

    /// No chart border: one separator-colour grid line per axis label
    /// (bottom, middle, top).
    private func chartGrid(size: CGSize) -> some View {
        Path { path in
            let inset = Self.plotInset
            for y in [inset, size.height / 2, size.height - inset] {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
            }
        }
        .stroke(NeoGymTheme.separator, lineWidth: NeoGymTheme.hairline)
    }

    private func plotArea(size: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            if showsAxes {
                chartGrid(size: size)
            }
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

    private func seriesLayer(_ singleSeries: TimeSeriesChartSeries, size: CGSize) -> some View {
        let plotted = plottedPoints(for: singleSeries, size: size)
        let partial = plotted.filter(\.point.isPartial)
        let complete = plotted.filter { !$0.point.isPartial }
        let segments = lineSegments(
            complete,
            gaps: ChartGaps.intervals(in: singleSeries.points.filter { !$0.isPartial }.map(\.date))
        )
        let showsMarkers = complete.count <= maxPointMarkers
        let isReadings = singleSeries.style == .readings

        return Path { path in
            for segment in segments {
                guard let first = segment.first else { continue }
                path.move(to: first.position)
                for point in segment.dropFirst() {
                    path.addLine(to: point.position)
                }
            }
        }
        .stroke(
            singleSeries.color.opacity(isReadings ? 0.5 : 1),
            style: StrokeStyle(lineWidth: isReadings ? 1.5 : 2.5, lineCap: .round, lineJoin: .round)
        )
        .overlay {
            // A reading isolated by gaps has no line, so it always gets a dot.
            ForEach(segments.filter { showsMarkers || $0.count == 1 }.flatMap { $0 }) { plottedPoint in
                Circle()
                    .fill(singleSeries.color.opacity(isReadings ? 0.85 : 1))
                    .frame(width: isReadings ? 5 : 6, height: isReadings ? 5 : 6)
                    .position(plottedPoint.position)
            }
            // A partial value (today so far) is an open dot, off the line.
            ForEach(partial) { plottedPoint in
                Circle()
                    .fill(NeoGymTheme.surface)
                    .overlay(Circle().stroke(singleSeries.color, lineWidth: 1.5))
                    .frame(width: 7, height: 7)
                    .position(plottedPoint.position)
            }
        }
    }

    /// Splits plotted (possibly sampled) points wherever a missing-readings
    /// gap of the full series falls between two neighbours.
    private func lineSegments(_ points: [PlottedChartPoint], gaps: [ClosedRange<Date>]) -> [[PlottedChartPoint]] {
        guard !gaps.isEmpty else { return points.isEmpty ? [] : [points] }
        var segments: [[PlottedChartPoint]] = []
        var current: [PlottedChartPoint] = []
        for point in points {
            if let previous = current.last {
                let spansGap = gaps.contains { gap in
                    gap.lowerBound >= previous.point.date && gap.upperBound <= point.point.date
                }
                if spansGap {
                    segments.append(current)
                    current = []
                }
            }
            current.append(point)
        }
        if !current.isEmpty { segments.append(current) }
        return segments
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
            HStack(spacing: 4) {
                Circle().fill(plottedPoint.color).frame(width: 6, height: 6)
                Text(plottedPoint.point.isPartial ? "\(plottedPoint.seriesName) · so far" : plottedPoint.seriesName)
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(NeoGymTheme.textSecondary)
            }
            Text(plottedPoint.formattedValue)
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundStyle(NeoGymTheme.text)
            Text(timeSeriesChartCalloutDateFormatter.string(from: plottedPoint.point.date))
                .font(.caption2)
                .foregroundColor(NeoGymTheme.textSecondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .cardSurface(
            cornerRadius: NeoGymTheme.radiusSM,
            fill: NeoGymTheme.inset,
            stroke: NeoGymTheme.separator
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
        let scale = axisDescriptor(for: series.axis)?.scale
            ?? ChartAxisScale.rounded(values: series.points.map(\.value), includesZero: series.includesZero)
            ?? ChartAxisScale(min: points[0].value - 1, step: 1)
        let horizontalSpan = max(maxX - minX, 1)
        let verticalSpan = max(scale.max - scale.min, 0.000_001)
        let inset = Self.plotInset
        let width = max(size.width - inset * 2, 1)
        let height = max(size.height - inset * 2, 1)

        return points.map { point in
            let time = point.date.timeIntervalSince1970
            let xPosition = inset + CGFloat((time - minX) / horizontalSpan) * width
            let yRatio = (point.value - scale.min) / verticalSpan
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
        // Each label is centred on its grid line (see `chartGrid`).
        GeometryReader { proxy in
            let inset = Self.plotInset
            let rows: [(Double, CGFloat)] = [
                (axis.scale.max, inset),
                (axis.scale.mid, proxy.size.height / 2),
                (axis.scale.min, proxy.size.height - inset)
            ]
            ForEach(rows, id: \.1) { value, y in
                Text(axis.scale.label(value))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(width: proxy.size.width, alignment: axis.axis == .left ? .trailing : .leading)
                    .position(x: proxy.size.width / 2, y: y)
            }
        }
        .font(.caption2.monospacedDigit())
        .foregroundStyle(NeoGymTheme.textSecondary)
    }

    private var xAxisLabels: some View {
        let sortedPoints = allPoints.sorted { $0.date < $1.date }
        return HStack(alignment: .top) {
            Text(sortedPoints.first.map { timeSeriesChartAxisDateFormatter.string(from: $0.date) } ?? "")
            Spacer(minLength: 4)
            if sortedPoints.count > 2 {
                Text(timeSeriesChartAxisDateFormatter.string(from: sortedPoints[sortedPoints.count / 2].date))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(sortedPoints.last.map { timeSeriesChartAxisDateFormatter.string(from: $0.date) } ?? "")
        }
        .font(.caption2)
        .foregroundColor(NeoGymTheme.textSecondary)
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
                LegendSwatch(color: singleSeries.color, style: singleSeries.style)
                    .opacity(isEffectivelyVisible ? 1 : 0.35)
                Text(singleSeries.name)
                    .lineLimit(1)
            }
            .font(.caption)
            .foregroundColor(isEffectivelyVisible ? NeoGymTheme.textSecondary : NeoGymTheme.textSecondary.opacity(0.55))
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
        guard !axisSeries.isEmpty else { return nil }
        let values = axisSeries.flatMap { $0.points.map(\.value) }
        guard let scale = ChartAxisScale.rounded(
            values: values,
            includesZero: axisSeries.contains(where: \.includesZero)
        ) else { return nil }
        return ChartAxisDescriptor(axis: axis, scale: scale)
    }

}

/// A legend key drawn like its series: a solid bar for a line, a faint bar
/// with a dot for daily readings.
struct LegendSwatch: View {
    let color: Color
    var style: TimeSeriesChartSeriesStyle = .line

    var body: some View {
        switch style {
        case .line:
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 16, height: 3)
        case .readings:
            ZStack {
                Capsule().fill(color.opacity(0.5)).frame(width: 16, height: 2)
                Circle().fill(color).frame(width: 6, height: 6)
            }
            .frame(width: 16, height: 8)
        }
    }
}
