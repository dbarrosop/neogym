import NeoGymKit
import SwiftUI

struct JournalListView: View {
    @StateObject private var viewModel: JournalListViewModel
    let repository: any JournalRepositoryProtocol
    let reloadToken: Int

    init(repository: any JournalRepositoryProtocol, reloadToken: Int) {
        _viewModel = StateObject(wrappedValue: JournalListViewModel(repository: repository))
        self.repository = repository
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                filters
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Tracking")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text("Notes, reflections, and anything else worth remembering.")
                .font(.subheadline)
                .foregroundColor(NeoGymTheme.mutedText)
        }
    }

    @ViewBuilder
    private var filters: some View {
        if !viewModel.labels.isEmpty {
            GlassPanel(
                cornerRadius: NeoGymTheme.radiusXL,
                material: .thin,
                tint: NeoGymTheme.glassSubtleFill,
                shadow: false,
                contentPadding: EdgeInsets(
                    top: NeoGymTheme.spacingMD,
                    leading: NeoGymTheme.spacingMD,
                    bottom: NeoGymTheme.spacingMD,
                    trailing: NeoGymTheme.spacingMD
                )
            ) {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                    HStack(spacing: NeoGymTheme.spacingXS) {
                        Text("Filter")
                            .font(.caption.weight(.bold))
                            .textCase(.uppercase)
                            .foregroundColor(NeoGymTheme.mutedText)
                        if viewModel.isFiltered {
                            Button("Clear") {
                                Task { await viewModel.clearFilters() }
                            }
                            .font(.caption.weight(.semibold))
                        }
                    }
                    JournalLabelFlowLayout(spacing: NeoGymTheme.spacingXS) {
                        ForEach(viewModel.labels) { label in
                            Button {
                                Task { await viewModel.toggleLabel(label.id) }
                            } label: {
                                JournalLabelChip(
                                    name: label.name,
                                    systemImage: "tag.fill",
                                    selected: viewModel.selectedLabelSet.contains(label.id)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading entries") {
                AppLoadingStateView(title: "Loading journal entries")
            }
        case .loading where viewModel.entries.isEmpty:
            SectionShell(title: "Loading entries") {
                AppLoadingStateView(title: "Loading journal entries")
            }
        case let .failed(message, _) where viewModel.entries.isEmpty:
            SectionShell(title: "Journal") {
                AppErrorStateView(title: "Failed to load journal entries", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.entries.isEmpty {
                SectionShell(title: viewModel.isFiltered ? "No matching entries" : "No entries") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: viewModel.isFiltered
                                ? "No entries match the selected labels."
                                : "No journal entries yet.",
                            message: viewModel.isFiltered
                                ? "Clear a filter or choose another label combination."
                                : "Write your first entry to capture notes and reflections.",
                            systemImage: "book.closed"
                        )
                        if !viewModel.isFiltered {
                            NavigationLink(value: MeRoute.journalEntryCreate) {
                                Label("Write your first entry", systemImage: "plus")
                            }
                            .buttonStyle(NeoGymPrimaryButtonStyle())
                        }
                    }
                }
            } else {
                SectionShell(
                    title: "Entries",
                    subtitle: viewModel.isFiltered ? "Filtered by selected labels" : "Newest first"
                ) {
                    VStack(spacing: 0) {
                        ForEach(viewModel.entries) { entry in
                            NavigationLink(value: MeRoute.journalEntryDetail(entry.id)) {
                                JournalEntryListRow(entry: entry)
                            }
                            if entry.id != viewModel.entries.last?.id { Divider() }
                        }
                        if viewModel.hasMore {
                            Divider()
                            Button {
                                Task { await viewModel.loadMore() }
                            } label: {
                                if viewModel.isLoadingMore {
                                    ProgressView()
                                        .frame(maxWidth: .infinity)
                                } else {
                                    Text("Load more")
                                        .frame(maxWidth: .infinity)
                                }
                            }
                            .buttonStyle(NeoGymSecondaryButtonStyle())
                            .padding(.top, 12)
                        }
                        if let message = viewModel.loadMoreErrorMessage {
                            Text(message)
                                .font(.caption)
                                .foregroundColor(.red)
                                .padding(.top, 8)
                        }
                    }
                }
            }
        }
    }

}

private struct JournalEntryListRow: View {
    let entry: JournalEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            JournalDateBadge(entryDate: entry.entryDate)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(DateOnly.formatLong(entry.entryDate))
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                    if let title = entry.title, !title.isEmpty {
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !entry.previewText.isEmpty {
                    Text(entry.previewText)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(2)
                        .truncationMode(.tail)
                }
                if !entry.journalEntryLabels.isEmpty {
                    JournalLabelFlowLayout(spacing: 4) {
                        ForEach(entry.journalEntryLabels) { link in
                            JournalLabelChip(name: link.label.name, systemImage: "tag.fill", selected: true)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
                .padding(.top, 4)
        }
        .padding(.vertical, 12)
    }
}

private struct JournalDateBadge: View {
    let entryDate: String

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

    private var date: Date? { DateOnly.parse(entryDate) }

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

struct JournalEntryDetailView: View {
    @StateObject private var viewModel: JournalEntryDetailViewModel
    let repository: any JournalRepositoryProtocol
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        entryId: String,
        repository: any JournalRepositoryProtocol,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: JournalEntryDetailViewModel(entryId: entryId, repository: repository))
        self.repository = repository
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: 680)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.vertical, NeoGymTheme.screenVerticalPadding)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle("Entry")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Spacer()
                if let entry = viewModel.entry {
                    NavigationLink {
                        JournalEntryEditView(
                            entryId: entry.id,
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
                        Label("Edit entry", systemImage: "pencil")
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
            SectionShell(title: "Loading entry") {
                AppLoadingStateView(title: "Loading entry")
            }
        case .loading where viewModel.entry == nil:
            SectionShell(title: "Loading entry") {
                AppLoadingStateView(title: "Loading entry")
            }
        case let .failed(message, _) where viewModel.entry == nil:
            SectionShell(title: "Journal") {
                AppErrorStateView(title: "Failed to load entry", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let entry = viewModel.entry {
                SectionShell(title: entry.displayTitle, subtitle: DateOnly.formatLong(entry.entryDate)) {
                    VStack(alignment: .leading, spacing: 18) {
                        if !entry.journalEntryLabels.isEmpty {
                            JournalLabelFlowLayout(spacing: 6) {
                                ForEach(entry.journalEntryLabels) { link in
                                    JournalLabelChip(name: link.label.name, systemImage: "tag.fill", selected: true)
                                }
                            }
                        }
                        JournalMarkdownView(markdown: entry.body)
                    }
                }
            }
        }
    }
}

struct JournalEntryCreateView: View {
    @StateObject private var editor: JournalEntryEditorViewModel
    @State private var form: JournalEntryFormModel?
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        repository: any JournalRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: JournalEntryEditorViewModel(entryId: nil, repository: repository))
        self.onCreated = onCreated
        self.onFinished = onFinished
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: "Loading labels")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading labels")
            case let .failed(message, _) where form == nil:
                SectionShell(title: "New entry") {
                    AppErrorStateView(title: "Failed to load labels", message: message) {
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    JournalEntryFormScreen(
                        title: "New entry",
                        submitLabel: "Save entry",
                        form: form,
                        suggestions: editor.labels,
                        isSubmitting: editor.saveState.isLoading,
                        errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
                        onSubmit: submit,
                        onCancel: {
                            onFinished()
                            presentationMode.wrappedValue.dismiss()
                        }
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
        .navigationTitle("New entry")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = JournalEntryFormModel(initialValues: initialValues)
                }
            }
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit() else { return }
        Task {
            if let id = await editor.create(values: values) {
                onCreated(id)
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

struct JournalEntryEditView: View {
    @StateObject private var editor: JournalEntryEditorViewModel
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: JournalEntryFormModel?
    @State private var confirmDelete = false

    init(
        entryId: String,
        repository: any JournalRepositoryProtocol,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: JournalEntryEditorViewModel(entryId: entryId, repository: repository))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: "Loading entry")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading entry")
            case let .failed(message, _) where form == nil:
                SectionShell(title: "Entry") {
                    AppErrorStateView(title: "Failed to load entry", message: message) {
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    JournalEntryFormScreen(
                        title: "Edit entry",
                        submitLabel: "Save changes",
                        form: form,
                        suggestions: editor.labels,
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
        .navigationTitle("Edit entry")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = JournalEntryFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this entry?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete entry", role: .destructive) { deleteEntry() }
        } message: {
            Text(
                "The entry and its label associations will be removed. "
                    + "Your custom labels stay available for future entries."
            )
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

    private func deleteEntry() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

private struct JournalEntryFormScreen: View {
    let title: String
    let submitLabel: String
    @ObservedObject var form: JournalEntryFormModel
    let suggestions: [JournalLabel]
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
                            get: { DateOnly.parse(form.entryDate) ?? Date() },
                            set: { form.entryDate = DateOnly.formatLocalISO($0) }
                        ),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 4) {
                            Text("Title")
                                .font(.subheadline.weight(.semibold))
                            Text("Optional")
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                        TextField("A short headline for this entry", text: Binding(
                            get: { form.title },
                            set: { form.title = String($0.prefix(journalEntryTitleMaxLength)) }
                        ))
                        .textInputAutocapitalization(.sentences)
                        .disableAutocorrection(false)
                        .padding(NeoGymTheme.spacingSM)
                        .glassSurface(
                            cornerRadius: NeoGymTheme.radiusMD,
                            material: .ultraThin,
                            tint: NeoGymTheme.glassFill,
                            shadow: false
                        )
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Entry")
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $form.body)
                            .frame(minHeight: 220)
                            .padding(NeoGymTheme.spacingXS)
                            .glassSurface(
                                cornerRadius: NeoGymTheme.radiusMD,
                                material: .ultraThin,
                                tint: NeoGymTheme.glassFill,
                                shadow: false
                            )
                        Text("Markdown supported — use **bold**, - lists, headings, and more.")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }

                    JournalLabelInputView(form: form, suggestions: suggestions, disabled: isSubmitting)

                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }
                }
            }
            .frame(maxWidth: 680)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.canSubmit,
            deleteLabel: deleteAction == nil ? nil : "Delete entry",
            onCancel: onCancel,
            onSubmit: onSubmit,
            onDelete: deleteAction
        )
    }
}

private struct JournalLabelInputView: View {
    @ObservedObject var form: JournalEntryFormModel
    let suggestions: [JournalLabel]
    var disabled = false

    @State private var input = ""

    private var normalizedInput: String {
        JournalLabelNormalizer.normalize(input)
    }

    private var filteredSuggestions: [JournalLabel] {
        let selected = Set(form.labels.map(\.name))
        return suggestions
            .filter { !selected.contains($0.name) }
            .filter { normalizedInput.isEmpty ? true : $0.name.contains(normalizedInput) }
            .prefix(8)
            .map { $0 }
    }

    private var canCreateLabel: Bool {
        !normalizedInput.isEmpty
            && normalizedInput.count <= journalLabelMaxLength
            && !form.labels.contains { $0.name == normalizedInput }
            && !filteredSuggestions.contains { $0.name == normalizedInput }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Text("Labels")
                    .font(.subheadline.weight(.semibold))
                Text("Optional")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            JournalLabelFlowLayout(spacing: 6) {
                ForEach(form.labels, id: \.stableId) { label in
                    HStack(spacing: 4) {
                        Image(systemName: "tag.fill")
                        Text(label.name)
                        Button {
                            form.removeLabel(name: label.name)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove label \(label.name)")
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .foregroundColor(.accentColor)
                    .background(
                        Capsule(style: .continuous)
                            .fill(NeoGymTheme.accentMuted)
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(Color.accentColor.opacity(0.28), lineWidth: NeoGymTheme.hairline)
                            )
                    )
                }
            }
            HStack(spacing: 8) {
                TextField("Add a label", text: Binding(
                    get: { input },
                    set: { input = String($0.prefix(journalLabelMaxLength)) }
                ))
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .disabled(disabled)
                .onSubmit { commitTyped() }
                Button("Add") { commitTyped() }
                    .disabled(disabled || normalizedInput.isEmpty || normalizedInput.count > journalLabelMaxLength)
            }
            .padding(NeoGymTheme.spacingSM)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                material: .ultraThin,
                tint: NeoGymTheme.glassFill,
                shadow: false
            )

            if !filteredSuggestions.isEmpty || canCreateLabel {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(filteredSuggestions) { suggestion in
                        Button {
                            form.addLabel(JournalLabelSelection(id: suggestion.id, name: suggestion.name))
                            input = ""
                        } label: {
                            Label(suggestion.name, systemImage: "tag")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                    }
                    if canCreateLabel {
                        Button { commitTyped() } label: {
                            Label("Create \"\(normalizedInput)\"", systemImage: "tag")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                    }
                }
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

    private func commitTyped() {
        form.commitLabel(input, suggestions: suggestions)
        input = ""
    }
}

private struct JournalMarkdownView: View {
    let markdown: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(MarkdownRendering.parseBlocks(markdown).enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block {
        case let .heading(level, text):
            Text(text)
                .font(level <= 1 ? .title3.weight(.semibold) : .headline)
                .foregroundColor(.primary)
                .padding(.top, level <= 2 ? 4 : 2)
        case let .paragraph(text):
            Text(text)
                .font(.body)
                .foregroundColor(NeoGymTheme.mutedText)
                .fixedSize(horizontal: false, vertical: true)
        case let .unorderedList(items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                        Text(item)
                    }
                    .font(.body)
                    .foregroundColor(NeoGymTheme.mutedText)
                }
            }
        case let .orderedList(items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(index + 1).")
                            .monospacedDigit()
                        Text(item)
                    }
                    .font(.body)
                    .foregroundColor(NeoGymTheme.mutedText)
                }
            }
        }
    }
}

private struct JournalLabelChip: View {
    let name: String
    let systemImage: String
    let selected: Bool

    var body: some View {
        Label(name, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .foregroundColor(selected ? .accentColor : NeoGymTheme.mutedText)
            .background(chipBackground)
            .contentShape(Capsule(style: .continuous))
    }

    @ViewBuilder
    private var chipBackground: some View {
        if selected {
            Capsule(style: .continuous)
                .fill(NeoGymTheme.accentMuted)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.accentColor.opacity(0.28), lineWidth: NeoGymTheme.hairline)
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

private struct JournalLabelFlowLayout<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder let content: Content

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 104), spacing: spacing, alignment: .leading)],
            alignment: .leading,
            spacing: spacing
        ) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview("Journal") {
    NavigationStack {
        JournalListView(repository: PreviewJournalRepository(), reloadToken: 0)
    }
}

