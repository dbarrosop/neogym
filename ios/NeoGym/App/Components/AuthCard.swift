import SwiftUI

struct AuthCard<Content: View, Footer: View>: View {
    let title: String
    let description: String
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer

    init(
        title: String,
        description: String,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.title = title
        self.description = description
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        GlassPanel(
            cornerRadius: NeoGymTheme.cardCornerRadius,
            material: .regular,
            tint: NeoGymTheme.glassStrongFill,
            contentPadding: EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0)
        ) {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(title)
                        .font(.title2.bold())
                        .tracking(-0.4)
                    Text(description)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding([.top, .horizontal], NeoGymTheme.spacingXL)
                .padding(.bottom, NeoGymTheme.spacingLG)

                VStack(spacing: NeoGymTheme.spacingMD) {
                    content
                }
                .padding(.horizontal, NeoGymTheme.spacingXL)
                .padding(.bottom, NeoGymTheme.spacingXL)

                footer
                    .font(.footnote)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, NeoGymTheme.spacingXL)
                    .padding(.vertical, NeoGymTheme.spacingMD)
                    .background(NeoGymTheme.glassSubtleFill)
                    .overlay(alignment: .top) {
                        GlassDivider()
                    }
            }
        }
        .frame(maxWidth: NeoGymTheme.maxCardWidth)
        .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
    }
}

extension AuthCard where Footer == EmptyView {
    init(
        title: String,
        description: String,
        @ViewBuilder content: () -> Content
    ) {
        self.init(title: title, description: description, content: content) {
            EmptyView()
        }
    }
}
