import Combine
import Foundation

public struct BodyMeasurement: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let measuredOn: String
    public let weightKg: Double?
    public let bodyFatPct: Double?
    public let notes: String?
    public let updatedAt: String?

    public init(
        id: String,
        measuredOn: String,
        weightKg: Double? = nil,
        bodyFatPct: Double? = nil,
        notes: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.measuredOn = measuredOn
        self.weightKg = weightKg
        self.bodyFatPct = bodyFatPct
        self.notes = notes
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case measuredOn
        case weightKg
        case bodyFatPct
        case notes
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        measuredOn = try container.decode(String.self, forKey: .measuredOn)
        weightKg = try container.decodeBodyOptionalDouble(forKey: .weightKg)
        bodyFatPct = try container.decodeBodyOptionalDouble(forKey: .bodyFatPct)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

public struct BodyMeasurementFormValues: Sendable, Equatable {
    public let measuredOn: String
    public let weightKg: String
    public let bodyFatPct: String
    public let notes: String

    public init(measuredOn: String, weightKg: String, bodyFatPct: String, notes: String) {
        self.measuredOn = measuredOn
        self.weightKg = weightKg
        self.bodyFatPct = bodyFatPct
        self.notes = notes
    }
}

public enum BodyMeasurementValidationResult: Equatable, Sendable {
    case success(BodyMeasurementFormValues)
    case failure(String)
}

public enum BodyMeasurementValidation {
    public static let weightMin = 0.0
    public static let weightMax = 500.0
    public static let bodyFatMin = 0.0
    public static let bodyFatMax = 100.0

    public static func normalizeDecimalInput(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    }

    public static func validate(_ values: BodyMeasurementFormValues) -> BodyMeasurementValidationResult {
        let measuredOn = values.measuredOn.trimmingCharacters(in: .whitespacesAndNewlines)
        guard DateOnly.parse(measuredOn) != nil else {
            return .failure("Choose a valid measurement date.")
        }

        let weight = normalizeDecimalInput(values.weightKg)
        let fat = normalizeDecimalInput(values.bodyFatPct)
        guard !weight.isEmpty || !fat.isEmpty else {
            return .failure("Enter a weight, a body-fat %, or both.")
        }

        if !weight.isEmpty {
            guard matchesNumericInputShape(weight) else {
                return .failure("Use up to 3 digits and 2 decimal places.")
            }
            guard let value = Double(weight), value > weightMin, value < weightMax else {
                return .failure("Weight must be greater than 0 and less than 500 kg.")
            }
        }

        if !fat.isEmpty {
            guard matchesNumericInputShape(fat) else {
                return .failure("Use up to 3 digits and 2 decimal places.")
            }
            guard let value = Double(fat), value >= bodyFatMin, value < bodyFatMax else {
                return .failure("Body fat must be at least 0 % and less than 100 %.")
            }
        }

        return .success(BodyMeasurementFormValues(
            measuredOn: measuredOn,
            weightKg: weight,
            bodyFatPct: fat,
            notes: values.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        ))
    }

    private static func matchesNumericInputShape(_ value: String) -> Bool {
        let parts = value.split(separator: ".", omittingEmptySubsequences: false)
        guard !value.isEmpty, parts.count == 1 || parts.count == 2 else { return false }
        let whole = parts[0]
        let fraction = parts.count == 2 ? parts[1] : ""
        guard whole.count <= 3, fraction.count <= 2 else { return false }
        return whole.allSatisfy(\.isNumber) && fraction.allSatisfy(\.isNumber)
    }
}

@MainActor
public final class BodyMeasurementFormModel: ObservableObject {
    @Published public var measuredOn: String
    @Published public var weightKg: String
    @Published public var bodyFatPct: String
    @Published public var notes: String
    @Published public private(set) var errorMessage: String?

    public init(initialValues: BodyMeasurementFormValues) {
        measuredOn = initialValues.measuredOn
        weightKg = initialValues.weightKg
        bodyFatPct = initialValues.bodyFatPct
        notes = initialValues.notes
    }

    public var hasMeasurementValue: Bool {
        !weightKg.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !bodyFatPct.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public func valuesForSubmit() -> BodyMeasurementFormValues? {
        let result = BodyMeasurementValidation.validate(BodyMeasurementFormValues(
            measuredOn: measuredOn,
            weightKg: weightKg,
            bodyFatPct: bodyFatPct,
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

    public static func values(from measurement: BodyMeasurement) -> BodyMeasurementFormValues {
        BodyMeasurementFormValues(
            measuredOn: measurement.measuredOn,
            weightKg: measurement.weightKg.map(Self.formatEditable) ?? "",
            bodyFatPct: measurement.bodyFatPct.map(Self.formatEditable) ?? "",
            notes: measurement.notes ?? ""
        )
    }

    private static func formatEditable(_ value: Double) -> String {
        let number = NSNumber(value: value)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = false
        return formatter.string(from: number) ?? String(value)
    }
}

public struct BodyMeasurementChartPoint: Identifiable, Sendable, Equatable {
    public let id: String
    public let measuredOn: String
    public let date: Date
    public let time: TimeInterval
    public let weightKg: Double?
    public let bodyFatPct: Double?

    public init(id: String, measuredOn: String, date: Date, weightKg: Double?, bodyFatPct: Double?) {
        self.id = id
        self.measuredOn = measuredOn
        self.date = date
        time = date.timeIntervalSince1970
        self.weightKg = weightKg
        self.bodyFatPct = bodyFatPct
    }
}

public struct BodyMeasurementTrendData: Sendable, Equatable {
    public let points: [BodyMeasurementChartPoint]

    public init(points: [BodyMeasurementChartPoint]) {
        self.points = points
    }

    public var weightCount: Int { points.filter { $0.weightKg != nil }.count }
    public var bodyFatCount: Int { points.filter { $0.bodyFatPct != nil }.count }
    public var shouldShowChart: Bool { weightCount >= 2 || bodyFatCount >= 2 }

    public func filtered(
        by timescale: BodyMeasurementTrendTimescale,
        customStartISO: String? = nil,
        customEndISO: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> BodyMeasurementTrendData {
        BodyMeasurementTrendRangeFilter.filter(
            self,
            by: timescale,
            customStartISO: customStartISO,
            customEndISO: customEndISO,
            calendar: calendar,
            now: now
        )
    }
}

public enum BodyMeasurementTrendTimescale: String, CaseIterable, Identifiable, Sendable {
    case last7Days
    case last30Days
    case last90Days
    case last180Days
    case custom

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .last7Days: "Last 7d"
        case .last30Days: "Last 30d"
        case .last90Days: "Last 90d"
        case .last180Days: "Last 180d"
        case .custom: "Custom…"
        }
    }

    public var days: Int? {
        switch self {
        case .last7Days: 7
        case .last30Days: 30
        case .last90Days: 90
        case .last180Days: 180
        case .custom: nil
        }
    }
}

public enum BodyMeasurementTrendRangeFilter {
    public static func filter(
        _ trendData: BodyMeasurementTrendData,
        by timescale: BodyMeasurementTrendTimescale,
        customStartISO: String? = nil,
        customEndISO: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> BodyMeasurementTrendData {
        guard let range = dateRange(
            for: timescale,
            customStartISO: customStartISO,
            customEndISO: customEndISO,
            calendar: calendar,
            now: now
        ) else { return trendData }

        let filteredPoints = trendData.points.filter { point in
            point.date >= range.start && point.date < range.endExclusive
        }
        return BodyMeasurementTrendData(points: filteredPoints)
    }

    private static func dateRange(
        for timescale: BodyMeasurementTrendTimescale,
        customStartISO: String?,
        customEndISO: String?,
        calendar: Calendar,
        now: Date
    ) -> (start: Date, endExclusive: Date)? {
        if let days = timescale.days {
            let today = calendar.startOfDay(for: now)
            let start = calendar.date(byAdding: .day, value: -(days - 1), to: today) ?? today
            let end = calendar.date(byAdding: .day, value: 1, to: today) ?? today
            return (start, end)
        }

        guard let customStartISO,
              let customEndISO,
              let parsedStart = DateOnly.parse(customStartISO, calendar: calendar),
              let parsedEnd = DateOnly.parse(customEndISO, calendar: calendar)
        else { return nil }

        let start = min(parsedStart, parsedEnd)
        let end = max(parsedStart, parsedEnd)
        let endExclusive = calendar.date(byAdding: .day, value: 1, to: end) ?? end
        return (start, endExclusive)
    }
}

public enum BodyMeasurementTrendBuilder {
    public static func make(
        from measurements: [BodyMeasurement],
        calendar: Calendar = .current
    ) -> BodyMeasurementTrendData {
        let points = measurements.compactMap { measurement -> BodyMeasurementChartPoint? in
            guard let date = DateOnly.parse(measurement.measuredOn, calendar: calendar) else { return nil }
            return BodyMeasurementChartPoint(
                id: measurement.id,
                measuredOn: measurement.measuredOn,
                date: date,
                weightKg: measurement.weightKg,
                bodyFatPct: measurement.bodyFatPct
            )
        }
        .sorted { lhs, rhs in
            if lhs.time == rhs.time { return lhs.id < rhs.id }
            return lhs.time < rhs.time
        }
        return BodyMeasurementTrendData(points: points)
    }
}

public enum BodyMeasurementsErrorMapper {
    public static func message(for error: Error) -> String {
        let domainError = GraphQLDomainError.map(error)
        if isDuplicateMeasuredOnError(domainError) {
            return "You already have a measurement for this date. Edit that entry or choose another date."
        }
        return domainError.localizedDescription
    }

    private static func isDuplicateMeasuredOnError(_ error: GraphQLDomainError) -> Bool {
        guard case let .graphQLErrors(details) = error else { return false }
        return details.contains { detail in
            let constraint = detail.constraintName?.lowercased() ?? ""
            if constraint == "body_measurements_user_date_key"
                || constraint == "body_measurements_user_id_measured_on_key"
                || constraint.contains("body_measurements") && constraint.contains("measured") {
                return true
            }
            let message = detail.message.lowercased()
            return message.contains("body_measurements_user_date_key")
                || message.contains("body_measurements_user_id_measured_on_key")
        }
    }
}

private extension KeyedDecodingContainer {
    func decodeBodyOptionalDouble(forKey key: Key) throws -> Double? {
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
