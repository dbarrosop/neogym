import NeoGymKit
import SwiftUI
import WidgetKit

/// Nutrition › Log: a week strip and date picker, the day summary, and a
/// time-slot timeline where logged slots are solid and the selected plan's
/// remaining slots are dashed with one Log action each.
struct DailyIntakeView: View {
    let reloadToken: Int
    let onDateSelected: (String) -> Void
    let onMutated: () -> Void

    @StateObject private var viewModel: DailyIntakeViewModel
    @StateObject private var weekModel: NutritionCalorieHistoryViewModel
    @State private var logRequest: LogIntakeSheetRequest?
    @State private var editingEntry: EditingEntrySheetItem?
    @State private var editingGroup: EditingGroupSheetItem?
    @State private var confirmingDayDelete = false
    @State private var isPickingDate = false
    @State private var expandedOverrides: [String: Bool] = [:]
    @State private var loggingSlotKey: String?

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        date: String,
        reloadToken: Int = 0,
        onDateSelected: @escaping (String) -> Void,
        onMutated: @escaping () -> Void
    ) {
        self.reloadToken = reloadToken
        self.onDateSelected = onDateSelected
        self.onMutated = onMutated
        _viewModel = StateObject(wrappedValue: DailyIntakeViewModel(date: date, repository: repository))
        _weekModel = StateObject(wrappedValue: NutritionCalorieHistoryViewModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                NutritionWeekStripView(
                    days: NutritionWeekStrip.days(containing: viewModel.date),
                    selected: viewModel.date,
                    today: IntakeGrouping.formatLocalDate(),
                    kcalByDate: NutritionWeekStrip.kcalByDate(weekModel.history),
                    onSelect: onDateSelected
                )
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task {
            await viewModel.load()
            await loadWeek()
        }
        .onChange(of: reloadToken) { Task { await reload() } }
        .refreshable { await reload() }
        .toolbar { toolbar }
        .sheet(item: $logRequest) { request in
            LogIntakeSheet(viewModel: viewModel, request: request, onMutated: mutated)
        }
        .sheet(item: $editingEntry) { item in
            EditLogEntrySheet(viewModel: viewModel, item: item, onMutated: mutated)
        }
        .sheet(item: $editingGroup) { item in
            EditMealGroupSheet(viewModel: viewModel, item: item, onMutated: mutated)
        }
        .sheet(isPresented: $isPickingDate) {
            NutritionDatePickerSheet(date: viewModel.date, onPick: onDateSelected)
        }
        .confirmationDialog("Clear this day?", isPresented: $confirmingDayDelete, titleVisibility: .visible) {
            Button("Clear day log", role: .destructive) {
                Task {
                    if await viewModel.deleteDay() { mutated() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Everything logged on \(IntakeGrouping.formatLocalDateLabel(viewModel.date)) is deleted, including meal groups. This can't be undone.")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading(previous: nil):
            AppLoadingStateView(title: "Opening day")
        case let .failed(message, previous) where previous == nil:
            AppErrorStateView(title: "Couldn't load this day", message: message) {
                Task { await viewModel.load() }
            }
            .cardSurface()
        default:
            loaded
        }
    }

    @ViewBuilder
    private var loaded: some View {
        let payload = viewModel.payload
        NutritionDaySummaryCard(
            date: viewModel.date,
            totals: payload?.loggedTotals ?? .empty,
            targetTotals: payload?.targetTotals,
            plans: payload?.nutritionPlans ?? [],
            selectedPlanId: viewModel.day?.nutritionPlanId,
            balance: viewModel.calorieBalance,
            projection: payload?.energyProjection(date: viewModel.date),
            isMutating: viewModel.isMutating,
            onPlanChange: changePlan
        )
        if let message = viewModel.mutationState.errorMessage {
            FeedbackBanner(message: message)
        }
        timeline
        if viewModel.day != nil {
            FormDeleteButton(
                title: "Clear day log",
                isDisabled: viewModel.isMutating,
                action: { confirmingDayDelete = true }
            )
            .padding(.top, NeoGymTheme.spacingXS)
        }
        Text("Totals use the values saved when food was logged, so later edits to foods or plans don't change this day.")
            .font(.caption)
            .foregroundStyle(NeoGymTheme.textTertiary)
            .padding(.horizontal, NeoGymTheme.spacingXXS)
    }

    @ViewBuilder
    private var timeline: some View {
        let items = NutritionTimeline.items(day: viewModel.day, selectedPlan: viewModel.selectedPlan)
        let defaults = NutritionTimeline.defaultExpandedIds(items)
        let nextPlannedId = items.first { !$0.isLogged }?.id
        if items.isEmpty {
            AppEmptyStateView(
                title: "Nothing logged yet",
                message: viewModel.selectedPlan == nil
                    ? "Use + to log what you ate, or pick a plan to see its time slots here."
                    : "This plan has no time slots yet. Use + to log what you ate.",
                systemImage: "fork.knife"
            )
        }
        ForEach(items) { item in
            let isExpanded = expandedOverrides[item.id] ?? defaults.contains(item.id)
            let toggle = { expandedOverrides[item.id] = !isExpanded }
            switch item {
            case let .logged(slot):
                LoggedSlotCard(
                    slot: slot,
                    day: viewModel.day,
                    isExpanded: isExpanded,
                    toggle: toggle,
                    editEntry: { editingEntry = $0 },
                    editGroup: { editingGroup = $0 }
                )
            case let .planned(slot):
                PlannedSlotCard(
                    slot: slot,
                    isExpanded: isExpanded,
                    isNext: item.id == nextPlannedId,
                    isLogging: loggingSlotKey == slot.key,
                    isDisabled: viewModel.isMutating,
                    toggle: toggle,
                    log: { logSlot(slot) }
                )
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                isPickingDate = true
            } label: {
                Label("Pick a date", systemImage: "calendar")
                    .labelStyle(.iconOnly)
            }
            .tint(NeoGymTheme.text)
            .accessibilityLabel("Pick a date")
        }
        AreaPrimaryAction(title: "Log food") {
            if !viewModel.isMutating, viewModel.payload != nil { logRequest = .adHocFood }
        }
    }

    // MARK: - Actions

    private func reload() async {
        await viewModel.load()
        await loadWeek()
    }

    private func loadWeek() async {
        await weekModel.load(range: NutritionWeekStrip.range(containing: viewModel.date))
    }

    private func mutated() {
        onMutated()
        Task { await loadWeek() }
    }

    private func changePlan(_ planId: String?) {
        guard planId != viewModel.day?.nutritionPlanId else { return }
        Task {
            if await viewModel.updatePlan(nutritionPlanId: planId) { mutated() }
        }
    }

    private func logSlot(_ slot: NutritionPlanTimeSlot<NutritionPlanEntry>) {
        guard loggingSlotKey == nil else { return }
        loggingSlotKey = slot.key
        Task {
            defer { loggingSlotKey = nil }
            if await viewModel.logSelectedPlanSlot(slot) {
                expandedOverrides["logged-\(slot.key)"] = true
                mutated()
            }
        }
    }
}

/// Totals against the selected plan, macro bars and energy out.
struct NutritionDaySummaryCard: View {
    let date: String
    let totals: MacroTotals
    let targetTotals: MacroTotals?
    let plans: [NutritionPlan]
    let selectedPlanId: String?
    let balance: DailyCalorieBalance
    let projection: DailyEnergyProjection?
    let isMutating: Bool
    let onPlanChange: (String?) -> Void
    @Environment(\.locale) private var locale

    private var isToday: Bool { date == IntakeGrouping.formatLocalDate() }

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            AdaptiveRow(spacing: NeoGymTheme.spacingSM, alignment: .firstTextBaseline) {
                MetricValueText(
                    value: MetricFormat.whole(totals.kcal),
                    unit: targetTotals.map { "/ \(MetricFormat.whole($0.kcal)) kcal" } ?? "kcal"
                )
                .accessibilityLabel(kcalAccessibilityLabel)
                Spacer(minLength: 0)
                planMenu
            }
            if let target = targetTotals {
                MeterTrack(fraction: target.kcal > 0 ? totals.kcal / target.kcal : nil, color: NeoGymTheme.accent, height: 8)
            }
            AdaptiveRow(spacing: NeoGymTheme.spacingSM, alignment: .top) {
                macroColumn("Protein", totals.protein, targetTotals?.protein, NeoGymTheme.accent)
                macroColumn("Carbs", totals.carbs, targetTotals?.carbs, NeoGymTheme.carbs)
                macroColumn("Fat", totals.fat, targetTotals?.fat, NeoGymTheme.textSecondary)
            }
            Text("Fiber \(grams(totals.fiber, targetTotals?.fiber)) · Sugar \(grams(totals.sugar, targetTotals?.sugar))")
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
            Divider().overlay(NeoGymTheme.separator)
            energyRow(isToday ? "Energy out so far" : "Energy out", value: balance.caloriesOut.map { "\(MetricFormat.whole($0)) kcal" } ?? "No energy logged")
            if let net = balance.net {
                energyRow("Balance", value: "\(MetricFormat.signedWhole(net)) kcal")
            }
            if let projection {
                energyRow("Estimated today", value: "Burned \(projection.burnedValue(locale: locale)) · Net \(projection.netValue(locale: locale))")
            }
        }
        .padding(NeoGymTheme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Day summary")
    }

    private var planMenu: some View {
        Menu {
            Picker("Plan", selection: Binding(
                get: { selectedPlanId ?? "" },
                set: { onPlanChange($0.isEmpty ? nil : $0) }
            )) {
                Text("No plan").tag("")
                ForEach(plans) { plan in
                    Text(plan.name).tag(plan.id)
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(plans.first { $0.id == selectedPlanId }.map { "Plan: \($0.name)" } ?? "No plan")
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.bold))
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(NeoGymTheme.text)
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(Capsule().fill(NeoGymTheme.fill))
            .frame(minHeight: NeoGymTheme.minimumTapTarget)
        }
        .disabled(isMutating)
        .accessibilityLabel("Selected nutrition plan")
        .accessibilityValue(plans.first { $0.id == selectedPlanId }?.name ?? "No plan")
    }

    private func macroColumn(_ label: String, _ value: Double, _ target: Double?, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
            Text(grams(value, target))
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            MeterTrack(fraction: target.flatMap { $0 > 0 ? value / $0 : nil }, color: color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(grams(value, target))
    }

    private func energyRow(_ label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
            Spacer(minLength: NeoGymTheme.spacingXS)
            Text(value)
                .font(.footnote.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.text)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }

    private func grams(_ value: Double, _ target: Double?) -> String {
        target.map { "\(MetricFormat.whole(value)) / \(MetricFormat.whole($0)) g" } ?? "\(MetricFormat.whole(value)) g"
    }

    private var kcalAccessibilityLabel: String {
        if let target = targetTotals {
            return "\(MetricFormat.whole(totals.kcal)) of \(MetricFormat.whole(target.kcal)) planned kilocalories"
        }
        return "\(MetricFormat.whole(totals.kcal)) kilocalories logged"
    }
}

/// Graphical date picker for jumping to any day, plus Today.
struct NutritionDatePickerSheet: View {
    let date: String
    let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selection = Date()

    var body: some View {
        NavigationStack {
            DatePicker("Day", selection: $selection, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .frame(maxHeight: .infinity, alignment: .top)
                .navigationTitle("Choose a day")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Today") {
                            onPick(IntakeGrouping.formatLocalDate())
                            dismiss()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            onPick(IntakeGrouping.formatLocalDate(selection))
                            dismiss()
                        }
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .onAppear { selection = IntakeGrouping.localDateToDate(date) ?? Date() }
    }
}
