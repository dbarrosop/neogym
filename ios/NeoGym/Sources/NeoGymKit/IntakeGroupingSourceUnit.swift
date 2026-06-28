import Foundation

struct MutableIntakeTimeSlot: Sendable {
    var key: String
    var label: String
    var sortKey: String
    var sourceUnits: [IntakeSourceUnit]
}

enum IntakeSourceKind: Sendable {
    case meal
    case standalone
}

enum IntakeSourceUnit: Sendable {
    case meal(id: String, position: Double, meal: IntakeSlotMealGroup, entries: [IntakeEntry])
    case standalone(id: String, position: Double, entry: IntakeEntry)

    var id: String {
        switch self {
        case let .meal(id, _, _, _), let .standalone(id, _, _):
            return id
        }
    }

    var position: Double {
        switch self {
        case let .meal(_, position, _, _), let .standalone(_, position, _):
            return position
        }
    }

    var kind: IntakeSourceKind {
        switch self {
        case .meal:
            return .meal
        case .standalone:
            return .standalone
        }
    }
}
