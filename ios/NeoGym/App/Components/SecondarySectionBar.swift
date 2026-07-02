import SwiftUI

protocol SecondaryTabSection: CaseIterable, Hashable, Identifiable {
    var title: String { get }
    var systemImage: String? { get }
}

extension SecondaryTabSection {
    var systemImage: String? { nil }
}

struct SecondarySectionBar<Section: SecondaryTabSection>: View where Section.AllCases: RandomAccessCollection {
    @Binding var selection: Section
    @Namespace private var selectionIndicator

    var body: some View {
        HStack(spacing: itemSpacing) {
            ForEach(Section.allCases) { section in
                sectionButton(section)
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingXXS)
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Section navigation")
    }

    private var itemWidth: CGFloat {
        Section.allCases.count > 3 ? 46 : 56
    }

    private var itemSpacing: CGFloat {
        Section.allCases.count > 3 ? NeoGymTheme.spacingXXS : NeoGymTheme.spacingXS
    }

    private func sectionButton(_ section: Section) -> some View {
        let isSelected = section == selection

        return Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                selection = section
            }
        } label: {
            Group {
                if let systemImage = section.systemImage {
                    Image(systemName: systemImage)
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .accessibilityHidden(true)
                } else {
                    Text(section.title.prefix(1))
                        .font(.system(.headline, design: .rounded).weight(.bold))
                }
            }
            .frame(width: itemWidth, height: 40)
            .foregroundColor(isSelected ? NeoGymTheme.primaryText : NeoGymTheme.secondaryText)
            .background {
                if isSelected {
                    Capsule(style: .continuous)
                        .fill(NeoGymTheme.accentSoft)
                        .matchedGeometryEffect(id: "selection", in: selectionIndicator)
                }
            }
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(section.title)
        .accessibilityValue(isSelected ? "Selected" : "")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
