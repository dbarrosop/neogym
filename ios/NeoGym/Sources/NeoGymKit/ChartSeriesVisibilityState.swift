import Foundation

public struct ChartSeriesVisibilityState: Equatable, Sendable {
    public private(set) var hiddenIDs: Set<String>

    public init(hiddenIDs: Set<String> = []) {
        self.hiddenIDs = hiddenIDs
    }

    public func isVisible(_ id: String) -> Bool {
        !hiddenIDs.contains(id)
    }

    public func visibleIDs(among candidateIDs: [String]) -> [String] {
        guard !candidateIDs.isEmpty else { return [] }

        let visibleIDs = candidateIDs.filter { isVisible($0) }
        return visibleIDs.isEmpty ? candidateIDs : visibleIDs
    }

    public mutating func toggle(_ id: String, among candidateIDs: [String]) {
        guard candidateIDs.contains(id) else { return }

        if hiddenIDs.contains(id) {
            hiddenIDs.remove(id)
            return
        }

        let effectiveVisibleIDs = visibleIDs(among: candidateIDs)
        guard effectiveVisibleIDs.contains(id), effectiveVisibleIDs.count > 1 else { return }
        hiddenIDs.insert(id)
    }
}
