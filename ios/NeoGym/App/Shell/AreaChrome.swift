import SwiftUI

/// Segmented section control shown under the large title on an area root.
struct AreaSectionPicker<Section: AreaSection>: View {
    let label: String
    @Binding var selection: Section

    var body: some View {
        Picker(label, selection: $selection) {
            ForEach(Section.allCases) { section in
                Text(section.title).tag(section)
            }
        }
        .pickerStyle(.segmented)
        .controlSize(.large)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .accessibilityLabel(label)
    }
}

private struct AreaSectionHeaderKey: EnvironmentKey {
    nonisolated(unsafe) static let defaultValue: AnyView? = nil
}

extension EnvironmentValues {
    /// The area root's section picker, rendered by `AreaSectionHeader` at the
    /// top of each section's scroll content so it sits under the large title.
    var areaSectionHeader: AnyView? {
        get { self[AreaSectionHeaderKey.self] }
        set { self[AreaSectionHeaderKey.self] = newValue }
    }
}

/// Placeholder for the area's section picker; empty outside an area root.
struct AreaSectionHeader: View {
    @Environment(\.areaSectionHeader) private var header

    var body: some View {
        if let header {
            header
        }
    }
}

/// Top-trailing primary create/log action for an area root or section.
struct AreaPrimaryAction: ToolbarContent {
    let title: String
    var systemImage = "plus"
    let action: () -> Void

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button(action: action) {
                Label(title, systemImage: systemImage)
                    .labelStyle(.iconOnly)
            }
            .tint(NeoGymTheme.text)
            .accessibilityLabel(title)
        }
    }
}

extension View {
    /// The app background token behind a screen's scroll content.
    func screenBackground() -> some View {
        background(NeoGymTheme.background.ignoresSafeArea())
    }

    /// Standard large-title area root chrome.
    func areaRoot(title: String) -> some View {
        navigationTitle(title)
            .navigationBarTitleDisplayMode(.large)
            .screenBackground()
    }
}
