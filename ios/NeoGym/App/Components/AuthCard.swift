import SwiftUI

struct AuthScreenLayout<Panel: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    let systemImage: String
    @ViewBuilder let panel: Panel

    init(
        eyebrow: String,
        title: String,
        subtitle: String,
        systemImage: String,
        @ViewBuilder panel: () -> Panel
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.panel = panel()
    }

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXL) {
                    AuthHero(
                        eyebrow: eyebrow,
                        title: title,
                        subtitle: subtitle,
                        systemImage: systemImage
                    )
                    .padding(.top, max(NeoGymTheme.spacingXXL, proxy.safeAreaInsets.top + NeoGymTheme.spacingXL))

                    panel
                        .padding(.bottom, max(NeoGymTheme.spacingXXL, proxy.safeAreaInsets.bottom + NeoGymTheme.spacingXL))
                }
                .frame(maxWidth: 620, alignment: .leading)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .frame(maxWidth: .infinity)
                .frame(minHeight: proxy.size.height, alignment: .bottom)
            }
            .scrollDismissesKeyboardCompat()
        }
    }
}

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
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                    Text(title)
                        .font(.title2.bold())
                        .tracking(-0.4)
                    Text(description)
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding([.top, .horizontal], NeoGymTheme.spacingXL)
                .padding(.bottom, NeoGymTheme.spacingLG)

                VStack(spacing: NeoGymTheme.spacingMD) {
                    content
                }
                .frame(maxWidth: .infinity, alignment: .leading)
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
        .frame(maxWidth: .infinity)
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

private struct AuthHero: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingLG) {
            ZStack {
                Circle()
                    .fill(NeoGymTheme.accentSoft)
                    .frame(width: 92, height: 92)
                    .blur(radius: 16)
                    .offset(x: 12, y: 10)
                Circle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 76, height: 76)
                    .overlay(Circle().stroke(NeoGymTheme.glassStrokeSecondary))
                Image(systemName: systemImage)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundColor(NeoGymTheme.accent)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                Text(eyebrow.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(1.6)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text(title)
                    .font(.system(.largeTitle, design: .rounded).weight(.bold))
                    .tracking(-0.8)
                    .fixedSize(horizontal: false, vertical: true)
                Text(subtitle)
                    .font(.body)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 460, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension View {
    @ViewBuilder
    func scrollDismissesKeyboardCompat() -> some View {
        if #available(iOS 16.0, *) {
            self.scrollDismissesKeyboard(.interactively)
        } else {
            self
        }
    }
}
