import NeoGymKit
import SwiftUI

struct ExerciseSummaryCard: View {
    let exercise: ExerciseDetailModel
    let storageBaseURL: URL
    let isStarting: Bool
    let startError: String?
    let start: () -> Void

    var body: some View {
        SectionShell(title: exercise.name, subtitle: ExerciseFormatters.enumValue(exercise.primaryMuscleGroup)) {
            VStack(alignment: .leading, spacing: 14) {
                muscleBadges
                Button(action: start) {
                    Label(isStarting ? "Starting…" : "Start session", systemImage: isStarting ? "hourglass" : "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymPrimaryButtonStyle())
                .disabled(isStarting)

                if let startError {
                    Text(startError)
                        .font(.caption)
                        .foregroundColor(.red)
                }

                AlternatingStorageImageView(
                    urls: [
                        URL.nhostStorageFile(baseURL: storageBaseURL, fileId: exercise.image1FileId),
                        URL.nhostStorageFile(baseURL: storageBaseURL, fileId: exercise.image2FileId),
                    ].compactMap { $0 }
                )
                ExerciseAttributesView(exercise: exercise)
                ExerciseInstructionsView(instructions: exercise.instructions)
                if exercise.strength?.doubleWeight == true {
                    Text("Two-handed: recorded weight is per side; total volume doubles for session totals.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .padding(NeoGymTheme.spacingSM)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .glassSurface(
                            cornerRadius: NeoGymTheme.radiusMD,
                            material: .ultraThin,
                            tint: NeoGymTheme.glassSubtleFill,
                            shadow: false
                        )
                }
            }
        }
    }

    private var muscleBadges: some View {
        FlowLayout(spacing: 8) {
            BadgeText(ExerciseFormatters.enumValue(exercise.primaryMuscleGroup), prominent: true)
            ForEach(exercise.secondaryMuscleGroups, id: \.muscleGroup) { muscle in
                BadgeText(ExerciseFormatters.enumValue(muscle.muscleGroup))
            }
            BadgeText(exercise.isPublic ? "Public" : "Mine", systemImage: exercise.isPublic ? "globe" : "person")
            if exercise.strength?.doubleWeight == true {
                BadgeText("Two-handed")
            }
        }
    }
}

private struct ExerciseAttributesView: View {
    let exercise: ExerciseDetailModel

    var body: some View {
        let attributes = [
            ("Level", exercise.level),
            ("Category", exercise.category),
            ("Equipment", exercise.equipment),
            ("Force", exercise.strength?.force),
            ("Mechanic", exercise.strength?.mechanic),
        ].compactMap { label, value -> (String, String)? in
            guard let value else { return nil }
            return (label, ExerciseFormatters.enumValue(value))
        }

        if !attributes.isEmpty {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(attributes, id: \.0) { label, value in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(label)
                            .font(.caption2.weight(.semibold))
                            .textCase(.uppercase)
                            .foregroundColor(NeoGymTheme.mutedText)
                        Text(value)
                            .font(.caption.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(NeoGymTheme.spacingSM)
                    .glassSurface(
                        cornerRadius: NeoGymTheme.radiusMD,
                        material: .ultraThin,
                        tint: NeoGymTheme.glassSubtleFill,
                        shadow: false
                    )
                }
            }
        }
    }
}

private struct ExerciseInstructionsView: View {
    let instructions: [String]

    var body: some View {
        if instructions.isEmpty {
            Text("No instructions yet.")
                .font(.subheadline.italic())
                .foregroundColor(NeoGymTheme.mutedText)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(instructions.enumerated()), id: \.offset) { index, instruction in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(index + 1).")
                            .font(.subheadline.monospacedDigit())
                            .foregroundColor(NeoGymTheme.mutedText)
                        Text(instruction)
                            .font(.subheadline)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                }
            }
        }
    }
}

struct StrengthProgressSummary: View {
    let points: [StrengthProgressPoint]
    let doubleWeight: Bool

