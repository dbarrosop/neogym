import SwiftUI

/// Watch type scale from the design: title 17 (navigation title), body 15,
/// caption 13, buttons 40 pt tall.
enum WatchType {
    static let body = Font.system(size: 15)
    static let caption = Font.system(size: 13)
    static let small = Font.system(size: 12)
}

/// A 40-point capsule button: accent-filled for the primary action, fill-coloured
/// with accent or destructive text otherwise.
struct WatchCapsuleButtonStyle: ButtonStyle {
    enum Role { case primary, secondary, destructive }
    var role: Role = .secondary

    func makeBody(configuration: Configuration) -> some View {
        CapsuleBody(configuration: configuration, foreground: foreground, background: background)
    }

    private struct CapsuleBody: View {
        @Environment(\.isEnabled) private var isEnabled
        let configuration: Configuration
        let foreground: Color
        let background: Color

        var body: some View {
            configuration.label
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(foreground)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(background, in: Capsule())
                .opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : 0.4)
                .contentShape(Capsule())
        }
    }

    private var foreground: Color {
        switch role {
        case .primary: .white
        case .secondary: WatchPalette.accentText
        case .destructive: WatchPalette.destructive
        }
    }

    private var background: Color {
        role == .primary ? WatchPalette.accentFill : WatchPalette.fill
    }
}

extension ButtonStyle where Self == WatchCapsuleButtonStyle {
    static func watchCapsule(_ role: WatchCapsuleButtonStyle.Role = .secondary) -> WatchCapsuleButtonStyle {
        WatchCapsuleButtonStyle(role: role)
    }
}

/// "In ······ 1,461": a secondary label and a semibold tabular value.
struct WatchValueRow: View {
    let label: String
    let value: String
    var accessibilityValue: String?

    var body: some View {
        HStack {
            Text(label).foregroundStyle(WatchPalette.textSecondary)
            Spacer(minLength: 4)
            Text(value).fontWeight(.semibold)
        }
        .font(WatchType.body)
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label), \(accessibilityValue ?? value)")
    }
}

/// Errors and setup states: an icon, a title, one line and its actions, instead of
/// red text.
struct WatchMessageView<Icon: View, Actions: View>: View {
    let title: String
    let message: String
    @ViewBuilder let icon: Icon
    @ViewBuilder let actions: Actions

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                icon
                    .foregroundStyle(WatchPalette.accentText)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text(message)
                    .font(WatchType.caption)
                    .foregroundStyle(WatchPalette.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(spacing: 6) { actions }
                    .padding(.top, 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
            .padding(.top, 10)
        }
    }
}

/// A non-error note under a control, such as a stale profile or a failed refresh.
struct WatchNote: View {
    let text: String

    var body: some View {
        Label {
            Text(text)
        } icon: {
            Image(systemName: "exclamationmark.circle")
        }
        .font(WatchType.small)
        .foregroundStyle(WatchPalette.textSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }
}
