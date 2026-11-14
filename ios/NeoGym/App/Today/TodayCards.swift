import NeoGymKit
import SwiftUI

/// A Today card: surface fill, card radius, 16 pt padding.
private struct TodayCard<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            content
        }
        .padding(NeoGymTheme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }
}

private struct CardMessage: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(NeoGymTheme.textSecondary)
    }
}

// MARK: - Training

struct TodayTrainingCard: View {
    let state: Loadable<TodayTrainingSummary>
    let retry: () -> Void
    let openSession: (String) -> Void
    let openSessions: () -> Void
    let startSession: () -> Void

    var body: some View {
        TodayCard(label: "Training") {
            CardHeader(title: "Training", linkTitle: "Sessions", linkAccessibilityLabel: "Open sessions", action: openSessions)
            if let summary = state.value {
                if summary.sessions.isEmpty {
                    emptyDay(summary)
                } else {
                    ForEach(summary.sessions) { session in
                        sessionBlock(session, recentCount: summary.recentCount)
                    }
                }
            } else if let message = state.errorMessage {
                AppErrorStateView(title: "Couldn't load training", message: message, retry: retry)
            } else {
                ProgressView().frame(maxWidth: .infinity, minHeight: 60)
            }
        }
    }

    private func sessionBlock(_ session: TodaySessionSummary, recentCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Button {
                openSession(session.id)
            } label: {
                HStack(spacing: NeoGymTheme.spacingSM) {
                    Image(systemName: "dumbbell.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.accentText)
                        .frame(width: 44, height: 44)
                        .background(RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM).fill(NeoGymTheme.accentSoft))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(session.name)
                            .font(.headline)
                            .foregroundStyle(NeoGymTheme.text)
                            .lineLimit(2)
                        Text(sessionCaption(session))
                            .font(.footnote)
                            .monospacedDigit()
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.textTertiary)
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the session")
            AdaptiveRow {
                StatTile(label: "Volume", value: "\(MetricFormat.whole(session.totals.volume)) kg")
                StatTile(label: "Sets", value: "\(session.totals.sets)")
                StatTile(label: "Last 7 days", value: sessionsCount(recentCount))
            }
        }
    }

    private func emptyDay(_ summary: TodayTrainingSummary) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            CardMessage(text: "No session logged yet today.")
            if let latest = summary.latest {
                Button {
                    openSession(latest.id)
                } label: {
                    HStack(spacing: NeoGymTheme.spacingSM) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Last session")
                                .font(.footnote)
                                .foregroundStyle(NeoGymTheme.textSecondary)
                            Text(latest.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(NeoGymTheme.text)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        if let started = latest.startedAt {
                            Text(started.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))
                                .font(.footnote)
                                .monospacedDigit()
                                .foregroundStyle(NeoGymTheme.textSecondary)
                        }
                    }
                    .padding(.horizontal, NeoGymTheme.spacingSM)
                    .padding(.vertical, 10)
                    .frame(minHeight: NeoGymTheme.minimumTapTarget)
                    .insetCard()
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the session")
            }
            AdaptiveRow {
                StatTile(label: "Last 7 days", value: sessionsCount(summary.recentCount))
                Button(action: startSession) {
                    Label("Start session", systemImage: "play.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(NeoGymTheme.accent)
                .buttonBorderShape(.roundedRectangle(radius: NeoGymTheme.radiusMD))
            }
        }
    }

    private func sessionCaption(_ session: TodaySessionSummary) -> String {
        var parts: [String] = []
        if let started = session.startedAt { parts.append(started.formatted(date: .omitted, time: .shortened)) }
        parts.append("\(session.exerciseCount) exercise\(session.exerciseCount == 1 ? "" : "s")")
        parts.append("\(session.totals.sets) sets")
        parts.append("\(session.totals.reps) reps")
        return parts.joined(separator: " · ")
    }

    private func sessionsCount(_ count: Int) -> String {
        "\(count) session\(count == 1 ? "" : "s")"
    }
}

// MARK: - Nutrition

struct TodayNutritionCard: View {
    let summary: TodayNutritionSummary?
    let isLoading: Bool
    let errorMessage: String?
    let loggingSlotKey: String?
    let slotError: String?
    let openLog: () -> Void
    let logSlot: (TodayPlannedSlot) -> Void

    var body: some View {
        TodayCard(label: "Nutrition") {
            CardHeader(title: "Nutrition", linkTitle: "Log", linkAccessibilityLabel: "Open nutrition log", action: openLog)
            if let summary {
                content(summary)
            } else if let errorMessage {
                AppErrorStateView(title: "Couldn't load nutrition", message: errorMessage, retry: nil)
            } else if isLoading {
                ProgressView().frame(maxWidth: .infinity, minHeight: 104)
            }
        }
    }

