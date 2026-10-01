/// A background-only launch may finish bootstrap before SwiftUI creates a view.
/// Consume that background work on the next active scene, not on an inactive wrist raise.
public struct WatchForegroundRefreshGate: Sendable {
    private var wasBackground = false

    public init() {}

    public mutating func enteredBackground() {
        wasBackground = true
    }

    public mutating func enteredActive() -> Bool {
        defer { wasBackground = false }
        return wasBackground
    }
}
