import NeoGymKit
import SwiftUI

struct BodyNavigationView: View {
    let repository: any BodyMeasurementsRepositoryProtocol

    var body: some View {
        NavigationView {
            BodyMeasurementsListView(repository: repository)
        }
        .navigationViewStyle(.stack)
    }
}

struct BodyMeasurementsListView: View {
    @StateObject private var viewModel: BodyMeasurementsListViewModel
    let repository: any BodyMeasurementsRepositoryProtocol

    @State private var navigatedMeasurementId: String?
    @State private var isNavigatingToMeasurement = false

    init(repository: any BodyMeasurementsRepositoryProtocol) {
        _viewModel = StateObject(wrappedValue: BodyMeasurementsListViewModel(repository: repository))
        self.repository = repository
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Body")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    BodyMeasurementCreateView(
                        repository: repository,
                        onCreated: { id in
                            Task { await viewModel.load() }
                            navigatedMeasurementId = id
                            isNavigatingToMeasurement = true
                        },
                        onFinished: { Task { await viewModel.load() } }
                    )
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("New measurement")
            }
        }
        .background(pendingNavigationLink)
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
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
                        NavigationLink {
                            BodyMeasurementCreateView(
                                repository: repository,
                                onCreated: { id in
                                    Task { await viewModel.load() }
                                    navigatedMeasurementId = id
                                    isNavigatingToMeasurement = true
                                },
                                onFinished: { Task { await viewModel.load() } }
                            )
                        } label: {
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
                                .frame(height: 260)
                        }
                    }
                    SectionShell(title: "Measurements", subtitle: "Newest first") {
                        VStack(spacing: 0) {
                            ForEach(viewModel.measurements) { measurement in
                                NavigationLink {
                                    BodyMeasurementDetailView(
                                        measurementId: measurement.id,
                                        repository: repository,
                                        onDeleted: { Task { await viewModel.load() } },
                                        onMutated: { Task { await viewModel.load() } }
                                    )
                                } label: {
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

    @ViewBuilder
    private var pendingNavigationLink: some View {
        if let measurementId = navigatedMeasurementId {
            NavigationLink(
                destination: BodyMeasurementDetailView(
                    measurementId: measurementId,
                    repository: repository,
                    onDeleted: { Task { await viewModel.load() } },
                    onMutated: { Task { await viewModel.load() } }
                ),
                isActive: $isNavigatingToMeasurement
            ) {
                EmptyView()
            }
            .hidden()
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
                .padding(.horizontal, 20)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .navigationTitle("Measurement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
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
                        Image(systemName: "pencil")
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
        .padding(14)
        .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
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
                        isSubmitting: editor.saveState.isLoading,
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
        .background(GridBackground())
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
    let title: String
    let submitLabel: String
    @ObservedObject var form: BodyMeasurementFormModel
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

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
                        decimalField(title: "Weight", unit: "kg", placeholder: "78.4", text: $form.weightKg)
                        decimalField(title: "Body fat", unit: "%", placeholder: "18.5", text: $form.bodyFatPct)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $form.notes)
                            .frame(minHeight: 110)
                            .padding(8)
                            .background(
                                NeoGymTheme.cardFill,
                                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                            )
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
                        Text("Optional")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    actions
                }
            }
            .frame(maxWidth: 640)
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
    }

    private func decimalField(
        title: String,
        unit: String,
        placeholder: String,
        text: Binding<String>
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
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .padding(12)
                .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Button(submitLabel, action: onSubmit)
                .buttonStyle(NeoGymPrimaryButtonStyle())
                .disabled(isSubmitting || !form.hasMeasurementValue)
                .opacity(isSubmitting || !form.hasMeasurementValue ? 0.6 : 1)
            Button("Cancel", action: onCancel)
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            if let deleteAction {
                Button(role: .destructive, action: deleteAction) {
                    Label("Delete measurement", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }
}

struct BodyTrendChartView: View {
    let trendData: BodyMeasurementTrendData

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            GeometryReader { proxy in
                ZStack(alignment: .topLeading) {
                    chartGrid
                    seriesPath(
                        values: trendData.points.compactMap { point in
                            point.weightKg.map { (point.time, $0) }
                        },
                        size: proxy.size,
                        color: .accentColor
                    )
                    seriesPath(
                        values: trendData.points.compactMap { point in
                            point.bodyFatPct.map { (point.time, $0) }
                        },
                        size: proxy.size,
                        color: .red
                    )
                }
            }
            .frame(minHeight: 180)
            legend
            dateRange
        }
    }

    private var chartGrid: some View {
        VStack {
            ForEach(0..<4, id: \.self) { _ in
                Divider().background(NeoGymTheme.border)
                Spacer()
            }
            Divider().background(NeoGymTheme.border)
        }
    }

    private func seriesPath(values: [(TimeInterval, Double)], size: CGSize, color: Color) -> some View {
        let points = normalizedPoints(values: values, size: size)
        return Path { path in
            guard let first = points.first else { return }
            path.move(to: first)
            for point in points.dropFirst() {
                path.addLine(to: point)
            }
        }
        .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
        .overlay(
            ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)
                    .position(point)
            }
        )
    }

    private func normalizedPoints(values: [(TimeInterval, Double)], size: CGSize) -> [CGPoint] {
        guard !values.isEmpty else { return [] }
        let minX = trendData.points.map(\.time).min() ?? values[0].0
        let maxX = trendData.points.map(\.time).max() ?? values[0].0
        let minY = values.map(\.1).min() ?? values[0].1
        let maxY = values.map(\.1).max() ?? values[0].1
        let horizontalSpan = max(maxX - minX, 1)
        let verticalSpan = max(maxY - minY, 0.000_001)
        let inset: CGFloat = 10
        let width = max(size.width - inset * 2, 1)
        let height = max(size.height - inset * 2, 1)

        return values.map { time, value in
            let xPosition = inset + CGFloat((time - minX) / horizontalSpan) * width
            let yRatio = (value - minY) / verticalSpan
            let yPosition = inset + CGFloat(1 - yRatio) * height
            return CGPoint(x: xPosition, y: yPosition)
        }
    }

    private var legend: some View {
        HStack(spacing: 14) {
            legendItem(color: .accentColor, label: "Weight (kg)", count: trendData.weightCount)
            legendItem(color: .red, label: "Body fat (%)", count: trendData.bodyFatCount)
        }
        .font(.caption)
        .foregroundColor(NeoGymTheme.mutedText)
    }

    private func legendItem(color: Color, label: String, count: Int) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 16, height: 3)
            Text("\(label) · \(count)")
        }
    }

    private var dateRange: some View {
        HStack {
            Text(trendData.points.first.map { DateOnly.formatShort($0.measuredOn) } ?? "")
            Spacer()
            Text(trendData.points.last.map { DateOnly.formatShort($0.measuredOn) } ?? "")
        }
        .font(.caption2)
        .foregroundColor(NeoGymTheme.mutedText)
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
}

#Preview("Body") {
    BodyNavigationView(repository: PreviewBodyMeasurementsRepository())
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
