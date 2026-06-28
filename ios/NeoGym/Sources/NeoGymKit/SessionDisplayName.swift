import Foundation

public enum SessionDisplayName {
    public static let untitled = "Untitled session"

    public static func make(workoutName: String?, exerciseNames: [String]) -> String {
        if let workoutName, !workoutName.isEmpty {
            return workoutName
        }

        guard let first = exerciseNames.first else {
            return untitled
        }

        guard exerciseNames.count > 1 else {
            return first
        }

        return "\(first) +\(exerciseNames.count - 1) more"
    }
}