    var body: some View {
        if points.isEmpty {
            EmptyProgressCard(message: "Log a session to start tracking progress.")
        } else {
            let latest = points[points.count - 1]
            SectionShell(title: "Progress", subtitle: "\(points.count) session\(points.count == 1 ? "" : "s")") {
                VStack(spacing: 12) {
                    HStack(spacing: 12) {
                        ProgressMetricCard(title: "Volume", value: "\(Int(latest.volume.rounded()).formatted()) kg", delta: deltaText(\.volume))
                        ProgressMetricCard(title: "Est. 1RM", value: String(format: "%.1f kg", latest.oneRepMax), delta: deltaText(\.oneRepMax))
                    }
                    MiniTrendView(values: points.map(\.volume))
                    Text(doubleWeight ? "Volume doubles per-side weight." : "Volume is weight × reps across all sets.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
        }
    }

    private func deltaText(_ keyPath: KeyPath<StrengthProgressPoint, Double>) -> String? {
        guard points.count >= 2 else { return nil }
        let current = points[points.count - 1][keyPath: keyPath]
        let previous = points[points.count - 2][keyPath: keyPath]
        guard previous != 0 else { return nil }
        let pct = (current - previous) / previous * 100
        return String(format: "%+.1f%%", pct)
    }
}

struct CardioProgressSummary: View {
    let points: [CardioProgressPoint]
    let primary: CardioMetricSpec

    var body: some View {
        if points.isEmpty {
            EmptyProgressCard(message: "Log a session to start tracking progress.")
        } else {
            let latest = points[points.count - 1]
            let caption = CardioMetricsSchemaHelpers.aggregation(for: primary.format) == .average
                ? "average across entries"
                : "total across entries"
            SectionShell(title: "\(primary.label) per session", subtitle: caption) {
                VStack(spacing: 12) {
                    ProgressMetricCard(title: primary.label, value: CardioMetricsSchemaHelpers.formatMetricValue(latest.value, spec: primary), delta: deltaText)
                    MiniTrendView(values: points.map(\.value))
                }
            }
        }
    }

    private var deltaText: String? {
        guard points.count >= 2 else { return nil }
        let current = points[points.count - 1].value
        let previous = points[points.count - 2].value
        guard previous != 0 else { return nil }
        return String(format: "%+.1f%%", (current - previous) / previous * 100)
    }
}

struct StrengthHistoryList: View {
    let entries: [ExerciseHistoryEntry]
    let doubleWeight: Bool
    let exerciseName: String

    var body: some View {
        HistorySection(count: entries.count) {
            ForEach(entries) { entry in
                VStack(alignment: .leading, spacing: 8) {
                    HistoryHeader(entry: entry, fallbackName: exerciseName)
                    let totalReps = entry.workoutSessionStrengthSets.reduce(0) { $0 + $1.reps }
                    let topWeight = entry.workoutSessionStrengthSets.map(\.weight).max() ?? 0
                    Text("\(entry.workoutSessionStrengthSets.count) sets · \(totalReps) reps" + (topWeight > 0 ? " · top \(topWeight.formatted())\(doubleWeight ? "/side" : "") kg" : ""))
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                    FlowLayout(spacing: 6) {
                        ForEach(entry.workoutSessionStrengthSets) { set in
                            BadgeText("\(set.setNumber). \(set.weight == 0 ? "BW" : "\(set.weight.formatted()) kg") × \(set.reps)")
                        }
                    }
                }
                .historyRowStyle()
            }
        }
    }
}

struct CardioHistoryList: View {
    let entries: [ExerciseHistoryEntry]
    let schema: CardioMetricsSchema
    let exerciseName: String

    var body: some View {
        let specs = CardioMetricsSchemaHelpers.iterateMetrics(schema)
        HistorySection(count: entries.count) {
            ForEach(entries) { entry in
                VStack(alignment: .leading, spacing: 8) {
                    HistoryHeader(entry: entry, fallbackName: exerciseName)
                    Text("\(entry.workoutSessionCardioEntries.count) entr\(entry.workoutSessionCardioEntries.count == 1 ? "y" : "ies")")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                    FlowLayout(spacing: 6) {
                        ForEach(entry.workoutSessionCardioEntries) { cardioEntry in
                            let values = specs.compactMap { spec -> String? in
                                guard let value = cardioEntry.metrics[spec.key] else { return nil }
                                return CardioMetricsSchemaHelpers.formatMetricValue(value, spec: spec)
                            }
                            BadgeText("\(cardioEntry.entryNumber). " + values.joined(separator: " · "))
                        }
                    }
                }
                .historyRowStyle()
            }
        }
    }
}

private struct HistorySection<Content: View>: View {
    let count: Int
    @ViewBuilder let content: Content

    var body: some View {
        if count == 0 {
            EmptyProgressCard(message: "You haven't logged this exercise yet.")
        } else {
            SectionShell(title: "History", subtitle: "\(count) session\(count == 1 ? "" : "s")") {
                VStack(spacing: 10) { content }
            }
        }
    }
}

private struct HistoryHeader: View {
    let entry: ExerciseHistoryEntry
    let fallbackName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.workoutSession.workout?.name ?? fallbackName)
                .font(.subheadline.weight(.semibold))
            if let date = entry.workoutSession.startedAtDate {
                Text(date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
        }
    }
}

private struct EmptyProgressCard: View {
    let message: String

    var body: some View {
        SectionShell(title: "Progress") {
            AppEmptyStateView(title: "No data yet", message: message, systemImage: "chart.line.uptrend.xyaxis")
        }
    }
}

struct CardioSchemaMissingCard: View {
    var body: some View {
        SectionShell(title: "Cardio metrics") {
            AppEmptyStateView(
                title: "Metrics schema missing",
                message: "This cardio exercise needs an admin-configured metrics schema before progress can be shown.",
                systemImage: "exclamationmark.triangle"
            )
        }
    }
}

private struct ProgressMetricCard: View {
    let title: String
    let value: String
    let delta: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Spacer()
                if let delta {
                    Text(delta)
                        .font(.caption.monospacedDigit())
                        .foregroundColor(delta.hasPrefix("+") ? .green : .red)
                }
            }
            Text(value)
                .font(.title3.bold().monospacedDigit())
        }
        .padding(NeoGymTheme.spacingSM)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassFill,
            shadow: false
        )
    }
}

