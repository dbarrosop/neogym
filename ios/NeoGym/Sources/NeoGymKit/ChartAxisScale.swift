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
            let decimals = step >= 1 && step.rounded() == step ? 0 : (step >= 0.1 ? 1 : 2)
            digits = abs(snapped).formatted(.number.precision(.fractionLength(0 ... decimals)).locale(locale))
        }
        if snapped < 0 { return "−" + digits }
        if snapped > 0, min < 0 { return "+" + digits }
        return digits
    }
}

/// Where a chart line should break because readings are missing.
public enum ChartGaps {
    /// Intervals between consecutive (sorted) dates that are longer than
    /// three times the typical spacing and at least three days, so daily
    /// readings break after three missing days and weekly ones after three
    /// missing weeks. Fewer than three dates never break.
    public static func intervals(in dates: [Date]) -> [ClosedRange<Date>] {
        guard dates.count >= 3 else { return [] }
        let pairs = zip(dates, dates.dropFirst())
        let spacings = pairs.map { $1.timeIntervalSince($0) }.sorted()
        let median = spacings[spacings.count / 2]
        let threshold = Swift.max(median * 3, 3 * 86_400)
        return pairs.compactMap { earlier, later in
            later.timeIntervalSince(earlier) > threshold ? earlier ... later : nil
        }
    }
}
