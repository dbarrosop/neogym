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

    var body: some View {
        Picker("Section", selection: animatedSelection) {
            ForEach(Section.allCases) { section in
                sectionLabel(section)
                    .tag(section)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .frame(width: pickerWidth)
        .dynamicTypeSize(...DynamicTypeSize.large)
        .accessibilityLabel("Section navigation")
    }

    private var animatedSelection: Binding<Section> {
        Binding(
            get: { selection },
            set: { newValue in
                withAnimation(.easeInOut(duration: 0.28)) {
                    selection = newValue
                }
            }
        )
    }

    private var pickerWidth: CGFloat {
        Section.allCases.count > 3 ? 300 : 260
    }

    @ViewBuilder
    private func sectionLabel(_ section: Section) -> some View {
        if let systemImage = section.systemImage {
            Image(systemName: systemImage)
                .accessibilityLabel(section.title)
        } else {
            Text(section.title)
        }
    }
}

struct SecondarySectionContentHost<Section: SecondaryTabSection, Content: View>: View
where Section.AllCases: RandomAccessCollection {
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
                        .scaleEffect(selection == section ? 1 : 0.985)
                        .zIndex(selection == section ? 1 : 0)
                        .allowsHitTesting(selection == section)
                        .accessibilityHidden(selection != section)
                }
            }
        }
        .animation(.easeInOut(duration: 0.28), value: selection)
        .onAppear { activeSections.insert(selection) }
        .onChange(of: selection) { newValue in
            activeSections.insert(newValue)
        }
    }

    private func shouldKeepAlive(_ section: Section) -> Bool {
        activeSections.contains(section) || section == selection
    }
}