    @ViewBuilder
    private func content(_ summary: TodayNutritionSummary) -> some View {
        AdaptiveRow(spacing: NeoGymTheme.spacingMD) {
            RingMeter(
                fraction: summary.planned.flatMap { $0.kcal > 0 ? summary.eaten.kcal / $0.kcal : nil },
                accessibilityText: ringLabel(summary)
            ) {
                VStack(spacing: 0) {
                    Text(MetricFormat.whole(summary.eaten.kcal))
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.text)
                    Text(summary.planned.map { "of \(MetricFormat.whole($0.kcal))" } ?? "kcal")
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
            }
            VStack(spacing: 10) {
                macroBar("Protein", summary.eaten.protein, summary.planned?.protein, NeoGymTheme.accent)
                macroBar("Carbs", summary.eaten.carbs, summary.planned?.carbs, NeoGymTheme.series2)
                macroBar("Fat", summary.eaten.fat, summary.planned?.fat, NeoGymTheme.textSecondary)
            }
        }
        if let plan = summary.planName {
            if let next = summary.nextSlot {
                nextSlotRow(next, planName: plan)
            } else {
                CardMessage(text: "Plan “\(plan)”: nothing left to log today.")
            }
        } else if !summary.hasDay {
            CardMessage(text: "Nothing logged yet today.")
        }
        if let slotError {
            FeedbackBanner(message: slotError)
        }
    }

    private func nextSlotRow(_ next: TodayPlannedSlot, planName: String) -> some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Next in plan “\(planName)”")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Text("\(next.label) · \(next.countLabel) · \(MetricFormat.whole(next.kcal)) kcal")
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.text)
            }
            Spacer(minLength: 0)
            Button {
                logSlot(next)
            } label: {
                if loggingSlotKey == next.key {
                    ProgressView().controlSize(.small)
                } else {
                    Text("Log")
                }
            }
            .font(.subheadline.weight(.semibold))
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(NeoGymTheme.accent)
            .disabled(loggingSlotKey != nil)
            .accessibilityLabel("Log \(next.label) from plan")
        }
        .padding(.horizontal, NeoGymTheme.spacingSM)
        .padding(.vertical, 10)
        .insetCard()
    }

    private func macroBar(_ label: String, _ value: Double, _ target: Double?, _ color: Color) -> some View {
        MeterBar(
            label: label,
            value: value,
            target: target,
            color: color,
            valueLabel: target.map { "\(MetricFormat.whole(value)) / \(MetricFormat.whole($0)) g" }
                ?? "\(MetricFormat.whole(value)) g"
        )
    }

    private func ringLabel(_ summary: TodayNutritionSummary) -> String {
        if let planned = summary.planned {
            return "\(MetricFormat.whole(summary.eaten.kcal)) of \(MetricFormat.whole(planned.kcal)) planned kilocalories"
        }
        return "\(MetricFormat.whole(summary.eaten.kcal)) kilocalories logged"
    }
}

// MARK: - Balance

struct TodayBalanceCard: View {
    let summary: TodayBalanceSummary?
    let errorMessage: String?
    let openEnergy: () -> Void
    @Environment(\.locale) private var locale

    var body: some View {
        TodayCard(label: "Energy balance") {
            CardHeader(title: "Balance", linkTitle: "Energy", linkAccessibilityLabel: "Open energy", action: openEnergy)
            if let summary {
                content(summary)
            } else if let errorMessage {
                AppErrorStateView(title: "Couldn't load balance", message: errorMessage, retry: nil)
            } else {
                ProgressView().frame(maxWidth: .infinity, minHeight: 60)
            }
        }
    }

