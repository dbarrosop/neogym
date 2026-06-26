import SwiftUI

struct GridBackground: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [Color(.systemBackground), Color(.secondarySystemBackground)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                RadialGradient(
                    colors: [Color.purple.opacity(0.22), .clear],
                    center: .top,
                    startRadius: 20,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.72
                )

                RadialGradient(
                    colors: [Color.blue.opacity(0.16), .clear],
                    center: .bottomTrailing,
                    startRadius: 20,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.62
                )

                GridPattern(spacing: 32)
                    .stroke(Color.primary.opacity(0.055), lineWidth: 1)
            }
        }
        .ignoresSafeArea()
    }
}

private struct GridPattern: Shape {
    let spacing: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        var columnPosition = rect.minX
        while columnPosition <= rect.maxX {
            path.move(to: CGPoint(x: columnPosition, y: rect.minY))
            path.addLine(to: CGPoint(x: columnPosition, y: rect.maxY))
            columnPosition += spacing
        }

        var rowPosition = rect.minY
        while rowPosition <= rect.maxY {
            path.move(to: CGPoint(x: rect.minX, y: rowPosition))
            path.addLine(to: CGPoint(x: rect.maxX, y: rowPosition))
            rowPosition += spacing
        }

        return path
    }
}
