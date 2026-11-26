import CoreTransferable
import NeoGymKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// A file-backed transfer. The provider owns the temporary URL; only the
/// bounded, stripped JPEG and a small decoded preview leave this closure.
private struct PickedProgressPhoto: Transferable {
    let jpeg: Data
    let preview: CGImage

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .image) { received in
            let jpeg = try ProgressPhotoImage.prepare(file: received.file)
            return Self(jpeg: jpeg, preview: try ProgressPhotoImage.display(jpeg, thumbnail: true))
        }
    }
}

struct ProgressPhotoCreate: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let onCreated: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selection: PhotosPickerItem?
    @State private var draft: PickedProgressPhoto?
    @State private var fields = PhotoFormDraft()
    @State private var catalog = PhotoFormCatalog()
    @State private var attempt: ProgressPhotoUploadAttempt?
    @State private var outcome: ProgressPhotoUploadResult?
    @State private var preparing = false
    @State private var uploading = false
    @State private var uploadRequest = 0
    @State private var error: String?

    private var canSubmit: Bool {
        guard !preparing, selection == nil, !uploading else { return false }
        if let outcome { return outcome == .checkAgain || outcome == .processing }
        return attempt == nil && draft != nil && fields.validated(catalog.angles) != nil
    }

    var body: some View {
        let pickerTitle = draft == nil ? "Choose photo" : "Choose another photo"
        FormScrollContainer {
            FormSection(header: "Photo", footer: "Choose one JPEG, PNG or HEIC still. NeoGym removes source metadata before uploading. Only your signed-in account can access it.") {
                PhotosPicker(selection: $selection, matching: .images, preferredItemEncoding: .current) {
                    Text(pickerTitle)
                        .frame(minHeight: 44, alignment: .leading)
                        .padding(.horizontal, 16)
                }
                .disabled(attempt != nil || preparing || uploading)
            }
            if let draft {
                Image(draft.preview, scale: 1, label: Text("Preview for upload"))
                    .resizable().scaledToFit().frame(maxHeight: 260)
                    .frame(maxWidth: .infinity)
            }
            PhotoFormFields(fields: $fields, catalog: catalog) { catalog.request += 1 }
                .disabled(attempt != nil)
            if preparing { InlineProgressLabel(title: "Preparing photo…") }
            if uploading {
                InlineProgressLabel(title: outcome == nil ? "Uploading photo…" : "Checking upload…")
            }
            if let error { FeedbackBanner(message: error) }
            if let message = uploadMessage { FeedbackBanner(message: message) }
        }
        .navigationTitle("Add progress photo")
        .navigationBarTitleDisplayMode(.inline)
        .nativeFormActionToolbar(
            submitLabel: attempt == nil ? "Save" : "Check upload", isSubmitting: uploading,
            isSubmitEnabled: canSubmit, onCancel: { dismiss() }, onSubmit: submit
        )
        .task(id: selection) { if let selection { await prepare(selection) } }
        .task(id: catalog.request) { await PhotoFormCatalog.load($catalog, repository: repository, scope: scope) }
        .task(id: uploadRequest) { if uploading { await upload() } }
    }

    private var uploadMessage: String? {
        switch outcome {
        case .unconfirmedReservation:
            "Couldn't confirm the reservation. No photo was sent. Return to the gallery before starting another submission."
        case .unavailableReservation:
            "This reservation is no longer available. Return to the gallery before starting another submission."
        case .processing:
            "Storage is still processing this photo. Check again shortly; don't start a new submission for it."
        case .checkAgain:
            "Couldn't confirm the upload. Check the connection and check this upload again."
        default: nil
        }
    }

    private func prepare(_ item: PhotosPickerItem) async {
        guard attempt == nil else { return }
        draft = nil
        error = nil
        preparing = true
        do {
            let result = try await item.loadTransferable(type: PickedProgressPhoto.self)
            try scope.check()
            guard let result else { throw ProgressPhotoError.invalidImage }
            draft = result
        } catch {
            guard (try? scope.check()) != nil else { return }
            switch error as? ProgressPhotoError {
            case .inputTooLarge: self.error = "Choose a photo no larger than 25 MiB."
            case .dimensionsTooLarge: self.error = "Choose a photo up to 40 megapixels and 12,000 pixels per side."
            default: self.error = "Couldn't prepare this photo. Choose a JPEG, PNG or HEIC still."
            }
        }
        preparing = false
        selection = nil
    }

    private func submit() {
        guard canSubmit, (try? scope.check()) != nil else { return }
        if attempt == nil, let draft, let values = fields.validated(catalog.angles) {
            attempt = ProgressPhotoUploadAttempt(repository: repository, fields: values, jpeg: draft.jpeg)
        }
        guard attempt != nil else { return }
        uploading = true
        uploadRequest += 1
    }

    private func upload() async {
        do {
            try scope.check()
            guard let attempt else { return }
            let result = try await attempt.run()
            try scope.check()
            uploading = false
            if case let .ready(id) = result {
                onCreated(id)
            } else {
                outcome = result
            }
        } catch {
            guard (try? scope.check()) != nil else { return }
            uploading = false
            outcome = .checkAgain
        }
    }
}

