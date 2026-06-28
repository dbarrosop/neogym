import Foundation

public enum CardioMetricFormat: String, Sendable, Equatable {
    case integer
    case decimal
    case durationSeconds = "duration_seconds"
    case average
}

public enum CardioMetricAggregation: String, Sendable, Equatable {
    case sum
    case average
}

public struct CardioMetricPropertySchema: Sendable, Equatable {
    public var type: String?
    public var minimum: Double?
    public var maximum: Double?
    public var exclusiveMaximum: Double?
    public var label: String?
    public var unit: String?
    public var format: CardioMetricFormat?
    public var order: Int?

    public init(
        type: String? = nil,
        minimum: Double? = nil,
        maximum: Double? = nil,
        exclusiveMaximum: Double? = nil,
        label: String? = nil,
        unit: String? = nil,
        format: CardioMetricFormat? = nil,
        order: Int? = nil
    ) {
        self.type = type
        self.minimum = minimum
        self.maximum = maximum
        self.exclusiveMaximum = exclusiveMaximum
        self.label = label
        self.unit = unit
        self.format = format
        self.order = order
    }

    public init?(json: JSONValue) {
        guard case let .object(object) = json else { return nil }
        self.init(
            type: object["type"]?.stringValue,
            minimum: object["minimum"]?.numberValue,
            maximum: object["maximum"]?.numberValue,
            exclusiveMaximum: object["exclusiveMaximum"]?.numberValue,
            label: object["x-label"]?.stringValue,
            unit: object["x-unit"]?.stringValue,
            format: object["x-format"]?.stringValue.flatMap(CardioMetricFormat.init(rawValue:)),
            order: object["x-order"]?.intValue
        )
    }
}

public struct CardioMetricsSchema: Sendable, Equatable {
    public var type: String
    public var additionalProperties: Bool
    public var properties: [String: CardioMetricPropertySchema]
    public var required: [String]

    public init(
        type: String = "object",
        additionalProperties: Bool = false,
        properties: [String: CardioMetricPropertySchema],
        required: [String] = []
    ) {
        self.type = type
        self.additionalProperties = additionalProperties
        self.properties = properties
        self.required = required
    }

    public init?(json: JSONValue) {
        guard case let .object(object) = json,
              object["type"]?.stringValue == "object",
              case let .object(rawProperties)? = object["properties"]
        else {
            return nil
        }

        var properties: [String: CardioMetricPropertySchema] = [:]
        for (key, value) in rawProperties {
            properties[key] = CardioMetricPropertySchema(json: value) ?? CardioMetricPropertySchema()
        }

        let required = object["required"]?.arrayValue?.compactMap(\.stringValue) ?? []
        self.init(
            type: "object",
            additionalProperties: object["additionalProperties"]?.boolValue ?? false,
            properties: properties,
            required: required
        )
    }
}

public typealias CardioMetrics = [String: Double]

public struct CardioMetricSpec: Sendable, Equatable {
    public var key: String
    public var label: String
    public var unit: String
    public var format: CardioMetricFormat
    public var required: Bool
    public var minimum: Double?
    public var maximum: Double?
    public var exclusiveMaximum: Double?
    public var order: Int

    public init(
        key: String,
        label: String,
        unit: String,
        format: CardioMetricFormat,
        required: Bool,
        minimum: Double? = nil,
        maximum: Double? = nil,
        exclusiveMaximum: Double? = nil,
        order: Int
    ) {
        self.key = key
        self.label = label
        self.unit = unit
        self.format = format
        self.required = required
        self.minimum = minimum
        self.maximum = maximum
        self.exclusiveMaximum = exclusiveMaximum
        self.order = order
    }
}

public enum CardioFieldState: Sendable, Equatable {
    case text(String)
    case duration(hours: String, minutes: String, seconds: String)
}

public enum CardioParsedField: Sendable, Equatable {
    case value(Double)
    case empty
    case invalid
}

public enum CardioMetricsValidationError: Error, Sendable, Equatable {
    case missingRequired(String)
    case unknownMetric(String)
    case expectedInteger(String)
    case belowMinimum(String, Double)
    case aboveMaximum(String, Double)
    case atOrAboveExclusiveMaximum(String, Double)
}

public enum CardioMetricsSchemaHelpers {
    public static func aggregation(for format: CardioMetricFormat) -> CardioMetricAggregation {
        format == .average ? .average : .sum
    }

    public static func asSchema(_ raw: JSONValue) -> CardioMetricsSchema? {
        CardioMetricsSchema(json: raw)
    }

    public static func iterateMetrics(_ schema: CardioMetricsSchema) -> [CardioMetricSpec] {
        let required = Set(schema.required)
        return schema.properties.map { key, property in
            CardioMetricSpec(
                key: key,
                label: property.label ?? key,
                unit: property.unit ?? "",
                format: property.format ?? (property.type == "integer" ? .integer : .decimal),
                required: required.contains(key),
                minimum: property.minimum,
                maximum: property.maximum,
                exclusiveMaximum: property.exclusiveMaximum,
                order: property.order ?? 0
            )
        }
        .sorted { left, right in
            if left.order != right.order { return left.order < right.order }
            return left.key < right.key
        }
    }

    public static func formatSecondsAsDuration(_ totalSeconds: Double) -> String {
        guard totalSeconds.isFinite, totalSeconds >= 0 else { return "0:00" }
        let seconds = Int(floor(totalSeconds))
        let hours = seconds / 3_600
        let minutes = (seconds % 3_600) / 60
        let remainder = seconds % 60
        if hours > 0 {
            return "\(hours):\(pad2(minutes)):\(pad2(remainder))"
        }
        return "\(minutes):\(pad2(remainder))"
    }

