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
            .padding([.top, .horizontal], 24)
            .padding(.bottom, 18)

            VStack(spacing: 16) {
                content
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)

            footer
                .font(.footnote)
                .foregroundColor(NeoGymTheme.mutedText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.vertical, 16)
                .background(Color.primary.opacity(0.018))
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(NeoGymTheme.border)
                        .frame(height: 1)
                }
        }
        .frame(maxWidth: NeoGymTheme.maxCardWidth)
        .background(
            .ultraThinMaterial,
            in: RoundedRectangle(cornerRadius: NeoGymTheme.cardCornerRadius, style: .continuous)
        )
        .background(
            NeoGymTheme.cardFill,
            in: RoundedRectangle(cornerRadius: NeoGymTheme.cardCornerRadius, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: NeoGymTheme.cardCornerRadius, style: .continuous)
                .stroke(NeoGymTheme.border)
        )
        .shadow(color: Color.accentColor.opacity(0.08), radius: 30, y: 16)
        .padding(.horizontal, 20)
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
