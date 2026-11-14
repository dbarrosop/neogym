import NeoGymKit
import SwiftUI

struct SessionExerciseCardActions {
    let toggle: () -> Void
    let remove: () -> Void
}

/// Strength exercise: one summary line when collapsed; logged sets with a
/// per-set "last time" and the inline next-set row when open.
struct StrengthExerciseCard: View {
    let row: SessionExerciseRow
    let index: Int
    let isExpanded: Bool
    let lastTime: SessionPriorStrengthEntry?
    /// Up to three earlier sessions with sets, newest first, for the open card.
    let recent: [SessionPriorStrengthEntry]
    @Binding var draft: NextSetDraft
    let isLogging: Bool
    let isMutating: Bool
    let actions: SessionExerciseCardActions
    let onLog: () -> Void
    let onEditSet: (SessionStrengthSet) -> Void
    let onEditDraft: (NextSetDraft) -> Void

    private var sets: [SessionStrengthSet] {
        row.workoutSessionStrengthSets.sorted { $0.setNumber < $1.setNumber }
    }

    private var status: SessionExerciseStatus {
        SessionLogging.strengthStatus(sets: sets, lastTime: lastTime)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ExerciseCardHeader(
                row: row,
                index: index,
                status: status,
                isExpanded: isExpanded,
                meta: row.exercise.doubleWeight ? "per side" : nil,
                actions: actions
            )
            if isExpanded {
                SessionExerciseMedia(exercise: row.exercise, recent: recent)
                ForEach(Array(sets.enumerated()), id: \.element.id) { offset, set in
                    loggedSetRow(set, lastTimeSet: SessionLogging.lastTimeSet(at: offset, lastTime: lastTime))
                }
                nextSetRow
            } else {
                collapsedLine
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 14)
        .cardSurface()
        .overlay {
            if isExpanded {
                RoundedRectangle(cornerRadius: NeoGymTheme.radiusXL, style: .continuous)
                    .strokeBorder(NeoGymTheme.accent, lineWidth: 2)
            }
        }
    }

    private var collapsedLine: some View {
        Button(action: actions.toggle) {
            HStack(alignment: .firstTextBaseline, spacing: NeoGymTheme.spacingXS) {
                Text(SessionLogging.collapsedSummary(sets: sets, lastTime: lastTime))
                    .font(sets.isEmpty ? .subheadline : .subheadline.weight(.semibold))
                    .foregroundStyle(sets.isEmpty ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                    .lineLimit(2)
                Spacer(minLength: NeoGymTheme.spacingXS)
                if !sets.isEmpty, let trailing = SessionLogging.lastTimeTrailing(lastTime) {
                    Text(trailing)
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                        .lineLimit(1)
                }
            }
            .monospacedDigit()
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens \(row.exercise.name) to log sets")
    }

    private func loggedSetRow(_ set: SessionStrengthSet, lastTimeSet: SessionStrengthSet?) -> some View {
        Button {
            onEditSet(set)
        } label: {
            HStack(spacing: 10) {
                Text("\(set.setNumber)")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .frame(minWidth: 18)
                Text(StrengthSetFormatting.setSummary(set, doubleWeight: row.exercise.doubleWeight, includeSideSuffix: false))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.text)
                Spacer(minLength: NeoGymTheme.spacingXS)
                Text("last \(StrengthSetFormatting.lastTimeCell(lastTimeSet))")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                Image(systemName: "checkmark")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(NeoGymTheme.positive)
                    .accessibilityHidden(true)
            }
            .monospacedDigit()
            .padding(.horizontal, 10)
            .frame(minHeight: NeoGymTheme.minimumTapTarget)
            .insetCard(cornerRadius: NeoGymTheme.radiusSM)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(setAccessibilityLabel(set, lastTimeSet: lastTimeSet))
        .accessibilityHint("Edit or delete this set")
    }

    private var nextSetNumber: Int { StrengthSetNumbering.nextSetNumber(currentSets: sets) }

    private var nextSetRow: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            HStack {
                Text("Set \(nextSetNumber)")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(NeoGymTheme.accentText)
                Spacer()
                Text("last \(StrengthSetFormatting.lastTimeCell(SessionLogging.lastTimeSet(at: sets.count, lastTime: lastTime)))")
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            AdaptiveRow(spacing: NeoGymTheme.spacingXS) {
                ValueStepper(
                    value: draft.weightLabel,
                    minWidth: 52,
                    decrementLabel: "Less weight",
                    incrementLabel: "More weight",
                    accessibilityName: "Weight for set \(nextSetNumber)",
                    onDecrement: { draft.stepWeight(-1) },
                    onIncrement: { draft.stepWeight(1) },
                    onTapValue: { onEditDraft(draft) }
                )
                ValueStepper(
                    value: "\(draft.reps)",
                    minWidth: 28,
                    decrementLabel: "Fewer reps",
                    incrementLabel: "More reps",
                    accessibilityName: "Reps for set \(nextSetNumber)",
                    onDecrement: { draft.stepReps(-1) },
                    onIncrement: { draft.stepReps(1) },
                    onTapValue: { onEditDraft(draft) }
                )
                Spacer(minLength: 0)
                Button(action: onLog) {
                    if isLogging {
                        ProgressView().controlSize(.small).frame(minWidth: 36)
                    } else {
                        Text("Log").fixedSize()
                    }
                }
                .layoutPriority(1)
                .font(.body.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: NeoGymTheme.radiusSM))
                .controlSize(.large)
                .tint(NeoGymTheme.accent)
                .disabled(isMutating)
                .accessibilityLabel("Log set \(nextSetNumber)")
            }
            if row.exercise.doubleWeight, draft.weight > 0 {
                Text("Weight per side · \(MetricFormat.whole(draft.volume(doubleWeight: true))) kg volume")
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textTertiary)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: NeoGymTheme.radiusMD, style: .continuous)
                .strokeBorder(NeoGymTheme.accent, lineWidth: 1.5)
        )
    }

    private func setAccessibilityLabel(_ set: SessionStrengthSet, lastTimeSet: SessionStrengthSet?) -> String {
        let summary = StrengthSetFormatting.setSummary(set, doubleWeight: row.exercise.doubleWeight, includeSideSuffix: true)
        let last = lastTimeSet.map { ", last time \(StrengthSetFormatting.lastTimeCell($0))" } ?? ""
        return "Set \(set.setNumber), \(summary)\(last)"
    }
}