private struct PreviewJournalRepository: JournalRepositoryProtocol {
    func listEntries(limit: Int, offset: Int, labelIds: [String]) async throws -> JournalIndexPayload {
        JournalIndexPayload(entries: [previewEntry], labels: [JournalLabel(id: "label-1", name: "reflection")])
    }

    func entry(id: String) async throws -> JournalEntry? { previewEntry }
    func editEntry(id: String) async throws -> JournalEditPayload {
        JournalEditPayload(entry: previewEntry, labels: [JournalLabel(id: "label-1", name: "reflection")])
    }
    func labels() async throws -> [JournalLabel] { [JournalLabel(id: "label-1", name: "reflection")] }
    func createEntry(_ values: JournalEntryFormValues) async throws -> String { "entry-new" }
    func saveEntry(id: String, initialValues: JournalEntryFormValues, values: JournalEntryFormValues) async throws {}
    func deleteEntry(id: String) async throws {}

    private var previewEntry: JournalEntry {
        JournalEntry(
            id: "entry-1",
            entryDate: "2026-06-26",
            title: "Solid training day",
            body: "# Notes\n\nFelt **strong** today.\n\n- Bench moved well\n- Recovery was good",
            journalEntryLabels: [
                JournalEntryLabelLink(
                    labelId: "label-1",
                    label: JournalLabel(id: "label-1", name: "reflection")
                )
            ]
        )
    }
}
