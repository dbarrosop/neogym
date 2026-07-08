import Combine
import Foundation

public struct DailyEnergy: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let energyOn: String
    public let activeKcal: Double?
    public let restingKcal: Double?
    public let notes: String?
    public let updatedAt: String?

    public init(
        id: String,
        energyOn: String,
        activeKcal: Double? = nil,
        restingKcal: Double? = nil,
        notes: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.energyOn = energyOn
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
        self.notes = notes
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case energyOn
        case activeKcal
        case restingKcal
        case notes
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        energyOn = try container.decode(String.self, forKey: .energyOn)
        activeKcal = try container.decodeDailyEnergyOptionalDouble(forKey: .activeKcal)
        restingKcal = try container.decodeDailyEnergyOptionalDouble(forKey: .restingKcal)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

public struct DailyEnergyFormValues: Sendable, Equatable {
    public let energyOn: String
    public let activeKcal: String
    public let restingKcal: String
    public let notes: String

    public init(energyOn: String, activeKcal: String, restingKcal: String, notes: String) {
        self.energyOn = energyOn
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
        self.notes = notes
    }
}

public enum DailyEnergyValidationResult: Equatable, Sendable {
    case success(DailyEnergyFormValues)
    case failure(String)
}

public enum DailyEnergyValidation {
    public static let kcalMin = 0.0
    public static let kcalMax = 30_000.0

    public static func normalizeDecimalInput(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    }

    public static func validate(_ values: DailyEnergyFormValues) -> DailyEnergyValidationResult {
        let energyOn = values.energyOn.trimmingCharacters(in: .whitespacesAndNewlines)
        guard DateOnly.parse(energyOn) != nil else {
            return .failure("Choose a valid energy date.")
        }

        let active = normalizeDecimalInput(values.activeKcal)
        let resting = normalizeDecimalInput(values.restingKcal)
        guard !active.isEmpty || !resting.isEmpty else {
            return .failure("Enter active energy, resting energy, or both.")
        }

        if let message = validateKcal(active, label: "Active energy") {
            return .failure(message)
        }
        if let message = validateKcal(resting, label: "Resting energy") {
            return .failure(message)
        }

        return .success(DailyEnergyFormValues(
            energyOn: energyOn,
            activeKcal: active,
            restingKcal: resting,
            notes: values.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        ))
    }

    private static func validateKcal(_ value: String, label: String) -> String? {
        guard !value.isEmpty else { return nil }
        guard matchesNumericInputShape(value) else {
            return "Use up to 5 digits and 2 decimal places."
        }
        guard let amount = Double(value), amount >= kcalMin, amount < kcalMax else {
            return "\(label) must be at least 0 and less than 30000 kcal."
        }
        return nil
    }

    private static func matchesNumericInputShape(_ value: String) -> Bool {
        let parts = value.split(separator: ".", omittingEmptySubsequences: false)
        guard !value.isEmpty, parts.count == 1 || parts.count == 2 else { return false }
        let whole = parts[0]
        let fraction = parts.count == 2 ? parts[1] : ""
        guard whole.count >= 1, whole.count <= 5, fraction.count <= 2 else { return false }
        return whole.allSatisfy(\.isNumber) && fraction.allSatisfy(\.isNumber)
    }
}

@MainActor
public final class DailyEnergyFormModel: ObservableObject {
    @Published public var energyOn: String
    @Published public var activeKcal: String
    @Published public var restingKcal: String
    @Published public var notes: String
    @Published public private(set) var errorMessage: String?

    public init(initialValues: DailyEnergyFormValues) {
        energyOn = initialValues.energyOn
        activeKcal = initialValues.activeKcal
        restingKcal = initialValues.restingKcal
        notes = initialValues.notes
    }

    public var hasEnergyValue: Bool {
        !activeKcal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !restingKcal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public func valuesForSubmit() -> DailyEnergyFormValues? {
        let result = DailyEnergyValidation.validate(DailyEnergyFormValues(
            energyOn: energyOn,
            activeKcal: activeKcal,
            restingKcal: restingKcal,
            notes: notes
        ))
        switch result {
        case let .success(values):
            errorMessage = nil
            return values
        case let .failure(message):
            errorMessage = message
            return nil
        }
    }

    public static func values(from entry: DailyEnergy) -> DailyEnergyFormValues {
        DailyEnergyFormValues(
            energyOn: entry.energyOn,
            activeKcal: entry.activeKcal.map(DailyEnergyFormatters.editable) ?? "",
            restingKcal: entry.restingKcal.map(DailyEnergyFormatters.editable) ?? "",
            notes: entry.notes ?? ""
        )
    }
}

public enum DailyEnergyFormatters {
    public static func kcal(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(roundedKcal(value)) kcal"
    }

    public static func active(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "Active \(roundedKcal(value)) kcal"
    }

    public static func resting(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "Resting \(roundedKcal(value)) kcal"
    }

    public static func values(activeKcal: Double?, restingKcal: Double?) -> String {
        [active(activeKcal), resting(restingKcal)].filter { $0 != "—" }.joined(separator: " · ")
    }

    public static func axisKcal(_ value: Double) -> String {
        roundedKcal(value)
    }

    public static func editable(_ value: Double) -> String {
        let number = NSNumber(value: value)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = false
        return formatter.string(from: number) ?? String(value)
    }

    private static func roundedKcal(_ value: Double) -> String {
        let number = NSNumber(value: value)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 0
        formatter.usesGroupingSeparator = false
        return formatter.string(from: number) ?? String(format: "%.0f", value)
    }
}

public enum DailyEnergyErrorMapper {
    public static func message(for error: Error) -> String {
        let domainError = GraphQLDomainError.map(error)
        if isDuplicateEnergyOnError(domainError) {
            return "You already have an energy entry for this date. Edit that entry or choose another date."
        }
        return domainError.localizedDescription
    }

    private static func isDuplicateEnergyOnError(_ error: GraphQLDomainError) -> Bool {
        guard case let .graphQLErrors(details) = error else { return false }
        return details.contains { detail in
            let constraint = detail.constraintName?.lowercased() ?? ""
            if constraint == "daily_energy_user_date_key"
                || constraint == "daily_energy_user_id_energy_on_key"
                || isDailyEnergyDateConstraintName(constraint) {
                return true
            }
            let message = detail.message.lowercased()
            return message.contains("daily_energy_user_date_key")
                || message.contains("daily_energy_user_id_energy_on_key")
                || isDailyEnergyDateConstraintName(message)
        }
    }

    private static func isDailyEnergyDateConstraintName(_ value: String) -> Bool {
        value.contains("daily_energy") && (value.contains("date") || value.contains("energy_on"))
    }
}

private extension KeyedDecodingContainer {
    func decodeDailyEnergyOptionalDouble(forKey key: Key) throws -> Double? {
        if try decodeNil(forKey: key) {
            return nil
        }
        if let double = try? decode(Double.self, forKey: key) {
            return double
        }
        if let int = try? decode(Int.self, forKey: key) {
            return Double(int)
        }
        if let string = try? decode(String.self, forKey: key), let double = Double(string) {
            return double
        }
        throw DecodingError.dataCorruptedError(
            forKey: key,
            in: self,
            debugDescription: "Expected optional numeric value"
        )
    }
}
