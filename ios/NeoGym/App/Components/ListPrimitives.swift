import SwiftUI

/// Search field on the fill token, 44 pt tall, with a clear button.
struct SearchField: View {
    let placeholder: String
    @Binding var text: String
    var onClear: (() -> Void)?

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingXS) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(NeoGymTheme.textSecondary)
                .accessibilityHidden(true)
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityLabel(placeholder)
            if !text.isEmpty {
                Button {
                    if let onClear { onClear() } else { text = "" }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(NeoGymTheme.textSecondary)
                        .frame(width: NeoGymTheme.minimumTapTarget, height: NeoGymTheme.minimumTapTarget)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.leading, NeoGymTheme.spacingSM)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .cardSurface(cornerRadius: NeoGymTheme.radiusMD, fill: NeoGymTheme.fill)
    }
}

/// One title, one metadata line, one trailing value; chevron when it pushes.
struct ListRow: View {
    let title: String
    var subtitle: String?
    var trailingValue: String?
    var trailingCaption: String?
    var showsChevron = true

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.text)
                    .multilineTextAlignment(.leading)
                if let subtitle {
                    Text(subtitle)
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: NeoGymTheme.spacingXS)
            if let trailingValue {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(trailingValue)
                        .font(.body.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.text)
                    if let trailingCaption {
                        Text(trailingCaption)
                            .font(.caption)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                }
            }
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 10)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Hairline between rows of a grouped card.
struct RowSeparator: View {
    var leadingInset: CGFloat = NeoGymTheme.spacingMD

    var body: some View {
        Divider()
            .overlay(NeoGymTheme.separator)
            .padding(.leading, leadingInset)
    }
}