    @ViewBuilder
    private func content(_ summary: TodayBalanceSummary) -> some View {
        if let net = summary.net, let out = summary.caloriesOut {
            AdaptiveRow(spacing: NeoGymTheme.spacingSM, alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(soFarCaption(summary))
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                    MetricValueText(value: MetricFormat.signedWhole(net), unit: "kcal")
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("In \(MetricFormat.whole(summary.caloriesIn))")
                    Text("Out \(MetricFormat.whole(out))")
                }
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
            }
            .accessibilityElement(children: .combine)
            if out > 0 {
                splitBar(resting: summary.restingKcal, active: summary.activeKcal)
                HStack(spacing: NeoGymTheme.spacingMD) {
                    LegendItem(color: NeoGymTheme.accent, text: "Resting \(MetricFormat.whole(summary.restingKcal))")
                    LegendItem(color: NeoGymTheme.series2, text: "Active \(MetricFormat.whole(summary.activeKcal))")
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 2) {
                CardMessage(text: "No energy recorded yet today.")
                Text("In \(MetricFormat.whole(summary.caloriesIn)) kcal so far")
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            .accessibilityElement(children: .combine)
        }
        if let projection = summary.projection {
            Divider().overlay(NeoGymTheme.separator)
            VStack(alignment: .leading, spacing: 6) {
                Text("By end of day, estimated")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                HStack(spacing: 20) {
                    estimate("Burned", projection.burnedValue(locale: locale, includesUnit: false))
                    estimate("Net", projection.netValue(locale: locale, includesUnit: false))
                }
                Text("Net counts only food logged so far.")
                    .font(.caption)
                    .foregroundStyle(NeoGymTheme.textTertiary)
            }
            .accessibilityElement(children: .combine)
        }
    }

    /// "Today so far · 13:40": the time today's energy was last recorded.
    private func soFarCaption(_ summary: TodayBalanceSummary) -> String {
        guard let updated = summary.energyUpdatedAt else { return "Today so far" }
        return "Today so far · \(updated.formatted(date: .omitted, time: .shortened))"
    }

    private func estimate(_ label: String, _ value: String) -> some View {
        Text("\(Text(label).font(.footnote).foregroundStyle(NeoGymTheme.textSecondary)) \(Text(value).fontWeight(.semibold))")
            .font(.subheadline)
            .monospacedDigit()
            .foregroundStyle(NeoGymTheme.text)
    }

    private func splitBar(resting: Double, active: Double) -> some View {
        GeometryReader { proxy in
            let total = max(resting + active, 1)
            HStack(spacing: 2) {
                Capsule().fill(NeoGymTheme.accent)
                    .frame(width: max(0, (proxy.size.width - 2) * resting / total))
                Capsule().fill(NeoGymTheme.series2)
            }
        }
        .frame(height: 10)
        .accessibilityElement()
        .accessibilityLabel("Out so far: resting \(MetricFormat.whole(resting)), active \(MetricFormat.whole(active)) kilocalories")
    }
}

// MARK: - Body

struct TodayBodyCard: View {
    let summary: TodayBodySummary?
    let errorMessage: String?
    /// Set while an older cached range stands in for the current one.
    var cachedThrough: String?
    let healthStatus: String?
    let openTrend: () -> Void

