import NeoGymKit
import SwiftUI

struct BodyMeasurementsListView: View {
    @StateObject private var viewModel: BodyMeasurementsListViewModel
    let repository: any BodyMeasurementsRepositoryProtocol
    let healthImporter: (any BodyMeasurementsHealthImporting)?
    let reloadToken: Int

    init(
        repository: any BodyMeasurementsRepositoryProtocol,
        healthImporter: (any BodyMeasurementsHealthImporting)? = nil,
        userId: String? = nil,
        reloadToken: Int
    ) {
        _viewModel = StateObject(wrappedValue: BodyMeasurementsListViewModel(
            repository: repository,
            healthImporter: healthImporter,
            userId: userId
        ))
        self.repository = repository
        self.healthImporter = healthImporter
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load(shouldSyncHealthMeasurements: true)
            }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load(shouldSyncHealthMeasurements: true) }
    }


    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading body measurements")
        case .loading where viewModel.measurements.isEmpty:
            AppLoadingStateView(title: "Loading body measurements")
        case let .failed(message, _) where viewModel.measurements.isEmpty:
            AppErrorStateView(title: "Couldn't load body measurements", message: message) {
                Task { await viewModel.load(shouldSyncHealthMeasurements: true) }
            }
            .cardSurface()
        default:
            if viewModel.trendData.shouldShowChart {
                trendCard
            }
            healthSyncStatus
            if viewModel.measurements.isEmpty {
                AppEmptyStateView(
                    title: "No measurements yet",
                    message: "Log a measurement with the + button, or allow Apple Health to import weight and body fat.",
                    systemImage: "scalemass"
                )
                .cardSurface()
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.measurements) { measurement in
                        NavigationLink(value: ProgressRoute.bodyMeasurementDetail(measurement.id)) {
                            BodyMeasurementListRow(measurement: measurement)
                        }
                        .buttonStyle(.plain)
                        if measurement.id != viewModel.measurements.last?.id { RowSeparator() }
                    }
                }
                .cardSurface()
            }
        }
    }

    private var trendCard: some View {
        let averages = viewModel.trendData.rollingAverageValues(days: 7)
        let average = averages.last(where: { $0.averageWeightKg != nil })?.averageWeightKg
        let fat = viewModel.trendData.points.last(where: { $0.bodyFatPct != nil })?.bodyFatPct
        return VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            AdaptiveRow(spacing: NeoGymTheme.spacingLG, alignment: .top) {
                if let average {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Weight · 7-day avg")
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                        MetricValueText(value: MetricFormat.decimal(average), unit: "kg")
                    }
                    .accessibilityElement(children: .combine)
                }
                if let fat {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Body fat")
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                        MetricValueText(value: MetricFormat.decimal(fat), unit: "%")
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            BodyTrendChartView(trendData: viewModel.trendData)
        }
        .padding(NeoGymTheme.spacingMD)
        .cardSurface()
    }

    @ViewBuilder
    private var healthSyncStatus: some View {
        switch viewModel.healthSyncState {
        case .loading:
            HealthSyncStatusRow(title: "Apple Health", detail: "Syncing weight and body fat…", isSyncing: true)
        case let .loaded(summary):
            HealthSyncStatusRow(
                title: "Apple Health",
                detail: summary.importedCount > 0 || summary.updatedCount > 0
                    ? "Weight & body fat · \(summary.importedCount) imported, \(summary.updatedCount) updated"
                    : "Weight & body fat · up to date"
            )
        case let .failed(message, _):
            FeedbackBanner(message: message)
        case .idle:
            EmptyView()
        }
    }
}

