import NeoGymKit
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
/// Caps title above an entry history (Body, Energy) with its "5 of 32" count.
struct EntryListHeader: View {
    let title: String
    let count: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .textCase(.uppercase)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: NeoGymTheme.spacingXS)
            if let count {
                Text(count)
                    .font(.footnote)
                    .monospacedDigit()
                    .accessibilityLabel("Showing \(count) entries")
            }
        }
        .foregroundStyle(NeoGymTheme.textSecondary)
        .padding(.horizontal, NeoGymTheme.spacingXXS)
        .padding(.top, NeoGymTheme.spacingXS)
    }
}

/// Small red heart after a Body or Energy entry's date when the row still
/// carries the Apple Health import note (`HealthImportMarker`).
struct HealthImportHeart: View {
    var body: some View {
        Image(systemName: "heart.fill")
            .font(.caption)
            .foregroundStyle(NeoGymTheme.health)
            .accessibilityLabel(HealthImportMarker.note)
    }
}

/// The last row of a paged list card: a full-width Load more button.
struct LoadMoreRow: View {
    var isLoading = false
    let action: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            RowSeparator(leadingInset: 0)
            Button(action: action) {
                Group {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("Load more")
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(NeoGymTheme.accentText)
            .disabled(isLoading)
        }
    }
}

struct RowSeparator: View {
    var leadingInset: CGFloat = NeoGymTheme.spacingMD

    var body: some View {
        Divider()
            .overlay(NeoGymTheme.separator)
            .padding(.leading, leadingInset)
    }
}
