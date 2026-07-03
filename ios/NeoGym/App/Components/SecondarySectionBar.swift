import SwiftUI

protocol SecondaryTabSection: CaseIterable, Hashable, Identifiable {
    var title: String { get }
    var systemImage: String? { get }
}

extension SecondaryTabSection {
    var systemImage: String? { nil }
}

struct SectionTitleMenu<Section: SecondaryTabSection>: View where Section.AllCases: RandomAccessCollection {
    @Binding var selection: Section

    var body: some View {
        Menu {
            SectionTitleMenuContent(selection: $selection)
        } label: {
            HStack(spacing: NeoGymTheme.spacingXXS) {
                if let systemImage = selection.systemImage {
                    Image(systemName: systemImage)
                        .imageScale(.small)
                }
                Text(selection.title)
                    .fontWeight(.semibold)
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.semibold))
            }
            .lineLimit(1)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.primary)
        .accessibilityLabel("Choose section")
        .accessibilityValue(selection.title)
    }
}

struct SectionTitleMenuContent<Section: SecondaryTabSection>: View where Section.AllCases: RandomAccessCollection {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Binding var selection: Section

    var body: some View {
        ForEach(Section.allCases) { section in
            Button {
                select(section)
            } label: {
                HStack {
                    Label(section.title, systemImage: section.systemImage ?? "circle")
                    if section == selection {
                        Spacer()
                        Image(systemName: "checkmark")
                    }
                }
            }
            .accessibilityLabel(section.title)
            .accessibilityValue(section == selection ? "Current section" : "")
        }
    }

    private func select(_ section: Section) {
        withAnimation(sectionTransitionAnimation) {
            selection = section
        }
    }

    private var sectionTransitionAnimation: Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.24)
    }
}

struct SecondarySectionContentHost<Section: SecondaryTabSection, Content: View>: View
where Section.AllCases: RandomAccessCollection {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Binding private var selection: Section
    @State private var activeSections: Set<Section>

    private let content: (Section) -> Content

    init(
        selection: Binding<Section>,
        @ViewBuilder content: @escaping (Section) -> Content
    ) {
        _selection = selection
        _activeSections = State(initialValue: [selection.wrappedValue])
        self.content = content
    }

    var body: some View {
        ZStack {
            ForEach(Section.allCases) { section in
                if shouldKeepAlive(section) {
                    content(section)
                        .opacity(selection == section ? 1 : 0)
                        .scaleEffect(scale(for: section))
                        .zIndex(selection == section ? 1 : 0)
                        .allowsHitTesting(selection == section)
                        .accessibilityHidden(selection != section)
                }
            }
        }
        .animation(sectionTransitionAnimation, value: selection)
        .onAppear { activeSections.insert(selection) }
        .onChange(of: selection) { newValue in
            activeSections.insert(newValue)
        }
    }

    private var sectionTransitionAnimation: Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.24)
    }

    private func scale(for section: Section) -> CGFloat {
        guard !reduceMotion else { return 1 }
        return selection == section ? 1 : 0.985
    }

    private func shouldKeepAlive(_ section: Section) -> Bool {
        activeSections.contains(section) || section == selection
    }
}
