import Foundation

/// How a value axis prints its labels: the same notation as the series'
/// values, callouts and spoken summary.
public enum ChartAxisValueFormat: Equatable, Sendable {
    /// Bare grouped numbers (`2,000`, `50k`); units live in the title and legend.
    case number
    /// Seconds, labelled m:ss (h:mm:ss past an hour) on whole-minute ticks
    /// (`20:00 · 30:00 · 40:00`), never raw seconds.
    case durationSeconds
}

/// A chart value axis with three labels (bottom, middle, top) on round
/// values, as in the unified design: `0 · 6 · 12`, `20k · 40k · 60k`,
/// `70 · 71 · 72`. Labels are bare numbers, units living in the chart's title
/// and legend, except durations, which use the values' m:ss notation.
public struct ChartAxisScale: Equatable, Sendable {
    /// The bottom of the axis.
    public let min: Double
    /// The distance between labels; the axis spans two steps.
    public let step: Double
    public let format: ChartAxisValueFormat

    public init(min: Double, step: Double, format: ChartAxisValueFormat = .number) {
        self.min = min
        self.step = step
        self.format = format
    }

    public var mid: Double { min + step }
    public var max: Double { min + 2 * step }

    /// The smallest rounded axis containing `values` (and zero when
    /// `includesZero`), or nil when there are no values. Durations step in
    /// whole minutes (1, 2, 5, 10, 15, 20, 30 or 60) or, past that, hours.
    public static func rounded(
        values: [Double],
        includesZero: Bool = false,
        format: ChartAxisValueFormat = .number
    ) -> ChartAxisScale? {
        let finite = values.filter(\.isFinite)
        guard var low = finite.min(), var high = finite.max() else { return nil }
        if includesZero {
            low = Swift.min(low, 0)
            high = Swift.max(high, 0)
        }
        if low == high {
            let padding = Swift.max(abs(low) * 0.05, 1)
            if !(includesZero && low == 0) { low -= padding }
            high += padding
        }
        var step = niceStep(atLeast: (high - low) / 2, format: format)
        var bottom = (low / step).rounded(.down) * step
        while bottom + 2 * step < high {
            step = niceStep(atLeast: step * 1.000_1, format: format)
            bottom = (low / step).rounded(.down) * step
        }
        return ChartAxisScale(min: bottom, step: step, format: format)
    }

    /// Scales for two measures sharing a chart on left and right axes
    /// (exercise volume and Est. 1RM, weight and body fat): each fits its own
    /// data, and both first values sit at the same height so their movement
    /// can be compared. Values are in date order; the labels come out less
    /// round than `rounded` (4.8k · 3.7k · 2.6k).
    public static func startAligned(_ first: [Double], _ second: [Double]) -> (ChartAxisScale, ChartAxisScale)? {
        let firstValues = first.filter(\.isFinite)
        let secondValues = second.filter(\.isFinite)
        guard let firstStart = firstValues.first, let secondStart = secondValues.first else { return nil }
        let firstSpread = spread(firstValues, from: firstStart)
        let secondSpread = spread(secondValues, from: secondStart)
        // Where each start falls within its own data, averaged, keeps both
        // lines using most of the height.
        let natural = [firstSpread, secondSpread].compactMap { spread -> Double? in
            let total = spread.below + spread.above
            return total > 0 ? spread.below / total : nil
        }
        let average = natural.isEmpty ? 0.5 : natural.reduce(0, +) / Double(natural.count)
        let fraction = Swift.min(Swift.max(average, 0.1), 0.9)
        func scale(start: Double, spread: (below: Double, above: Double)) -> ChartAxisScale {
            var range = Swift.max(spread.below / fraction, spread.above / (1 - fraction))
            if range <= 0 { range = Swift.max(abs(start) * 0.1, 1) }
            return ChartAxisScale(min: start - fraction * range, step: range / 2)
        }
        return (scale(start: firstStart, spread: firstSpread), scale(start: secondStart, spread: secondSpread))
    }

    private static func spread(_ values: [Double], from start: Double) -> (below: Double, above: Double) {
        (start - (values.min() ?? start), (values.max() ?? start) - start)
    }

    /// The smallest 1, 2, 2.5 or 5 × 10ⁿ that is at least `value`.
    static func niceStep(atLeast value: Double) -> Double {
        guard value > 0, value.isFinite else { return 1 }
        let base = pow(10, (log10(value)).rounded(.down))
        let fraction = value / base
        let nice: Double = switch fraction {
        case ...1: 1
        case ...2: 2
        case ...2.5: 2.5
        case ...5: 5
        default: 10
        }
        return nice * base
    }

    private static func niceStep(atLeast value: Double, format: ChartAxisValueFormat) -> Double {
        switch format {
        case .number: niceStep(atLeast: value)
        case .durationSeconds: niceDurationStep(atLeast: value)
        }
    }

    /// A whole-minute duration step in seconds of at least `value`.
    static func niceDurationStep(atLeast value: Double) -> Double {
        let minutes: [Double] = [1, 2, 5, 10, 15, 20, 30, 60]
        if let step = minutes.map({ $0 * 60 }).first(where: { $0 >= value }) { return step }
        return niceStep(atLeast: value / 3_600) * 3_600
    }

    /// An axis label: grouped digits below 10,000 (`2,000`), thousands as
    /// `k` above (`50k`), and an explicit sign when the axis crosses zero
    /// (`+400`, `−1,200`). Durations read `35:00`, and every label reads
    /// h:mm:ss once the axis reaches an hour (`0:00:00 · 2:00:00 · 4:00:00`).
    public func label(_ value: Double, locale: Locale = .current) -> String {
        if format == .durationSeconds {
            let seconds = Swift.max(value.rounded(), 0)
            if max >= 3_600, seconds < 3_600 {
                let whole = Int(seconds)
                return String(format: "0:%02d:%02d", whole / 60, whole % 60)
            }
            return CardioMetricsSchemaHelpers.formatSecondsAsDuration(seconds)
        }
        let magnitude = Swift.max(abs(min), abs(max))
        let snapped = abs(value) < step * 1e-6 ? 0 : value
        let digits: String
        if magnitude >= 10_000 {
            digits = (abs(snapped) / 1000).formatted(
                .number.precision(.fractionLength(0 ... 1)).grouping(.never).locale(locale)
            ) + "k"
        } else {
            // Start-aligned steps are not round: whole numbers from a step of 5.
            let decimals = step >= 5 || (step >= 1 && step.rounded() == step) ? 0 : (step >= 0.1 ? 1 : 2)
            digits = abs(snapped).formatted(.number.precision(.fractionLength(0 ... decimals)).locale(locale))
        }
        if snapped < 0 { return "−" + digits }
        if snapped > 0, min < 0 { return "+" + digits }
        return digits
    }
}
