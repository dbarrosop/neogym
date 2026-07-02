import Foundation

public enum StrengthSetSeeding {
    public static func seedSet(
        currentSets: [SessionStrengthSet],
        priorEntries: [SessionPriorStrengthEntry]
    ) -> SessionStrengthSet? {
        if let latestCurrentSet = highestNumberedSet(in: currentSets) {
            return latestCurrentSet
        }

        let newestPriorEntry = priorEntries
            .enumerated()
            .filter { !$0.element.sets.isEmpty }
            .sorted { lhs, rhs in
                let lhsDate = ExerciseDateParser.parseTimestamp(lhs.element.startedAt) ?? .distantPast
                let rhsDate = ExerciseDateParser.parseTimestamp(rhs.element.startedAt) ?? .distantPast
                if lhsDate != rhsDate { return lhsDate > rhsDate }
                return lhs.offset < rhs.offset
            }
            .first?
            .element

        guard let newestPriorEntry else { return nil }
        return highestNumberedSet(in: newestPriorEntry.sets)
    }

    private static func highestNumberedSet(in sets: [SessionStrengthSet]) -> SessionStrengthSet? {
        sets.enumerated().max { lhs, rhs in
            if lhs.element.setNumber != rhs.element.setNumber {
                return lhs.element.setNumber < rhs.element.setNumber
            }
            return lhs.offset < rhs.offset
        }?.element
    }
}

public enum StrengthSetNumbering {
    public static func nextSetNumber(currentSets: [SessionStrengthSet]) -> Int {
        (currentSets.map(\.setNumber).max() ?? 0) + 1
    }
}

public enum StrengthSetFormatting {
    public static func setSummary(
        _ set: SessionStrengthSet,
        doubleWeight: Bool,
        includeSideSuffix: Bool
    ) -> String {
        let weight = set.weight == 0 ? "BW" : "\(formatWeight(set.weight)) kg"
        let sideSuffix = includeSideSuffix && doubleWeight && set.weight > 0 ? " /side" : ""
        return "\(weight) × \(set.reps)\(sideSuffix)"
    }

    public static func recentSummary(_ sets: [SessionStrengthSet], doubleWeight: Bool) -> String {
        guard !sets.isEmpty else { return "no sets" }
        let hasWeightedSet = sets.contains { $0.weight > 0 }
        let summary = sets
            .map(compactSetSummary)
            .joined(separator: ", ")
        return summary + (doubleWeight && hasWeightedSet ? " /side" : "")
    }

    private static func compactSetSummary(_ set: SessionStrengthSet) -> String {
        let weight = set.weight == 0 ? "BW" : formatWeight(set.weight)
        return "\(weight)x\(set.reps)"
    }

    public static func formatWeight(_ weight: Double) -> String {
        weight.rounded() == weight ? String(format: "%.0f", weight) : String(format: "%.1f", weight)
    }
}