    var body: some View {
        TodayCard(label: "Body") {
            CardHeader(title: "Body", linkTitle: "Trend", linkAccessibilityLabel: "Open body trend", action: openTrend)
            if let summary {
                content(summary)
                if let cachedThrough {
                    Text("Saved data through \(Self.dayLabel(cachedThrough)); newer readings may be missing.")
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
            } else if let errorMessage {
                AppErrorStateView(title: "Couldn't load body measurements", message: errorMessage, retry: nil)
            } else {
                ProgressView().frame(maxWidth: .infinity, minHeight: 60)
            }
            if let healthStatus {
                Text(healthStatus)
                    .font(.caption)
                    .foregroundStyle(NeoGymTheme.textTertiary)
            }
        }
    }

    static func dayLabel(_ isoDay: String) -> String {
        DateOnly.parse(isoDay)?.formatted(.dateTime.day().month(.abbreviated)) ?? isoDay
    }

    @ViewBuilder
    private func content(_ summary: TodayBodySummary) -> some View {
        if summary.isEmpty {
            CardMessage(text: "No measurements in the last three weeks.")
        } else {
            TodayBodyChart(weight: summary.weight.readings, bodyFat: summary.bodyFat.readings)
            Divider().overlay(NeoGymTheme.separator)
            // Weight and body fat render independently: a body-fat-only
            // reading still shows. Both stay neutral: NeoGym has no weight goal.
            AdaptiveRow(spacing: NeoGymTheme.spacingMD, alignment: .top) {
                if summary.weight.latest != nil {
                    metricColumn("Weight", summary.weight, unit: "kg", digits: 2, color: NeoGymTheme.accentText)
                }
                if summary.bodyFat.latest != nil {
                    metricColumn("Body fat", summary.bodyFat, unit: "%", digits: 1, color: NeoGymTheme.textSecondary)
                }
            }
        }
    }

    private func metricColumn(
        _ title: String, _ metric: TodayBodyMetric, unit: String, digits: Int, color: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Capsule().fill(color).frame(width: 12, height: 3)
                    .accessibilityHidden(true)
                Text(caption(title, metric))
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            MetricValueText(value: MetricFormat.decimal(metric.latest?.value ?? 0, digits: digits), unit: unit)
            if let average = metric.weekAverage {
                Text("7-day avg \(MetricFormat.decimal(average))")
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            if let change = metric.weekChange {
                Text("\(change < 0 ? "−" : "+")\(MetricFormat.decimal(abs(change))) vs prior week")
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func caption(_ title: String, _ metric: TodayBodyMetric) -> String {
        guard let day = metric.latest?.day else { return title }
        return "\(title) · \(Self.dayLabel(day))"
    }
}

/// Weight (accent) and body fat (neutral) as two lines in their own bands,
/// broken where readings are missing, with the first and last dates below.
/// No value axis: the columns underneath carry the numbers.
private struct TodayBodyChart: View {
    let weight: [TodayBodyReading]
    let bodyFat: [TodayBodyReading]

    private var days: [String] { (weight + bodyFat).map(\.day).sorted() }

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { proxy in
                ZStack {
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: proxy.size.height - 0.5))
                        path.addLine(to: CGPoint(x: proxy.size.width, y: proxy.size.height - 0.5))
                    }
                    .stroke(NeoGymTheme.separator, lineWidth: NeoGymTheme.hairline)
                    series(weight, band: band(for: .weight, height: proxy.size.height), width: proxy.size.width,
                           color: NeoGymTheme.accentText)
                    series(bodyFat, band: band(for: .bodyFat, height: proxy.size.height), width: proxy.size.width,
                           color: NeoGymTheme.textSecondary)
                }
            }
            .frame(height: 100)
            if let first = days.first, let last = days.last {
                HStack {
                    Text(TodayBodyCard.dayLabel(first))
                    Spacer()
                    if last != first { Text(TodayBodyCard.dayLabel(last)) }
                }
                .font(.caption2)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textTertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    private enum Metric { case weight, bodyFat }

    /// Weight above body fat when both exist; one metric uses the full height.
    private func band(for metric: Metric, height: CGFloat) -> ClosedRange<CGFloat> {
        let inset: CGFloat = 6
        guard !weight.isEmpty, !bodyFat.isEmpty else { return inset ... height - inset }
        let middle = height / 2
        return metric == .weight ? inset ... middle - 4 : middle + 4 ... height - inset
    }

    private func series(
        _ readings: [TodayBodyReading], band: ClosedRange<CGFloat>, width: CGFloat, color: Color
    ) -> some View {
        let dated = readings.compactMap { reading in
            IntakeGrouping.localDateToDate(reading.day).map { (date: $0, value: reading.value) }
        }
        let gaps = ChartGaps.intervals(in: dated.map(\.date))
        let values = dated.map(\.value)
        let low = values.min() ?? 0
        let high = values.max() ?? 0
        let domain = dateDomain
        func point(_ entry: (date: Date, value: Double)) -> CGPoint {
            let span = domain.upperBound.timeIntervalSince(domain.lowerBound)
            let x = span > 0 ? CGFloat(entry.date.timeIntervalSince(domain.lowerBound) / span) * (width - 8) + 4 : width / 2
            let ratio = high > low ? (entry.value - low) / (high - low) : 0.5
            let y = band.upperBound - CGFloat(ratio) * (band.upperBound - band.lowerBound)
            return CGPoint(x: x, y: y)
        }
        var segments: [[CGPoint]] = []
        var current: [CGPoint] = []
        var previous: Date?
        for entry in dated {
            if let previous, gaps.contains(where: { $0.lowerBound >= previous && $0.upperBound <= entry.date }) {
                segments.append(current)
                current = []
            }
            current.append(point(entry))
            previous = entry.date
        }
        if !current.isEmpty { segments.append(current) }
        return ZStack {
            Path { path in
                for segment in segments where segment.count > 1 {
                    path.addLines(segment)
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
            ForEach(Array(segments.filter { $0.count == 1 }.enumerated()), id: \.offset) { _, segment in
                Circle().fill(color).frame(width: 5, height: 5).position(segment[0])
            }
        }
    }

    private var dateDomain: ClosedRange<Date> {
        let dates = days.compactMap { IntakeGrouping.localDateToDate($0) }
        guard let first = dates.first, let last = dates.last else { return Date() ... Date() }
        return first ... last
    }

    private var accessibilityText: String {
        guard let first = days.first, let last = days.last else { return "No body measurements" }
        var parts = ["Weight and body fat from \(TodayBodyCard.dayLabel(first)) to \(TodayBodyCard.dayLabel(last))"]
        if let start = weight.first, let end = weight.last {
            parts.append("weight \(MetricFormat.decimal(start.value, digits: 2)) to \(MetricFormat.decimal(end.value, digits: 2)) kilograms")
        }
        if let start = bodyFat.first, let end = bodyFat.last {
            parts.append("body fat \(MetricFormat.decimal(start.value)) to \(MetricFormat.decimal(end.value)) percent")
        }
        return parts.joined(separator: ", ")
    }
}
