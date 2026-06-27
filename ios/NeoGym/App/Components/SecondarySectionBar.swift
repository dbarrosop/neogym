import SwiftUI

protocol SecondaryTabSection: CaseIterable, Hashable, Identifiable {
    var title: String { get }
    var icon: String { get }
}

struct SecondarySectionBar<Section: SecondaryTabSection>: View where Section.AllCases: RandomAccessCollection {
    @Binding var selection: Section

    var body: some View {
        Picker("Section", selection: $selection) {
            ForEach(Section.allCases) { section in
                Text(section.title).tag(section)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingXS)
        .background(.bar)
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityLabel("Section")
    }
}