struct ProgressPhotoEdit: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let photo: ProgressPhoto
    let onDeleted: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var fields: PhotoFormDraft
    @State private var catalog = PhotoFormCatalog()
    @State private var confirmDelete = false
    @State private var deleteAttempt: ProgressPhotoDeleteAttempt?
    @State private var pending: Operation?
    @State private var error: String?

    private enum Operation { case save(ProgressPhotoFields), delete }
    @State private var request = 0

    init(repository: any ProgressPhotoRepositoryProtocol, scope: ProgressPhotoRouteScope,
         photo: ProgressPhoto, onDeleted: @escaping () -> Void) {
        self.repository = repository
        self.scope = scope
        self.photo = photo
        self.onDeleted = onDeleted
        _fields = State(initialValue: PhotoFormDraft(angle: photo.label.value, date: photo.takenOn))
    }

    var body: some View {
        FormScrollContainer {
            PhotoFormFields(fields: $fields, catalog: catalog) { catalog.request += 1 }
                .disabled(pending != nil)
            if let pending {
                switch pending {
                case .save: InlineProgressLabel(title: "Saving changes…")
                case .delete: InlineProgressLabel(title: "Deleting photo…")
                }
            }
            if let error { FeedbackBanner(message: error) }
            FormDeleteButton(title: "Delete photo", isDisabled: pending != nil) { confirmDelete = true }
        }
        .nativeFormActionToolbar(
            submitLabel: "Save", isSubmitting: pending != nil,
            isSubmitEnabled: fields.validated(catalog.angles) != nil, onCancel: { dismiss() },
            onSubmit: { if let values = fields.validated(catalog.angles) { begin(.save(values)) } }
        )
        .confirmationDialog("Delete this progress photo?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete photo", role: .destructive) { begin(.delete) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The photo will no longer be available in your history. Storage cleanup may continue after it disappears.")
        }
        .task(id: catalog.request) { await PhotoFormCatalog.load($catalog, repository: repository, scope: scope) }
        .task(id: request) { if let pending { await apply(pending) } }
    }

    private func begin(_ operation: Operation) {
        guard pending == nil, (try? scope.check()) != nil else { return }
        pending = operation
        error = nil
        request += 1
    }

    private func apply(_ operation: Operation) async {
        do {
            try scope.check()
            switch operation {
            case let .save(values):
                let saved = try await repository.update(photo.id, fields: values)
                try scope.check()
                guard saved else { throw ProgressPhotoError.unavailable }
                dismiss()
            case .delete:
                let attempt = deleteAttempt ?? ProgressPhotoDeleteAttempt(repository: repository, id: photo.id)
                deleteAttempt = attempt
                let deleted = try await attempt.run()
                try scope.check()
                guard deleted else { throw ProgressPhotoError.unavailable }
                onDeleted()
            }
        } catch {
            guard (try? scope.check()) != nil else { return }
            switch operation {
            case .save: self.error = "Couldn't save changes. Check the connection and try Save again."
            case .delete: self.error = "Couldn't confirm deletion. Check the connection and try Delete again."
            }
            pending = nil
        }
    }
}

private struct PhotoFormDraft {
    var angle = ""
    var date = ProgressPhotoDate.today()

    func validated(_ catalog: [ProgressPhotoAngle]) -> ProgressPhotoFields? {
        ProgressPhotoFields(label: angle, date: date, catalog: catalog)
    }
}

private struct PhotoFormCatalog {
    var request = 0
    var angles: [ProgressPhotoAngle] = []
    var failed = false
    var loaded = false

    @MainActor
    static func load(_ binding: Binding<Self>, repository: any ProgressPhotoRepositoryProtocol,
                     scope: ProgressPhotoRouteScope) async {
        binding.wrappedValue.failed = false
        do {
            try scope.check()
            let angles = try await repository.angles()
            try scope.check()
            binding.wrappedValue.angles = angles
            binding.wrappedValue.loaded = true
        } catch {
            if (try? scope.check()) != nil { binding.wrappedValue.failed = true }
        }
    }
}

private struct PhotoFormFields: View {
    @Binding var fields: PhotoFormDraft
    let catalog: PhotoFormCatalog
    let retry: () -> Void

    var body: some View {
        FormSection(header: "Details") {
            if !catalog.angles.isEmpty {
                FormRow {
                    Picker("Angle", selection: $fields.angle) {
                        if !catalog.angles.contains(where: { $0.value == fields.angle }) {
                            Text(fields.angle.isEmpty ? "Choose an angle" : "Angle unavailable").tag(fields.angle)
                        }
                        ForEach(catalog.angles) { Text($0.name).tag($0.value) }
                    }
                    .pickerStyle(.menu)
                }
            }
            FormRow {
                DatePicker("Date taken", selection: date, in: ...max(today, date.wrappedValue), displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .environment(\.calendar, ProgressPhotoDate.pickerCalendar)
                    .environment(\.timeZone, ProgressPhotoDate.pickerCalendar.timeZone)
            }
        }
        if catalog.failed {
            AppErrorStateView(title: "Couldn't load photo angles", message: "Check your connection and try again.", retry: retry)
        } else if !catalog.loaded {
            AppLoadingStateView(title: "Loading photo angles")
        } else if catalog.angles.isEmpty {
            FeedbackBanner(message: "No photo angles are available.")
        }
        if fields.date > ProgressPhotoDate.today() {
            FeedbackBanner(message: "Choose today or an earlier date.")
        }
    }

    private var today: Date { DateOnly.parse(ProgressPhotoDate.today(), calendar: ProgressPhotoDate.pickerCalendar) ?? AppClock.now() }
    private var date: Binding<Date> {
        Binding(get: { DateOnly.parse(fields.date, calendar: ProgressPhotoDate.pickerCalendar) ?? today },
                set: { fields.date = DateOnly.formatLocalISO($0, calendar: ProgressPhotoDate.pickerCalendar) })
    }
}