private struct MiniTrendView: View {
    let values: [Double]

    var body: some View {
        GeometryReader { proxy in
            Path { path in
                guard values.count >= 2, let min = values.min(), let max = values.max() else { return }
                let span = max - min == 0 ? 1 : max - min
                for (index, value) in values.enumerated() {
                    let xPosition = proxy.size.width * CGFloat(index) / CGFloat(values.count - 1)
                    let yPosition = proxy.size.height * (1 - CGFloat((value - min) / span))
                    let point = CGPoint(x: xPosition, y: yPosition)
                    if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
            }
            .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
        .frame(height: 90)
        .padding(NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }
}

private struct BadgeText: View {
    let text: String
    var systemImage: String?
    var prominent = false

    init(_ text: String, systemImage: String? = nil, prominent: Bool = false) {
        self.text = text
        self.systemImage = systemImage
        self.prominent = prominent
    }

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage { Image(systemName: systemImage) }
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundColor(prominent ? .white : .primary)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(badgeBackground)
    }

    @ViewBuilder
    private var badgeBackground: some View {
        if prominent {
            Capsule(style: .continuous)
                .fill(NeoGymTheme.primaryActionGradient)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.32), lineWidth: NeoGymTheme.hairline)
                )
        } else {
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(Capsule(style: .continuous).fill(NeoGymTheme.glassSubtleFill))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
        }
    }
}

private struct FlowLayout<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 96), spacing: spacing)],
            alignment: .leading,
            spacing: spacing
        ) {
            content
        }
    }
}

private extension View {
    func historyRowStyle() -> some View {
        padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: NeoGymTheme.glassFill,
                shadow: false
            )
    }
}
