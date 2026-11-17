import NeoGymKit
import SwiftUI

/// The display for today's same-owner snapshot, or nil before the first read today.
@MainActor
private func todayDisplay<Runtime: WatchPageRuntime>(_ runtime: Runtime) -> EnergyBalanceDisplay? {
    guard let snapshot = runtime.snapshot else { return nil }
    let display = EnergyBalanceDisplay(snapshot.displayInput, at: runtime.displayDate)
    return display.isCurrentDay ? display : nil
}

/// Page 1: balance so far with the resting / active split, then in and out, in the
/// same words and numbers as the phone's Today card.
struct WatchTodayPage<Runtime: WatchPageRuntime>: View {
    @ObservedObject var runtime: Runtime

    var body: some View {
        let display = todayDisplay(runtime)
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text("So far today")
                    .font(WatchType.caption)
                    .foregroundStyle(WatchPalette.textSecondary)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(display?.balance ?? KcalText.missing)
                        .font(.system(size: 38, weight: .bold))
                        .tracking(-0.76)
                    Text("kcal")
                        .font(WatchType.body)
                        .foregroundStyle(WatchPalette.textSecondary)
                }
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(display?.balanceAccessibility ?? "Balance unavailable")
                if let display, display.split != nil {
                    EnergySplitBar(split: display.split, restingColor: WatchPalette.chart1,
                                   activeColor: WatchPalette.chart2, trackColor: WatchPalette.fill)
                        .frame(height: 7)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(display.splitAccessibility ?? "")
                    HStack(spacing: 9) {
                        legend(WatchPalette.chart1, "Resting \(display.resting)")
                        legend(WatchPalette.chart2, "Active \(display.active)")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(WatchPalette.textSecondary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .accessibilityHidden(true)
                }
                VStack(spacing: 3) {
                    WatchValueRow(label: "In", value: display?.consumed ?? KcalText.missing,
                                  accessibilityValue: display.map { "\($0.consumed) kilocalories" })
                    WatchValueRow(label: "Out", value: display?.burned ?? KcalText.missing,
                                  accessibilityValue: display?.hasEnergy == true
                                      ? "\(display?.burned ?? "") kilocalories" : "unavailable")
                }
                .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 4)
        }
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 7, height: 7)
            Text(text)
        }
    }
}

/// Page 2: the end-of-day estimate, the 7-day average net and Refresh.
struct WatchEndOfDayPage<Runtime: WatchPageRuntime, Account: WatchPageAccount>: View {
    @ObservedObject var runtime: Runtime
    @ObservedObject var account: Account

    var body: some View {
        let display = todayDisplay(runtime)
        ScrollView {
            VStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("By end of day")
                        .font(WatchType.caption)
                        .foregroundStyle(WatchPalette.textSecondary)
                    if let display, let net = display.endOfDayNet {
                        WatchValueRow(label: "Net", value: net, accessibilityValue: "about \(net.dropFirst(2)) kilocalories")
                        if let burned = display.endOfDayBurned {
                            WatchValueRow(label: "Burned", value: burned,
                                          accessibilityValue: "about \(burned.dropFirst(2)) kilocalories")
                        }
                    } else {
                        Text("Needs resting energy from recent days.")
                            .font(WatchType.caption)
                            .foregroundStyle(WatchPalette.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(WatchPalette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                WatchValueRow(label: "7-day avg", value: display?.sevenDayAverage ?? KcalText.missing)
                    .padding(.horizontal, 4)

                Button {
                    Task { await runtime.refreshFromPage() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.watchCapsule())
                .disabled(runtime.isRefreshing || !runtime.contextReady || account.isReadingProfile)
                .accessibilityHint("Reads today's numbers again")

                if let snapshot = runtime.snapshot {
                    Text(snapshot.pendingBackend == true
                         ? "Health estimate \(snapshot.updatedAt, style: .time)"
                         : "Synced \(snapshot.updatedAt, style: .time)")
                        .font(WatchType.small)
                        .foregroundStyle(WatchPalette.textTertiary)
                }
                if let error = account.profileError {
                    WatchNote(text: "\(error) Tap Refresh to retry.")
                }
                if let error = runtime.errorMessage {
                    WatchNote(text: error)
                }
            }
            .padding(.horizontal, 2)
        }
    }
}

/// Before the first read: NeoGym asks for read-only active and resting energy.
struct WatchHealthAccessPage<Runtime: WatchPageRuntime, Account: WatchPageAccount>: View {
    @ObservedObject var runtime: Runtime
    @ObservedObject var account: Account

    var body: some View {
        WatchMessageView(
            title: "Allow Health access",
            message: "NeoGym reads active and resting energy. It never writes to Health."
        ) {
            Image(systemName: "heart.fill")
                .font(.system(size: 26))
                .foregroundStyle(WatchPalette.health)
        } actions: {
            Button("Allow") { Task { await runtime.enableHealth() } }
                .buttonStyle(.watchCapsule(.primary))
                .disabled(!runtime.contextReady || account.isReadingProfile || account.profileError != nil)
            if let error = runtime.errorMessage {
                WatchNote(text: error)
            }
        }
    }
}