private struct BodyMeasurementListRow: View {
    let measurement: BodyMeasurement

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            Text(DateOnly.parse(measurement.measuredOn)?.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) ?? measurement.measuredOn)
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let notes = measurement.notes, !notes.isEmpty, !HealthImportMarker.isImported(notes) {
                Image(systemName: "note.text")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .accessibilityLabel("Has a note")
            }
            Text(measurement.weightKg.map { "\(MetricFormat.decimal($0, digits: 2)) kg" } ?? "—")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NeoGymTheme.text)
                .frame(minWidth: 78, alignment: .trailing)
            Text(measurement.bodyFatPct.map { "\(MetricFormat.decimal($0)) %" } ?? "—")
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .frame(minWidth: 52, alignment: .trailing)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NeoGymTheme.textTertiary)
                .accessibilityHidden(true)
        }
        .monospacedDigit()
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct BodyMeasurementDetailView: View {
    @StateObject private var viewModel: BodyMeasurementDetailViewModel
    let repository: any BodyMeasurementsRepositoryProtocol
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        measurementId: String,
        repository: any BodyMeasurementsRepositoryProtocol,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: BodyMeasurementDetailViewModel(
            measurementId: measurementId,
            repository: repository
        ))
        self.repository = repository
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: 640)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.screenVerticalPadding)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle("Measurement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if let measurement = viewModel.measurement {
                    NavigationLink {
                        BodyMeasurementEditView(
                            measurementId: measurement.id,
                            repository: repository,
                            onSaved: {
                                onMutated()
                                Task { await viewModel.load() }
                            },
                            onDeleted: {
                                onDeleted()
                                presentationMode.wrappedValue.dismiss()
                            }
                        )
                    } label: {
                        Text("Edit")
                    }
                    .accessibilityLabel("Edit measurement")
                }
            }
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading measurement") {
                AppLoadingStateView(title: "Loading measurement")
            }
        case .loading where viewModel.measurement == nil:
            SectionShell(title: "Loading measurement") {
                AppLoadingStateView(title: "Loading measurement")
            }
        case let .failed(message, _) where viewModel.measurement == nil:
            SectionShell(title: "Measurement") {
                AppErrorStateView(title: "Failed to load measurement", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let measurement = viewModel.measurement {
                SectionShell(title: DateOnly.formatLong(measurement.measuredOn), subtitle: "Measurement") {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(spacing: 12) {
                            BodyMeasurementStatCard(
                                label: "Weight",
                                value: BodyMeasurementFormatters.weight(measurement.weightKg)
                            )
                            BodyMeasurementStatCard(
                                label: "Body fat",
                                value: BodyMeasurementFormatters.bodyFat(measurement.bodyFatPct)
                            )
                        }
                        if let notes = measurement.notes, !notes.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Notes")
                                    .font(.caption.weight(.bold))
                                    .textCase(.uppercase)
                                    .foregroundColor(NeoGymTheme.textSecondary)
                                Text(notes)
                                    .font(.body)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct BodyMeasurementStatCard: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.textSecondary)
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingMD)
        .cardSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            fill: NeoGymTheme.inset
        )
    }
}

