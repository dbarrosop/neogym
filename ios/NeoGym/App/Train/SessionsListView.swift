import NeoGymKit
import SwiftUI

/// Train › Sessions: every logged session, newest first, grouped by week.
struct SessionsListView: View {
    @StateObject private var viewModel: SessionsListViewModel
    let reloadToken: Int
    let onRefresh: @MainActor () async -> Void

    init(
        sessionsRepository: any SessionsRepositoryProtocol,
        reloadToken: Int,
        onRefresh: @escaping @MainActor () async -> Void = {}
    ) {
        _viewModel = StateObject(wrappedValue: SessionsListViewModel(repository: sessionsRepository))
        self.reloadToken = reloadToken
        self.onRefresh = onRefresh
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable {
            await viewModel.load()
            await onRefresh()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading sessions")
        case .loading where viewModel.sessions.isEmpty:
            AppLoadingStateView(title: "Loading sessions")
        case let .failed(message, _) where viewModel.sessions.isEmpty:
            AppErrorStateView(title: "Couldn't load sessions", message: message) {
                Task { await viewModel.load() }
            }
            .cardSurface()
        default:
            if viewModel.sessions.isEmpty {
                AppEmptyStateView(
                    title: "No sessions yet",
                    message: "Start a session from a workout or an exercise to log your training.",
                    systemImage: "dumbbell"
                )
                .cardSurface()
            } else {
                ForEach(SessionWeekGrouping.groups(viewModel.sessions)) { group in
                    weekGroup(group)
                }
                if viewModel.hasNextPage {
                    Button {
                        Task { await viewModel.loadMore() }
                    } label: {
                        Text(viewModel.isLoadingMore ? "Loading…" : "Load more")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                    .disabled(viewModel.isLoadingMore)
                    .padding(.top, NeoGymTheme.spacingXS)
                }
            }
        }
    }

    private func weekGroup(_ group: SessionWeekGroup) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            HStack(alignment: .firstTextBaseline) {
                Text(group.title)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(NeoGymTheme.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: NeoGymTheme.spacingXS)
                Text(group.summary)
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            .padding(.horizontal, NeoGymTheme.spacingXXS)
            .padding(.top, NeoGymTheme.spacingSM)
            VStack(spacing: 0) {
                ForEach(group.sessions) { session in
                    NavigationLink(value: TrainRoute.sessionDetail(session.id)) {
                        SessionListRow(session: session)
                    }
                    .buttonStyle(.plain)
                    if session.id != group.sessions.last?.id {
                        Divider()
                            .overlay(NeoGymTheme.separator)
                            .padding(.leading, 68)
                    }
                }
            }
            .cardSurface()
        }
    }
}

private struct SessionListRow: View {
    let session: SessionListItem

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            SessionMonogram(name: session.displayName, isTemplated: session.workout != nil)
            VStack(alignment: .leading, spacing: 2) {
                Text(session.displayName)
                    .font(.headline)
                    .foregroundStyle(NeoGymTheme.text)
                    .lineLimit(2)
                Text(caption)
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            Spacer(minLength: NeoGymTheme.spacingXS)
            Text("\(session.entryCount) set\(session.entryCount == 1 ? "" : "s")")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NeoGymTheme.textTertiary)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingSM)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var caption: String {
        var parts: [String] = []
        if let date = session.startedAtDate {
            parts.append(date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))
            parts.append(date.formatted(date: .omitted, time: .shortened))
        }
        parts.append("\(session.exerciseCount) exercise\(session.exerciseCount == 1 ? "" : "s")")
        return parts.joined(separator: " · ")
    }
}

/// Two-letter tile identifying a session; templated sessions use the accent.
struct SessionMonogram: View {
    let name: String
    let isTemplated: Bool

    var body: some View {
        Text(initials)
            .font(.footnote.weight(.bold))
            .foregroundStyle(isTemplated ? NeoGymTheme.accentText : NeoGymTheme.textSecondary)
            .frame(width: 40, height: 40)
            .background(
                RoundedRectangle(cornerRadius: NeoGymTheme.radiusSM, style: .continuous)
                    .fill(isTemplated ? NeoGymTheme.accentSoft : NeoGymTheme.fill)
            )
            .accessibilityHidden(true)
    }

    private var initials: String {
        // Skip tokens that start with a digit so "bulk-002 (lower A)" reads "BL", not "B0".
        let words = name.split { !$0.isLetter && !$0.isNumber }
            .filter { $0.first?.isLetter == true }
            .prefix(2)
        let letters = words.compactMap(\.first).map { String($0).uppercased() }
        return letters.isEmpty ? "S" : letters.joined()
    }
}
