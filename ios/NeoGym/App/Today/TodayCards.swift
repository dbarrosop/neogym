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
                    Text("Yesterday")
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
            CardMessage(text: "No energy logged for yesterday.")
        }
        if let projection = summary.projection {
            Divider().overlay(NeoGymTheme.separator)
            HStack {
                Text("Today so far")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Spacer()
                Text("Burned \(projection.burnedValue(locale: locale)) · Net \(projection.netValue(locale: locale))")
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.text)
            }
            .accessibilityElement(children: .combine)
        }
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
        .accessibilityLabel("Energy out: resting \(MetricFormat.whole(resting)), active \(MetricFormat.whole(active)) kilocalories")
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

    private static func dayLabel(_ isoDay: String) -> String {
        DateOnly.parse(isoDay)?.formatted(.dateTime.day().month(.abbreviated)) ?? isoDay
    }

    @ViewBuilder
    private func content(_ summary: TodayBodySummary) -> some View {
        if let weight = summary.latestWeightKg {
            AdaptiveRow(spacing: NeoGymTheme.spacingMD, alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(weightCaption(summary))
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                    MetricValueText(value: MetricFormat.decimal(weight, digits: 2), unit: "kg")
                    if let average = summary.weekAverageKg {
                        // Neutral: NeoGym has no weight goal, so neither direction is a success.
                        Text(averageText(average, change: summary.weekChangeKg))
                            .font(.footnote.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
                Spacer(minLength: 0)
                if summary.rollingWeights.count >= 2 {
                    Sparkline(values: summary.rollingWeights, accessibilityText: trendLabel(summary))
                        .frame(width: 150, height: 56)
                }
            }
        }
        // Weight and body fat render independently: a body-fat-only reading
        // still shows, and the empty message needs both to be missing.
        if let fat = summary.latestBodyFatPct {
            if summary.latestWeightKg != nil {
                Divider().overlay(NeoGymTheme.separator)
            }
            HStack {
                Text("Body fat")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Spacer()
                Text("\(MetricFormat.decimal(fat)) %")
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.text)
            }
            .accessibilityElement(children: .combine)
        }
        if summary.latestWeightKg == nil, summary.latestBodyFatPct == nil {
            CardMessage(text: "No measurements in the last three weeks.")
        }
    }

    private func weightCaption(_ summary: TodayBodySummary) -> String {
        guard let day = summary.latestWeightOn,
              let date = IntakeGrouping.localDateToDate(day)
        else { return "Weight" }
        return "Weight · \(date.formatted(.dateTime.day().month(.abbreviated)))"
    }

    private func averageText(_ average: Double, change: Double?) -> String {
        let base = "7-day avg \(MetricFormat.decimal(average))"
        guard let change else { return base }
        let sign = change < 0 ? "−" : "+"
        return "\(base) · \(sign)\(MetricFormat.decimal(abs(change))) vs prior week"
    }

    private func trendLabel(_ summary: TodayBodySummary) -> String {
        guard let first = summary.rollingWeights.first, let last = summary.rollingWeights.last else {
            return "Seven-day average weight"
        }
        let direction = last < first ? "down" : last > first ? "up" : "flat"
        return "Seven-day average weight trending \(direction), from \(MetricFormat.decimal(first)) to \(MetricFormat.decimal(last)) kilograms"
    }
}
