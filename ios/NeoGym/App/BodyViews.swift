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
        reloadToken: Int
    ) {
        _viewModel = StateObject(wrappedValue: BodyMeasurementsListViewModel(
            repository: repository,
            healthImporter: healthImporter
        ))
        self.repository = repository
        self.healthImporter = healthImporter
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Body")
        .task {
            if case .idle = viewModel.state {
                await viewModel.load(shouldSyncHealthMeasurements: true)
            }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load(shouldSyncHealthMeasurements: true) }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingMD) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Tracking")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text("Body")
                    .font(.largeTitle.bold())
                    .tracking(-0.8)
                Text("Log your weight and body fat over time.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer(minLength: 0)
            NavigationLink(value: MeRoute.bodyMeasurementCreate) {
                HeaderActionButtonLabel()
            }
            .accessibilityLabel("New measurement")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading measurements") {
                AppLoadingStateView(title: "Loading body measurements")
            }
        case .loading where viewModel.measurements.isEmpty:
            SectionShell(title: "Loading measurements") {
                AppLoadingStateView(title: "Loading body measurements")
            }
        case let .failed(message, _) where viewModel.measurements.isEmpty:
            SectionShell(title: "Body") {
                AppErrorStateView(title: "Failed to load body measurements", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.measurements.isEmpty {
                SectionShell(title: "No measurements") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: "No measurements yet",
                            message: "Log your first measurement to start seeing trends.",
                            systemImage: "heart.text.square"
                        )
                        NavigationLink(value: MeRoute.bodyMeasurementCreate) {
                            Label("Log your first measurement", systemImage: "plus")
                        }
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                    }
                }
            } else {
                VStack(spacing: 14) {
                    if viewModel.trendData.shouldShowChart {
                        SectionShell(title: "Weight & body fat over time", subtitle: "Trend") {
                            BodyTrendChartView(trendData: viewModel.trendData)
                        }
                    }
                    SectionShell(title: "Measurements", subtitle: "Newest first") {
                        VStack(spacing: 0) {
                            ForEach(viewModel.measurements) { measurement in
                                NavigationLink(value: MeRoute.bodyMeasurementDetail(measurement.id)) {
                                    BodyMeasurementListRow(measurement: measurement)
                                }
                                if measurement.id != viewModel.measurements.last?.id { Divider() }
                            }
                        }
                    }
                }
            }
        }
    }

}

private struct BodyMeasurementListRow: View {
    let measurement: BodyMeasurement

    var body: some View {
        HStack(spacing: 12) {
            BodyDateBadge(measuredOn: measurement.measuredOn)
            VStack(alignment: .leading, spacing: 4) {
                Text(DateOnly.formatLong(measurement.measuredOn))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                Text(
                    BodyMeasurementFormatters.values(
                        weightKg: measurement.weightKg,
                        bodyFatPct: measurement.bodyFatPct
                    )
                )
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                if let notes = measurement.notes, !notes.isEmpty {
                    Text(notes)
                        .lineLimit(1)
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.vertical, 10)
    }
}

private struct BodyDateBadge: View {
    let measuredOn: String

    var body: some View {
        VStack(spacing: 0) {
            Text(month)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(day)
                .font(.title3.weight(.bold))
                .foregroundColor(.primary)
        }
        .frame(width: 52, height: 52)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }

    private var date: Date? { DateOnly.parse(measuredOn) }

    private var month: String {
        guard let date else { return "—" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter.string(from: date)
    }

    private var day: String {
        guard let date else { return "—" }
        return String(Calendar.current.component(.day, from: date))
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
            ToolbarItemGroup(placement: .bottomBar) {
                Spacer()
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
                        Label("Edit measurement", systemImage: "pencil")
                    }
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
                                    .foregroundColor(NeoGymTheme.mutedText)
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
                .foregroundColor(NeoGymTheme.mutedText)
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(NeoGymTheme.spacingMD)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
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
                        Task { await editor.load() }
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
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = BodyMeasurementFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this measurement?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete measurement", role: .destructive) { deleteMeasurement() }
        } message: {
            Text("This entry will be removed from your body history.")
        }
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
                            .glassSurface(
                                cornerRadius: NeoGymTheme.radiusMD,
                                material: .ultraThin,
                                tint: NeoGymTheme.glassFill,
                                shadow: false
                            )
                        Text("Optional")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }

                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
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
            deleteLabel: deleteAction == nil ? nil : "Delete measurement",
            onCancel: onCancel,
            onSubmit: onSubmit,
            onDelete: deleteAction
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
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            TextField(placeholder, text: text)
                .keyboardType(.decimalPad)
                .numericFieldFocus(field, focusedField: $focusedField)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .padding(NeoGymTheme.spacingSM)
                .glassSurface(
                    cornerRadius: NeoGymTheme.radiusMD,
                    material: .ultraThin,
                    tint: NeoGymTheme.glassFill,
                    shadow: false
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
                color: .accentColor,
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
                color: .red,
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
