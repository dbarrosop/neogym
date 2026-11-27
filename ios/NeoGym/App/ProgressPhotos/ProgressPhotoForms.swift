import CoreTransferable
import NeoGymKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Consume a provider-owned file in-place. Only a bounded, stripped JPEG and
/// a small decoded preview leave the transfer closure.
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
    let highlightedAngle: String?
    let onFinished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date: String
    @State private var catalog = PhotoFormCatalog()
    @State private var slots: [String: Slot] = [:]
    @State private var selection: Selection?
    @State private var checkIn: ProgressPhotoCheckIn?
    @State private var uploading = false
    @State private var uploadRequest = 0

    private struct Selection {
        let id = UUID()
        let angle: String
        let item: PhotosPickerItem
    }

    private enum Slot {
        case invalid(String), prepared(PickedProgressPhoto), sending(PickedProgressPhoto)
        case retry(PickedProgressPhoto, ProgressPhotoUploadResult), finished(ProgressPhotoUploadResult)

        var queued: PickedProgressPhoto? {
            switch self {
            case let .prepared(photo), let .retry(photo, _): photo
            default: nil
            }
        }

        var locked: Bool {
            switch self {
            case .sending, .retry, .finished: true
            default: false
            }
        }

        var isUploaded: Bool {
            if case .finished(.ready) = self { return true }
            return false
        }
    }

    init(repository: any ProgressPhotoRepositoryProtocol, scope: ProgressPhotoRouteScope,
         initialDate: String?, highlightedAngle: String?, onFinished: @escaping () -> Void) {
        self.repository = repository
        self.scope = scope
        self.highlightedAngle = highlightedAngle
        self.onFinished = onFinished
        let today = ProgressPhotoDate.today()
        _date = State(initialValue: initialDate.flatMap { ProgressPhotoDate.isValid($0, through: today) ? $0 : nil } ?? today)
    }

    private var queue: [ProgressPhotoAngle] { catalog.angles.filter { slots[$0.value]?.queued != nil } }
    private var uploadedCount: Int { slots.values.filter(\.isUploaded).count }
    private var canUpload: Bool {
        !uploading && selection == nil && !queue.isEmpty && ProgressPhotoDate.isValid(date, through: ProgressPhotoDate.today())
    }
    private var uploadLabel: String {
        if uploading { return "Uploading…" }
        if slots.values.contains(where: { if case .retry = $0 { true } else { false } }) { return "Try again" }
        if queue.count > 1 { return "Upload \(queue.count) photos" }
        return queue.count == 1 ? "Upload photo" : "Upload photos"
    }

    var body: some View {
        FormScrollContainer {
            FormSection(header: "Check-in") {
                PhotoDateField(date: $date).disabled(checkIn != nil || uploading)
            }
            Text("Choose one JPEG, PNG or HEIC still per angle. NeoGym removes source metadata before uploading. Only your signed-in account can access your photos.")
                .font(.footnote).foregroundStyle(NeoGymTheme.textSecondary)
            PhotoCatalogStatus(catalog: catalog) { catalog.request += 1 }
            ForEach(catalog.angles) { label in slot(label) }
            if uploadedCount > 0 {
                Label("\(uploadedCount) uploaded", systemImage: "checkmark.circle").font(.subheadline)
            }
        }
        .navigationTitle("Add progress photos")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(uploadedCount > 0 ? "Done" : "Cancel", role: .cancel) {
                    if uploadedCount > 0 { onFinished() } else { dismiss() }
                }
                .disabled(uploading)
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(uploadLabel, action: submit).fontWeight(.semibold).disabled(!canUpload)
            }
        }
        .task(id: selection?.id) { if let selection { await prepare(selection) } }
        .task(id: catalog.request) { await PhotoFormCatalog.load($catalog, repository: repository, scope: scope) }
        .task(id: uploadRequest) { if uploading { await upload() } }
    }

    private func slot(_ label: ProgressPhotoAngle) -> some View {
        let state = slots[label.value]
        return VStack(alignment: .leading, spacing: 8) {
            Text(label.name).font(.headline).accessibilityAddTraits(.isHeader)
            switch state {
            case let .prepared(photo), let .sending(photo), let .retry(photo, _):
                Image(photo.preview, scale: 1, label: Text("\(label.name) upload preview"))
                    .resizable().scaledToFit().frame(maxWidth: .infinity, maxHeight: 150)
            default: EmptyView()
            }
            if selection?.angle == label.value { InlineProgressLabel(title: "Preparing photo…") }
            if let state { slotStatus(state) }
            if state?.locked != true {
                PhotosPicker(selection: picker(for: label.value), matching: .images, preferredItemEncoding: .current) {
                    Label(state?.queued == nil ? "Choose photo" : "Replace photo", systemImage: "photo")
                }
                .buttonStyle(.bordered).controlSize(.large)
                .disabled(selection != nil || uploading)
                .accessibilityLabel("\(state?.queued == nil ? "Choose" : "Replace") \(label.name) photo")
                .accessibilityIdentifier("progressPhotos.choose.\(label.value)")
                if state?.queued != nil {
                    Button("Remove selected photo", role: .destructive) { slots[label.value] = nil }
                        .frame(minHeight: 44)
                        .disabled(selection != nil || uploading)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(stroke: highlightedAngle == label.value ? NeoGymTheme.accent : nil)
    }

    @ViewBuilder private func slotStatus(_ slot: Slot) -> some View {
        switch slot {
        case .prepared: Text("Ready to upload").font(.footnote)
        case .sending: InlineProgressLabel(title: "Uploading photo…")
        case let .invalid(message): FeedbackBanner(message: message)
        case let .retry(_, result), let .finished(result):
            switch result {
            case .ready: Label("Uploaded", systemImage: "checkmark.circle").font(.subheadline)
            case .checkAgain: FeedbackBanner(message: "Couldn't confirm the upload. Check the connection and try again.")
            case .processing: FeedbackBanner(message: "Storage is still processing this photo. Try again shortly.")
            case .unconfirmedReservation: FeedbackBanner(message: "Couldn't confirm the reservation. No photo was sent. Leave this form before starting a new submission for this angle.")
            case .unavailableReservation: FeedbackBanner(message: "This reservation is no longer available. Leave this form before starting a new submission for this angle.")
            }
        }
    }

    private func picker(for angle: String) -> Binding<PhotosPickerItem?> {
        Binding(get: { selection?.angle == angle ? selection?.item : nil }, set: { item in
            guard let item, !uploading, selection == nil, slots[angle]?.locked != true else { return }
            selection = Selection(angle: angle, item: item)
        })
    }

    private func prepare(_ selected: Selection) async {
        do {
            let result = try await selected.item.loadTransferable(type: PickedProgressPhoto.self)
            try scope.check()
            guard selection?.id == selected.id else { return }
            guard let result else { throw ProgressPhotoError.invalidImage }
            slots[selected.angle] = .prepared(result)
        } catch {
            guard (try? scope.check()) != nil, selection?.id == selected.id else { return }
            let message: String
            switch error as? ProgressPhotoError {
            case .inputTooLarge: message = "Choose a photo no larger than 25 MiB."
            case .dimensionsTooLarge: message = "Choose a photo up to 40 megapixels and 12,000 pixels per side."
            default: message = "Couldn't prepare this photo. Choose a JPEG, PNG or HEIC still."
            }
            slots[selected.angle] = .invalid(message)
        }
        selection = nil
    }

    private func submit() {
        guard canUpload, (try? scope.check()) != nil else { return }
        if checkIn == nil { checkIn = ProgressPhotoCheckIn(repository: repository, date: date) }
        uploading = true
        uploadRequest += 1
    }

    private func upload() async {
        guard let checkIn else { return }
        for label in queue {
            guard (try? scope.check()) != nil, let photo = slots[label.value]?.queued,
                  let fields = ProgressPhotoFields(label: label.value, date: date, catalog: catalog.angles) else { continue }
            slots[label.value] = .sending(photo)
            do {
                let result = try await checkIn.upload(photo.jpeg, fields: fields)
                try scope.check()
                slots[label.value] = result.canRetry ? .retry(photo, result) : .finished(result)
            } catch {
                guard (try? scope.check()) != nil else { return }
                slots[label.value] = .retry(photo, .checkAgain)
            }
        }
        guard (try? scope.check()) != nil else { return }
        uploading = false
        if uploadedCount > 0 && slots.values.allSatisfy({ if case .invalid = $0 { true } else { $0.isUploaded } }) {
            onFinished()
        }
    }
}

struct ProgressPhotoEdit: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let photo: ProgressPhoto
    @Environment(\.dismiss) private var dismiss
    @State private var angle: String
    @State private var date: String
    @State private var catalog = PhotoFormCatalog()
    @State private var pending: ProgressPhotoFields?
    @State private var error: String?

    init(repository: any ProgressPhotoRepositoryProtocol, scope: ProgressPhotoRouteScope, photo: ProgressPhoto) {
        self.repository = repository
        self.scope = scope
        self.photo = photo
        _angle = State(initialValue: photo.label.value)
        _date = State(initialValue: photo.takenOn)
    }

    private var values: ProgressPhotoFields? { ProgressPhotoFields(label: angle, date: date, catalog: catalog.angles) }

    var body: some View {
        FormScrollContainer {
            FormSection(header: "Details") {
                if !catalog.angles.isEmpty {
                    FormRow {
                        Picker("Angle", selection: $angle) {
                            if !catalog.angles.contains(where: { $0.value == angle }) { Text("Angle unavailable").tag(angle) }
                            ForEach(catalog.angles) { Text($0.name).tag($0.value) }
                        }
                        .pickerStyle(.menu)
                    }
                }
                PhotoDateField(date: $date)
            }
            .disabled(pending != nil)
            PhotoCatalogStatus(catalog: catalog) { catalog.request += 1 }
            if date > ProgressPhotoDate.today() { FeedbackBanner(message: "Choose today or an earlier date.") }
            if pending != nil { InlineProgressLabel(title: "Saving changes…") }
            if let error { FeedbackBanner(message: error) }
        }
        .nativeFormActionToolbar(submitLabel: "Save", isSubmitting: pending != nil, isSubmitEnabled: values != nil,
                                 onCancel: { dismiss() }, onSubmit: { error = nil; pending = values })
        .task(id: catalog.request) { await PhotoFormCatalog.load($catalog, repository: repository, scope: scope) }
        .task(id: pending?.label) { if let pending { await save(pending) } }
    }

    private func save(_ values: ProgressPhotoFields) async {
        do {
            let saved = try await repository.update(photo.id, fields: values)
            try scope.check()
            guard saved else { throw ProgressPhotoError.unavailable }
            dismiss()
        } catch {
            guard (try? scope.check()) != nil else { return }
            self.error = "Couldn't save changes. Check the connection and try Save again."
            pending = nil
        }
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
            let angles = try await repository.angles()
            try scope.check()
            binding.wrappedValue.angles = angles
            binding.wrappedValue.loaded = true
        } catch {
            if (try? scope.check()) != nil { binding.wrappedValue.failed = true }
        }
    }
}

