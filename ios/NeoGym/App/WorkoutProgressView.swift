import NeoGymKit
import SwiftUI

struct WorkoutProgressView: View {
    @StateObject private var muscleModel: MuscleSetProgressViewModel
    @StateObject private var strengthModel: StrengthProgressViewModel
    @State private var selection: ProgressSection = .muscles
    @State private var visited: Set<ProgressSection> = [.muscles]
    let reloadToken: Int

    init(repository: any SessionsRepositoryProtocol, reloadToken: Int) {
        _muscleModel = StateObject(wrappedValue: MuscleSetProgressViewModel(repository: repository))
        _strengthModel = StateObject(wrappedValue: StrengthProgressViewModel(repository: repository))
        self.reloadToken = reloadToken
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Progress view", selection: $selection) {
                ForEach(ProgressSection.allCases) { section in
                    Text(section.title).tag(section)
                }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.spacingXS)
            ZStack {
                MuscleSetProgressView(
                    viewModel: muscleModel, reloadToken: reloadToken, isActive: selection == .muscles
                )
                .opacity(selection == .muscles ? 1 : 0)
                .allowsHitTesting(selection == .muscles)
                .accessibilityHidden(selection != .muscles)
                if visited.contains(.strength) {
                    StrengthProgressView(
                        viewModel: strengthModel, reloadToken: reloadToken, isActive: selection == .strength
                    )
                    .opacity(selection == .strength ? 1 : 0)
                    .allowsHitTesting(selection == .strength)
                    .accessibilityHidden(selection != .strength)
                }
            }
        }
        .navigationTitle("Progress")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: selection) { _, section in visited.insert(section) }
    }
}

private enum ProgressSection: String, CaseIterable, Identifiable {
    case muscles
    case strength
    var id: Self { self }
    var title: String { self == .muscles ? "Muscle sets" : "Strength" }
}

/// Only the active pane loads. Mounted panes keep chart selections and scroll
/// positions; a pane revisited after a mutation or local midnight revalidates.
struct ProgressRefreshModifier<Row: Sendable>: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: ProgressHistoryViewModel<Row>
    let reloadToken: Int
    let isActive: Bool
    @State private var loadedToken: Int?

    func body(content: Content) -> some View {
        content
            .task(id: isActive ? reloadToken : nil) {
                guard isActive else { return }
                if loadedToken != reloadToken || model.rows == nil {
                    loadedToken = reloadToken
                    await model.load()
                } else {
                    await model.refreshIfNewLocalDay()
                }
                // Switching panes can cancel a cached-first load before revalidation.
                if Task.isCancelled { loadedToken = nil }
            }
            .onChange(of: scenePhase) { _, phase in
                guard isActive, phase == .active else { return }
                Task { await model.refreshIfNewLocalDay() }
            }
            .refreshable { await model.load() }
    }
}
