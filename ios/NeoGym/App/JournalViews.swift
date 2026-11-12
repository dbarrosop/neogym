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
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                filters
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
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


    @ViewBuilder
    private var filters: some View {
        if !viewModel.labels.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: NeoGymTheme.spacingXS) {
                    FilterChip(title: "All", isSelected: !viewModel.isFiltered) {
                        Task { await viewModel.clearFilters() }
                    }
                    ForEach(viewModel.labels) { label in
                        FilterChip(title: label.name, isSelected: viewModel.selectedLabelSet.contains(label.id)) {
                            Task { await viewModel.toggleLabel(label.id) }
                        }
                    }
                }
            }
            .accessibilityLabel("Filter by label")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading journal entries")
        case .loading where viewModel.entries.isEmpty:
            AppLoadingStateView(title: "Loading journal entries")
        case let .failed(message, _) where viewModel.entries.isEmpty:
            AppErrorStateView(title: "Couldn't load journal entries", message: message) {
                Task { await viewModel.load() }
            }
            .cardSurface()
        default:
            if viewModel.entries.isEmpty {
                AppEmptyStateView(
                    title: viewModel.isFiltered ? "No entries match these labels" : "No journal entries yet",
                    message: viewModel.isFiltered
                        ? "Clear a filter or choose another label combination."
                        : "Write your first entry with the + button.",
                    systemImage: "book.closed"
                )
                .cardSurface()
            } else {
                ForEach(viewModel.entries) { entry in
                    NavigationLink(value: MeRoute.journalEntryDetail(entry.id)) {
                        JournalEntryCard(entry: entry)
                    }
                    .buttonStyle(.plain)
                }
                if viewModel.hasMore {
                    Button {
                        Task { await viewModel.loadMore() }
                    } label: {
                        Group {
                            if viewModel.isLoadingMore { ProgressView() } else { Text("Load more") }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                }
                if let message = viewModel.loadMoreErrorMessage {
                    FeedbackBanner(message: message)
                }
            }
        }
    }
}

private struct JournalEntryCard: View {
    let entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(DateOnly.parse(entry.entryDate)?.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) ?? entry.entryDate)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NeoGymTheme.textSecondary)
            if let title = entry.title, !title.isEmpty {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(NeoGymTheme.text)
                    .multilineTextAlignment(.leading)
            }
            if !entry.previewText.isEmpty {
                Text(entry.previewText)
                    .font(.subheadline)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            if !entry.journalEntryLabels.isEmpty {
                FlowRow(spacing: 6) {
                    ForEach(entry.journalEntryLabels) { link in
                        Text(link.label.name)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(NeoGymTheme.accentText)
                            .padding(.horizontal, NeoGymTheme.spacingXS)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(NeoGymTheme.accentSoft))
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(NeoGymTheme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
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
            ToolbarItemGroup(placement: .topBarTrailing) {
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
                        Text("Edit")
                    }
                    .accessibilityLabel("Edit entry")
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
                                .foregroundColor(NeoGymTheme.textSecondary)
                        }
                        TextField("A short headline for this entry", text: Binding(
                            get: { form.title },
                            set: { form.title = String($0.prefix(journalEntryTitleMaxLength)) }
                        ))
                        .textInputAutocapitalization(.sentences)
                        .disableAutocorrection(false)
                        .padding(NeoGymTheme.spacingSM)
                        .cardSurface(
                            cornerRadius: NeoGymTheme.radiusMD,
                            fill: NeoGymTheme.surface
                        )
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Entry")
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $form.body)
                            .frame(minHeight: 220)
                            .padding(NeoGymTheme.spacingXS)
                            .cardSurface(
                                cornerRadius: NeoGymTheme.radiusMD,
                                fill: NeoGymTheme.surface
                            )
                        Text("Markdown supported — use **bold**, - lists, headings, and more.")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.textSecondary)
                    }

                    JournalLabelInputView(form: form, suggestions: suggestions, disabled: isSubmitting)

                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }
                    if let deleteAction {
                        FormDeleteButton(
                            title: "Delete entry",
                            isDisabled: isSubmitting,
                            action: deleteAction
                        )
                        .padding(.top, NeoGymTheme.spacingSM)
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
            onCancel: onCancel,
            onSubmit: onSubmit
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
                    .foregroundColor(NeoGymTheme.textSecondary)
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
                    .foregroundStyle(NeoGymTheme.accentText)
                    .background(
                        Capsule(style: .continuous)
                            .fill(NeoGymTheme.accentSoft)
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(NeoGymTheme.accentText.opacity(0.4), lineWidth: NeoGymTheme.hairline)
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
            .cardSurface(
                cornerRadius: NeoGymTheme.radiusMD,
                fill: NeoGymTheme.surface
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
                .cardSurface(
                    cornerRadius: NeoGymTheme.radiusMD,
                    fill: NeoGymTheme.inset
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
                .foregroundStyle(NeoGymTheme.text)
                .padding(.top, level <= 2 ? 4 : 2)
        case let .paragraph(text):
            Text(text)
                .font(.body)
                .foregroundColor(NeoGymTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        case let .unorderedList(items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                        Text(item)
                    }
                    .font(.body)
                    .foregroundColor(NeoGymTheme.textSecondary)
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
                    .foregroundColor(NeoGymTheme.textSecondary)
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
            .foregroundColor(selected ? NeoGymTheme.accentText : NeoGymTheme.textSecondary)
            .background(chipBackground)
            .contentShape(Capsule(style: .continuous))
    }

    @ViewBuilder
    private var chipBackground: some View {
        Capsule(style: .continuous)
            .fill(selected ? NeoGymTheme.accent : NeoGymTheme.fill)
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
