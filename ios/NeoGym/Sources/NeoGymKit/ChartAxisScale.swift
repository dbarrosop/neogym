import Foundation

/// A chart value axis with three labels (bottom, middle, top) on round
/// values, as in the unified design: `0 · 6 · 12`, `20k · 40k · 60k`,
/// `70 · 71 · 72`. Labels are bare numbers; units live in the chart's title
/// and legend.
public struct ChartAxisScale: Equatable, Sendable {
    /// The bottom of the axis.
    public let min: Double
    /// The distance between labels; the axis spans two steps.
    public let step: Double

    public init(min: Double, step: Double) {
        self.min = min
        self.step = step
    }

    public var mid: Double { min + step }
    public var max: Double { min + 2 * step }

    /// The smallest rounded axis containing `values` (and zero when
    /// `includesZero`), or nil when there are no values.
    public static func rounded(values: [Double], includesZero: Bool = false) -> ChartAxisScale? {
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
        var step = niceStep(atLeast: (high - low) / 2)
        var bottom = (low / step).rounded(.down) * step
        while bottom + 2 * step < high {
            step = niceStep(atLeast: step * 1.000_1)
            bottom = (low / step).rounded(.down) * step
        }
        return ChartAxisScale(min: bottom, step: step)
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

    /// An axis label: grouped digits below 10,000 (`2,000`), thousands as
    /// `k` above (`50k`), and an explicit sign when the axis crosses zero
    /// (`+400`, `−1,200`).
    public func label(_ value: Double, locale: Locale = .current) -> String {
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
