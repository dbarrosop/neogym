import SwiftUI

protocol SecondaryTabSection: CaseIterable, Equatable, Identifiable {
    var title: String { get }
    var icon: String { get }
}

struct SecondarySectionBar<Section: SecondaryTabSection>: View where Section.AllCases: RandomAccessCollection {
    @Binding var selection: Section

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: NeoGymTheme.spacingXS) {
                ForEach(Section.allCases) { section in
                    SecondarySectionBarItem(
                        section: section,
                        isSelected: selection == section
                    ) {
                        selection = section
                    }
                }
            }
            .padding(NeoGymTheme.spacingXS)
        }
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusXL,
            material: .thin,
            tint: NeoGymTheme.glassFill,
            stroke: NeoGymTheme.glassStroke,
            shadow: true
        )
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.top, NeoGymTheme.spacingSM)
        .padding(.bottom, NeoGymTheme.spacingXS)
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .accessibilityElement(children: .contain)
    }
}

private struct SecondarySectionBarItem<Section: SecondaryTabSection>: View {
    let section: Section
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(section.title, systemImage: section.icon)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .foregroundColor(isSelected ? .white : NeoGymTheme.primaryText)
                .padding(.horizontal, NeoGymTheme.spacingSM)
                .padding(.vertical, NeoGymTheme.spacingXS)
                .frame(minWidth: 88, minHeight: 44)
                .background(itemBackground)
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(section.title)
        .accessibilityValue(isSelected ? "Selected" : "")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var itemBackground: some View {
        if isSelected {
            Capsule(style: .continuous)
                .fill(NeoGymTheme.primaryActionGradient)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.32), lineWidth: NeoGymTheme.hairline)
                )
        } else {
            Capsule(style: .continuous)
                .fill(Color.clear)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(NeoGymTheme.glassStrokeSecondary, lineWidth: NeoGymTheme.hairline)
                )
        }
    }
}