struct BodyMeasurementCreateView: View {
    @StateObject private var editor: BodyMeasurementEditorViewModel
    @StateObject private var form: BodyMeasurementFormModel
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        repository: any BodyMeasurementsRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: BodyMeasurementEditorViewModel(measurementId: nil, repository: repository))
        _form = StateObject(wrappedValue: BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: DateOnly.todayLocalISO(),
            weightKg: "",
            bodyFatPct: "",
            notes: ""
        )))
        self.onCreated = onCreated
        self.onFinished = onFinished
    }

    var body: some View {
        BodyMeasurementFormScreen(
            title: "New measurement",
            submitLabel: "Save measurement",
            form: form,
            isSubmitting: editor.saveState.isLoading,
            errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
            onSubmit: submit,
            onCancel: {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        )
        .navigationTitle("New measurement")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() {
        guard let values = form.valuesForSubmit() else { return }
        Task {
            if let id = await editor.create(values: values) {
                onCreated(id)
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

struct BodyMeasurementEditView: View {
    @StateObject private var editor: BodyMeasurementEditorViewModel
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: BodyMeasurementFormModel?
    @State private var confirmDelete = false

    init(
        measurementId: String,
        repository: any BodyMeasurementsRepositoryProtocol,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(
            wrappedValue: BodyMeasurementEditorViewModel(measurementId: measurementId, repository: repository)
        )
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                SectionShell(title: "Loading measurement") {
                    AppLoadingStateView(title: "Loading measurement")
                }
                .padding(20)
            case .loading where editor.measurement == nil:
                SectionShell(title: "Loading measurement") {
                    AppLoadingStateView(title: "Loading measurement")
                }
                .padding(20)
            case let .failed(message, _) where editor.measurement == nil:
                SectionShell(title: "Measurement") {
                    AppErrorStateView(title: "Failed to load measurement", message: message) {
                        Task { await loadAndPrepareForm() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    BodyMeasurementFormScreen(
                        title: "Edit measurement",
                        submitLabel: "Save changes",
                        form: form,
                        isSubmitting: editor.saveState.isLoading || editor.deleteState.isLoading,
                        errorMessage: form.errorMessage
                            ?? editor.saveState.errorMessage
                            ?? editor.deleteState.errorMessage,
                        onSubmit: submit,
                        onCancel: { presentationMode.wrappedValue.dismiss() },
                        deleteAction: { confirmDelete = true }
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
        .navigationTitle("Edit measurement")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await loadAndPrepareForm()
            }
        }
        .alert("Delete this measurement?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete measurement", role: .destructive) { deleteMeasurement() }
        } message: {
            Text("This entry will be removed from your body history.")
        }
    }

    private func loadAndPrepareForm() async {
        await editor.load()
        prepareFormIfNeeded()
    }

    private func prepareFormIfNeeded() {
        guard form == nil, let initialValues = editor.initialValues else { return }
        form = BodyMeasurementFormModel(initialValues: initialValues)
    }

    private func submit() {
        guard let values = form?.valuesForSubmit() else { return }
        Task {
            if await editor.save(values: values) {
                onSaved()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func deleteMeasurement() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

private struct BodyMeasurementFormScreen: View {
    private enum FocusedField: Hashable {
        case weight
        case bodyFat
    }

    let title: String
    let submitLabel: String
    @ObservedObject var form: BodyMeasurementFormModel
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @FocusState private var focusedField: FocusedField?

    var body: some View {
        ScrollView {
            SectionShell(title: title) {
                VStack(alignment: .leading, spacing: 18) {
                    DatePicker(
                        "Date",
                        selection: Binding(
                            get: { DateOnly.parse(form.measuredOn) ?? Date() },
                            set: { form.measuredOn = DateOnly.formatLocalISO($0) }
                        ),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)

                    HStack(spacing: 12) {
                        decimalField(
                            title: "Weight",
                            unit: "kg",
                            placeholder: "78.4",
                            text: $form.weightKg,
                            field: .weight
                        )
                        decimalField(
                            title: "Body fat",
                            unit: "%",
                            placeholder: "18.5",
                            text: $form.bodyFatPct,
                            field: .bodyFat
                        )
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $form.notes)
                            .frame(minHeight: 110)
                            .padding(NeoGymTheme.spacingXS)
                            .cardSurface(
                                cornerRadius: NeoGymTheme.radiusMD,
                                fill: NeoGymTheme.fill
                            )
                        Text("Optional")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.textSecondary)
                    }

                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }
                    if let deleteAction {
                        FormDeleteButton(
                            title: "Delete measurement",
                            isDisabled: isSubmitting,
                            action: deleteAction
                        )
                        .padding(.top, NeoGymTheme.spacingSM)
                    }
                }
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .keyboardDoneToolbar(focusedField: $focusedField)
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.hasMeasurementValue,
            onCancel: onCancel,
            onSubmit: onSubmit
        )
    }

    private func decimalField(
        title: String,
        unit: String,
        placeholder: String,
        text: Binding<String>,
        field: FocusedField
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(unit)
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.textSecondary)
            }
            TextField(placeholder, text: text)
                .keyboardType(.decimalPad)
                .numericFieldFocus(field, focusedField: $focusedField)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .padding(NeoGymTheme.spacingSM)
                .cardSurface(
                    cornerRadius: NeoGymTheme.radiusMD,
                    fill: NeoGymTheme.fill
                )
        }
    }

}

struct BodyTrendChartView: View {
    let trendData: BodyMeasurementTrendData

    private var chartSeries: [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "weight",
                name: "Weight (kg)",
                color: NeoGymTheme.accentText,
                points: trendData.points.compactMap { point in
                    point.weightKg.map {
                        TimeSeriesChartDataPoint(id: "\(point.id)-weight", date: point.date, value: $0)
                    }
                },
                valueFormatter: BodyMeasurementFormatters.axisWeight
            ),
            TimeSeriesChartSeries(
                id: "body-fat",
                name: "Body fat (%)",
                color: NeoGymTheme.textSecondary,
                // Own scale: on weight's axis the two ranges flatten each other.
                axis: .right,
                points: trendData.points.compactMap { point in
                    point.bodyFatPct.map {
                        TimeSeriesChartDataPoint(id: "\(point.id)-body-fat", date: point.date, value: $0)
                    }
                },
                valueFormatter: BodyMeasurementFormatters.axisBodyFat
            )
        ]
    }

    var body: some View {
        TimeSeriesTrendChartView(
            series: chartSeries,
            maxRenderedPoints: 48,
            emptyMessage: "No body measurements in this range.",
            accessibilityLabel: "Body weight and body fat trend chart",
            initialPeriod: .last90Days
        )
    }
}

private enum BodyMeasurementFormatters {
    static func weight(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.2f kg", value)
    }

    static func bodyFat(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f %%", value)
    }

    static func values(weightKg: Double?, bodyFatPct: Double?) -> String {
        [weight(weightKg), bodyFat(bodyFatPct)].filter { $0 != "—" }.joined(separator: " · ")
    }

    static func axisWeight(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    static func axisBodyFat(_ value: Double) -> String {
        String(format: "%.1f", value)
    }
}

#Preview("Body") {
    NavigationStack {
        BodyMeasurementsListView(repository: PreviewBodyMeasurementsRepository(), reloadToken: 0)
    }
}

private struct PreviewBodyMeasurementsRepository: BodyMeasurementsRepositoryProtocol {
    func listMeasurements() async throws -> [BodyMeasurement] {
        [
            BodyMeasurement(id: "1", measuredOn: "2026-06-01", weightKg: 82.1, bodyFatPct: 18.4, notes: "Baseline"),
            BodyMeasurement(id: "2", measuredOn: "2026-06-12", weightKg: 81.4, bodyFatPct: 18.1),
            BodyMeasurement(id: "3", measuredOn: "2026-06-25", weightKg: 80.9, bodyFatPct: 17.8, notes: "Felt good")
        ]
    }

    func measurement(id: String) async throws -> BodyMeasurement? {
        try await listMeasurements().first { $0.id == id }
    }

    func editMeasurement(id: String) async throws -> BodyMeasurement? {
        try await measurement(id: id)
    }

    func createMeasurement(_ values: BodyMeasurementFormValues) async throws -> String { "new" }
    func updateMeasurement(id: String, values: BodyMeasurementFormValues) async throws {}
    func deleteMeasurement(id: String) async throws {}
}
