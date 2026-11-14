import NeoGymKit
import SwiftUI

struct NutritionPlanCreateView: View {
    @StateObject private var editor: NutritionPlanEditorViewModel
    var onCreated: (String) -> Void
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: NutritionPlanFormModel?

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        onCreated: @escaping (String) -> Void,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: NutritionPlanEditorViewModel(planId: nil, repository: repository))
        self.onCreated = onCreated
        self.onFinished = onFinished
        self.editorRepository = repository
    }

    private let editorRepository: any NutritionFoodMealRepositoryProtocol

    var body: some View {
        planEditorBody(
            loadingTitle: "Loading meals",
            formTitle: "New plan",
            submitLabel: "Create plan",
            onSubmit: submit,
            onCancel: {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        )
        .navigationTitle("New plan")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadIfNeeded() }
    }

    private func loadIfNeeded() async {
        if case .idle = editor.state {
            await editor.load()
            if let initialValues = editor.initialValues, form == nil {
                form = NutritionPlanFormModel(initialValues: initialValues)
            }
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit(availableMeals: editor.meals, availableFoods: editor.foods) else { return }
        Task {
            if let id = await editor.create(values: values) {
                onCreated(id)
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func planEditorBody(
        loadingTitle: String,
        formTitle: String,
        submitLabel: String,
        onSubmit: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) -> some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: loadingTitle)
            case .loading where form == nil:
                AppLoadingStateView(title: loadingTitle)
            case let .failed(message, _) where form == nil:
                SectionShell(title: formTitle) {
                    AppErrorStateView(title: "Failed to load plan form", message: message) {
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let form {
                    NutritionPlanFormScreen(
                        submitLabel: submitLabel,
                        form: form,
                        meals: editor.meals,
                        foods: editor.foods,
                        repository: editorRepository,
                        reloadOptions: { await editor.load() },
                        isSubmitting: editor.saveState.isLoading,
                        errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
                        onSubmit: onSubmit,
                        onCancel: onCancel
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
    }
}

struct NutritionPlanEditView: View {
    @StateObject private var editor: NutritionPlanEditorViewModel
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: NutritionPlanFormModel?
    @State private var confirmDelete = false

    init(
        planId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: NutritionPlanEditorViewModel(planId: planId, repository: repository))
        self.onSaved = onSaved
        self.onDeleted = onDeleted
        self.editorRepository = repository
    }

    private let editorRepository: any NutritionFoodMealRepositoryProtocol

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                AppLoadingStateView(title: "Loading plan")
            case .loading where form == nil:
                AppLoadingStateView(title: "Loading plan")
            case let .failed(message, _) where form == nil:
                SectionShell(title: "Plan") {
                    AppErrorStateView(title: "Failed to load plan", message: message) { Task { await editor.load() } }
                }
                .padding(20)
            default:
                if let form {
                    NutritionPlanFormScreen(
                        submitLabel: "Save changes",
                        form: form,
                        meals: editor.meals,
                        foods: editor.foods,
                        repository: editorRepository,
                        reloadOptions: { await editor.load() },
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
        .navigationTitle("Edit plan")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = NutritionPlanFormModel(initialValues: initialValues)
                }
            }
        }
        .confirmationDialog("Delete this plan?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete plan", role: .destructive) { deletePlan() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Days that used this plan keep everything you logged.")
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit(availableMeals: editor.meals, availableFoods: editor.foods) else { return }
        Task {
            if await editor.save(values: values) {
                onSaved()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func deletePlan() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

struct QuickMealSheetRequest: Identifiable {
    let id = UUID().uuidString
    let planMealSlotStableId: String
    var mealId: String?
}
