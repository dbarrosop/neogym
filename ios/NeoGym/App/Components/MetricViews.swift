import SwiftUI

/// Card title with an optional trailing link, as on Today's cards.
struct CardHeader: View {
    let title: String
    var linkTitle: String?
    var linkAccessibilityLabel: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title3.weight(.bold))
                .foregroundStyle(NeoGymTheme.text)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: NeoGymTheme.spacingXS)
            if let linkTitle, let action {
                Button(linkTitle, action: action)
                    .font(.body)
                    .foregroundStyle(NeoGymTheme.accentText)
                    .frame(minHeight: NeoGymTheme.minimumTapTarget)
                    .accessibilityLabel(linkAccessibilityLabel ?? linkTitle)
            }
        }
    }
}

/// Label over a value on the inset token.
struct StatTile: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .lineLimit(1)
            Text(value)
                .font(.headline)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .padding(.horizontal, NeoGymTheme.spacingSM)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .insetCard()
        .accessibilityElement(children: .combine)
    }
}

/// Rounded progress track; `fraction` is clamped to 0…1.
struct MeterTrack: View {
    let fraction: Double?
    let color: Color
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(NeoGymTheme.fill)
                if let fraction {
                    Capsule()
                        .fill(color)
                        .frame(width: proxy.size.width * min(max(fraction, 0), 1))
                }
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

/// Labelled macro bar, e.g. "Protein 106 / 184 g".
struct MeterBar: View {
    let label: String
    let value: Double
    let target: Double?
    let color: Color
    let valueLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
            HStack {
                Text(label)
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Spacer(minLength: NeoGymTheme.spacingXS)
                Text(valueLabel)
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.text)
            }
            MeterTrack(fraction: target.flatMap { $0 > 0 ? value / $0 : nil }, color: color)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(valueLabel)
    }
}

/// Circular progress ring with centred content.
struct RingMeter<Center: View>: View {
    let fraction: Double?
    var diameter: CGFloat = 104
    var lineWidth: CGFloat = 10
    let accessibilityText: String
    @ViewBuilder let center: Center

    var body: some View {
        ZStack {
            Circle()
                .stroke(NeoGymTheme.fill, lineWidth: lineWidth)
            if let fraction {
                Circle()
                    .trim(from: 0, to: min(max(fraction, 0), 1))
                    .stroke(NeoGymTheme.accentText, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            center
        }
        .frame(width: diameter, height: diameter)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }
}

/// Coloured square plus label for chart and split-bar legends.
struct LegendItem: View {
    let color: Color
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 8, height: 8)
                .accessibilityHidden(true)
            Text(text)
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
        }
    }
}

/// Large metric with a smaller unit, e.g. "70.85 kg".
struct MetricValueText: View {
    let value: String
    let unit: String?
    var size: Font = .title.weight(.bold)

    var body: some View {
        let valueText = Text(value).font(size).foregroundStyle(NeoGymTheme.text)
        let unitText = Text(unit.map { " \($0)" } ?? "")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(NeoGymTheme.textSecondary)
        Text("\(valueText)\(unitText)")
            .monospacedDigit()
    }
}

enum MetricFormat {
    static func whole(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0)))
    }

    static func signedWhole(_ value: Double) -> String {
        let rounded = value.rounded()
        if rounded == 0 { return "0" }
        return (rounded < 0 ? "−" : "+") + whole(abs(rounded))
    }

    static func decimal(_ value: Double, digits: Int = 1) -> String {
        value.formatted(.number.precision(.fractionLength(digits)))
    }
}

/// Horizontal at normal text sizes, vertical at accessibility sizes, so tiles
/// and paired metrics never truncate under large Dynamic Type.
struct AdaptiveRow<Content: View>: View {
    var spacing: CGFloat = NeoGymTheme.spacingXS
    var alignment: VerticalAlignment = .center
    @ViewBuilder let content: Content
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: spacing) { content }
        } else {
            HStack(alignment: alignment, spacing: spacing) { content }
        }
    }
}