private struct PhotoCatalogStatus: View {
    let catalog: PhotoFormCatalog
    let retry: () -> Void

    var body: some View {
        if catalog.failed {
            AppErrorStateView(title: "Couldn't load photo angles", message: "Check your connection and try again.", retry: retry)
        } else if !catalog.loaded {
            AppLoadingStateView(title: "Loading photo angles")
        } else if catalog.angles.isEmpty {
            FeedbackBanner(message: "No photo angles are available.")
        }
    }
}

private struct PhotoDateField: View {
    @Binding var date: String

    var body: some View {
        FormRow {
            DatePicker("Date taken", selection: selection, in: ...max(today, selection.wrappedValue), displayedComponents: .date)
                .datePickerStyle(.compact)
                .environment(\.calendar, ProgressPhotoDate.pickerCalendar)
                .environment(\.timeZone, ProgressPhotoDate.pickerCalendar.timeZone)
        }
    }

    private var today: Date { DateOnly.parse(ProgressPhotoDate.today(), calendar: ProgressPhotoDate.pickerCalendar) ?? AppClock.now() }
    private var selection: Binding<Date> {
        Binding(get: { DateOnly.parse(date, calendar: ProgressPhotoDate.pickerCalendar) ?? today },
                set: { date = DateOnly.formatLocalISO($0, calendar: ProgressPhotoDate.pickerCalendar) })
    }
}