/// Cardio exercise: entries open the schema-driven sheet.
struct CardioExerciseCard: View {
    let row: SessionExerciseRow
    let index: Int
    let isExpanded: Bool
    let priorEntries: [SessionPriorCardioEntry]
    let actions: SessionExerciseCardActions
    let onAddEntry: (CardioMetricsSchema) -> Void
    let onEditEntry: (SessionCardioEntryShell, CardioMetricsSchema) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ExerciseCardHeader(
                row: row,
                index: index,
                status: SessionLogging.cardioStatus(entryCount: row.workoutSessionCardioEntries.count),
                isExpanded: isExpanded,
                meta: "Cardio",
                actions: actions
            )
            if let schema = row.exercise.cardioSchema {
                if isExpanded {
                    CardioEntriesListView(
                        entries: row.workoutSessionCardioEntries,
                        schema: schema,
                        onSelect: { onEditEntry($0, schema) }
                    )
                    CardioPriorSummary(entries: priorEntries, schema: schema)
                    Button {
                        onAddEntry(schema)
                    } label: {
                        Label("Add entry", systemImage: "plus")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                } else {
                    Button(action: actions.toggle) {
                        Text(summary)
                            .font(.subheadline)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            } else {
                CardioMissingSchemaNotice()
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 14)
        .cardSurface()
    }

    private var summary: String {
        let count = row.workoutSessionCardioEntries.count
        return count == 0 ? "No entries yet" : "\(count) \(count == 1 ? "entry" : "entries")"
    }
}

/// Thumbnail (collapsed only), name over muscle, the status badge, and the
/// options menu. The open card drops the thumbnail for its larger image.
struct ExerciseCardHeader: View {
    let row: SessionExerciseRow
    let index: Int
    let status: SessionExerciseStatus
    let isExpanded: Bool
    let meta: String?
    let actions: SessionExerciseCardActions

    var body: some View {
        HStack(spacing: 10) {
            Button(action: actions.toggle) {
                HStack(spacing: 12) {
                    if !isExpanded {
                        ExerciseThumbnail(fileId: row.exercise.image1FileId)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.exercise.name)
                            .font(.headline)
                            .foregroundStyle(NeoGymTheme.text)
                            .multilineTextAlignment(.leading)
                        Text(ExerciseFormatters.enumValue(row.exercise.primaryMuscleGroup))
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    ExerciseStatusBadge(status: status, number: index + 1, isActive: isExpanded)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint(isExpanded ? "Collapses the exercise" : "Opens the exercise")
            .accessibilityAddTraits(.isButton)
            Menu {
                NavigationLink(value: TrainRoute.exerciseDetail(row.exercise.id)) {
                    Label("Exercise details", systemImage: "info.circle")
                }
                Button(role: .destructive, action: actions.remove) {
                    Label("Remove from session", systemImage: "minus.circle")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .frame(width: NeoGymTheme.minimumTapTarget, height: NeoGymTheme.minimumTapTarget)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Options for \(row.exercise.name)")
        }
    }

    private var accessibilityLabel: String {
        let state = switch status {
        case .done: "done"
        case .started: "in progress"
        case .todo: "not started"
        }
        let extra = meta.map { ", \($0)" } ?? ""
        return "\(row.exercise.name), \(ExerciseFormatters.enumValue(row.exercise.primaryMuscleGroup))\(extra), \(state)"
    }
}

struct ExerciseStatusBadge: View {
    let status: SessionExerciseStatus
    let number: Int
    let isActive: Bool

    var body: some View {
        Group {
            if isActive {
                Text("\(number)")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(NeoGymTheme.accentText)
                    .background(Circle().fill(NeoGymTheme.accentSoft).frame(width: 24, height: 24))
            } else {
                switch status {
                case .done:
                    Image(systemName: "checkmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(NeoGymTheme.positive)
                        .background(Circle().fill(NeoGymTheme.positive.opacity(0.18)).frame(width: 24, height: 24))
                case .started:
                    Circle()
                        .trim(from: 0, to: 0.5)
                        .stroke(NeoGymTheme.accentText, lineWidth: 2)
                        .rotationEffect(.degrees(-90))
                        .padding(3)
                case .todo:
                    Circle()
                        .strokeBorder(NeoGymTheme.textSecondary, style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                }
            }
        }
        .frame(width: 24, height: 24)
        .accessibilityHidden(true)
    }
}

/// The open exercise's larger image, alternating between its frames, beside
/// its three most recent earlier sessions. Either side is left out when the
/// exercise has no images or no history.
struct SessionExerciseMedia: View {
    let exercise: SessionExerciseDetail
    let recent: [SessionPriorStrengthEntry]

    @Environment(\.storageBaseURL) private var storageBaseURL

    private var imageURLs: [URL] {
        guard let storageBaseURL else { return [] }
        return [exercise.image1FileId, exercise.image2FileId].compactMap {
            URL.nhostStorageFile(baseURL: storageBaseURL, fileId: $0)
        }
    }

    var body: some View {
        if !imageURLs.isEmpty || !recent.isEmpty {
            AdaptiveRow(spacing: 10, alignment: .top) {
                if !imageURLs.isEmpty {
                    AlternatingStorageImageView(urls: imageURLs, aspectRatio: 1, cornerRadius: NeoGymTheme.radiusSM)
                        .frame(width: 128, height: 128)
                        .accessibilityHidden(true)
                }
                if !recent.isEmpty {
                    recentBox
                        .frame(minHeight: imageURLs.isEmpty ? nil : 128)
                }
            }
        }
    }

    private var recentBox: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Recent", systemImage: "clock.arrow.circlepath")
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(NeoGymTheme.textSecondary)
            Spacer(minLength: 0)
            ForEach(recent) { entry in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(dateLabel(entry))
                        .font(.caption)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                        .frame(minWidth: 42, alignment: .leading)
                    Text(SessionLogging.setsSummary(entry.sets) ?? "")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .accessibilityElement(children: .combine)
            }
            Spacer(minLength: 0)
        }
        .monospacedDigit()
        .padding(.horizontal, NeoGymTheme.spacingSM)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .insetCard(cornerRadius: NeoGymTheme.radiusSM)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Recent sessions")
    }

    private func dateLabel(_ entry: SessionPriorStrengthEntry) -> String {
        guard let date = ExerciseDateParser.parseTimestamp(entry.startedAt) else { return "" }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }
}

/// "−  95 kg  +" control. Tapping the value opens the full set editor.
struct ValueStepper: View {
    let value: String
    let minWidth: CGFloat
    let decrementLabel: String
    let incrementLabel: String
    let accessibilityName: String
    let onDecrement: () -> Void
    let onIncrement: () -> Void
    let onTapValue: () -> Void
    @ScaledMetric(relativeTo: .body) private var buttonWidth: CGFloat = 32

    var body: some View {
        HStack(spacing: 0) {
            stepButton("minus", label: decrementLabel, action: onDecrement)
            Button(action: onTapValue) {
                Text(value)
                    .font(.body.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.text)
                    .frame(minWidth: minWidth, minHeight: NeoGymTheme.minimumTapTarget)
                    .padding(.horizontal, NeoGymTheme.spacingXXS)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(accessibilityName)
            .accessibilityValue(value)
            .accessibilityHint("Opens the set editor")
            stepButton("plus", label: incrementLabel, action: onIncrement)
        }
        .background(RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous).fill(NeoGymTheme.background))
        .accessibilityElement(children: .contain)
    }

    private func stepButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(NeoGymTheme.text)
                .frame(width: buttonWidth, height: NeoGymTheme.minimumTapTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