    public static func formatMetricValue(_ value: Any?, spec: CardioMetricSpec, locale: Locale = .current) -> String {
        guard let number = finiteNumber(from: value) else { return "—" }
        switch spec.format {
        case .durationSeconds:
            return formatSecondsAsDuration(number)
        case .integer, .average:
            return formatted(number, maximumFractionDigits: 0, locale: locale) + unitSuffix(spec.unit)
        case .decimal:
            return formatted(number, maximumFractionDigits: 2, locale: locale) + unitSuffix(spec.unit)
        }
    }

    public static func parseDecimalInput(_ raw: String) -> Double? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              trimmed.range(of: #"^\d+([\.,]\d+)?$"#, options: .regularExpression) != nil
        else {
            return nil
        }
        let parsed = Double(trimmed.replacingOccurrences(of: ",", with: "."))
        return parsed?.isFinite == true ? parsed : nil
    }

    public static func parseIntegerInput(_ raw: String) -> Int? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              trimmed.range(of: #"^\d+$"#, options: .regularExpression) != nil,
              let parsed = Int(trimmed)
        else {
            return nil
        }
        return parsed
    }

    public static func durationPartsToSeconds(hours: String? = nil, minutes: String? = nil, seconds: String? = nil) -> Int? {
        guard let parsedHours = parseDurationPart(hours),
              let parsedMinutes = parseDurationPart(minutes),
              let parsedSeconds = parseDurationPart(seconds)
        else {
            return nil
        }
        return parsedHours * 3_600 + parsedMinutes * 60 + parsedSeconds
    }

    public static func secondsToDurationParts(_ totalSeconds: Double) -> (h: Int, m: Int, s: Int) {
        let safe = totalSeconds.isFinite && totalSeconds > 0 ? Int(floor(totalSeconds)) : 0
        return (safe / 3_600, (safe % 3_600) / 60, safe % 60)
    }

    public static func shouldShowHoursInput(maximum: Double?) -> Bool {
        (maximum ?? Double.infinity) > 3_600
    }

    public static func seedFieldStates(specs: [CardioMetricSpec], seed: CardioMetrics?) -> [String: CardioFieldState] {
        Dictionary(uniqueKeysWithValues: specs.map { spec in
            let value = seed?[spec.key]
            if spec.format == .durationSeconds {
                return (spec.key, seedDurationField(spec: spec, totalSeconds: value ?? 0))
            }
            return (spec.key, .text(value.map(formatSeedNumber) ?? ""))
        })
    }

    public static func parseField(spec: CardioMetricSpec, raw: CardioFieldState?) -> CardioParsedField {
        if spec.format == .durationSeconds {
            let duration: (hours: String, minutes: String, seconds: String)
            if case let .duration(hours, minutes, seconds) = raw {
                duration = (hours, minutes, seconds)
            } else {
                duration = ("", "", "")
            }
            if duration.hours.isEmpty, duration.minutes.isEmpty, duration.seconds.isEmpty {
                return .empty
            }
            guard let totalSeconds = durationPartsToSeconds(
                hours: duration.hours,
                minutes: duration.minutes,
                seconds: duration.seconds
            ) else {
                return .invalid
            }
            return .value(Double(totalSeconds))
        }

        let text: String
        if case let .text(value) = raw {
            text = value.trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            text = ""
        }
        guard !text.isEmpty else { return .empty }

        if spec.format == .integer || spec.format == .average {
            guard let parsed = parseIntegerInput(text) else { return .invalid }
            return .value(Double(parsed))
        }

        guard let parsed = parseDecimalInput(text) else { return .invalid }
        return .value(parsed)
    }

    private static func seedDurationField(spec: CardioMetricSpec, totalSeconds: Double) -> CardioFieldState {
        if !shouldShowHoursInput(maximum: spec.maximum) {
            let safe = totalSeconds.isFinite && totalSeconds > 0 ? Int(floor(totalSeconds)) : 0
            let minutes = safe / 60
            let seconds = safe % 60
            return .duration(
                hours: "",
                minutes: minutes > 0 ? String(minutes) : "",
                seconds: seconds > 0 ? String(seconds) : ""
            )
        }

        let parts = secondsToDurationParts(totalSeconds)
        return .duration(
            hours: parts.h > 0 ? String(parts.h) : "",
            minutes: parts.m > 0 ? String(parts.m) : "",
            seconds: parts.s > 0 ? String(parts.s) : ""
        )
    }

    private static func parseDurationPart(_ raw: String?) -> Int? {
        guard let raw else { return 0 }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return 0 }
        guard trimmed.range(of: #"^\d+$"#, options: .regularExpression) != nil else { return nil }
        return Int(trimmed)
    }

    private static func finiteNumber(from value: Any?) -> Double? {
        switch value {
        case let value as Double where value.isFinite:
            return value
        case let value as Float where value.isFinite:
            return Double(value)
        case let value as Int:
            return Double(value)
        case let value as Decimal:
            let double = NSDecimalNumber(decimal: value).doubleValue
            return double.isFinite ? double : nil
        case let value as JSONValue:
            guard let number = value.numberValue, number.isFinite else { return nil }
            return number
        default:
            return nil
        }
    }

    private static func formatted(_ value: Double, maximumFractionDigits: Int, locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = maximumFractionDigits
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? formatSeedNumber(value)
    }

    private static func formatSeedNumber(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(value)
    }

    private static func unitSuffix(_ unit: String) -> String {
        unit.isEmpty ? "" : " \(unit)"
    }

    private static func pad2(_ value: Int) -> String {
        String(format: "%02d", value)
    }
}

private extension JSONValue {
    var intValue: Int? {
        guard let number = numberValue else { return nil }
        return number.isFinite ? Int(number) : nil
    }
}
