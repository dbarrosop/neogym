import NeoGymKit
import SwiftUI

/// Energy out so far: resting (Chart 1) then active (Chart 2), 2 points apart. In a
/// tinted/accented rendering the caller passes `accented`, and active drops to 45 %
/// of the tint so the two parts still read apart without colour. An empty track
/// uses 20 % opacity so it cannot read as a full resting-energy segment.
struct EnergySplitBar: View {
    let split: EnergyBalanceSplit?
    let restingColor: Color
    let activeColor: Color
    let trackColor: Color
    var accented = false

    private let gap: CGFloat = 2

    var body: some View {
        GeometryReader { proxy in
            if let split {
                let bothParts = split.resting > 0 && split.active > 0
                let width = max(proxy.size.width - (bothParts ? gap : 0), 0)
                HStack(spacing: gap) {
                    if split.resting > 0 {
                        Rectangle()
                            .fill(restingColor)
                            .frame(width: width * split.resting / split.total)
                    }
                    if split.active > 0 {
                        Rectangle()
                            .fill(activeColor)
                            .opacity(accented ? 0.45 : 1)
                            .frame(width: width * split.active / split.total)
                    }
                }
            } else {
                Rectangle()
                    .fill(trackColor)
                    .opacity(accented ? 0.2 : 1)
            }
        }
        .clipShape(Capsule())
    }
}
