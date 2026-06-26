import Foundation

public enum CardioEntryFormValidationResult: Sendable, Equatable {
    case success(CardioMetrics)
    case failure(key: String, message: String)
}

public struct CardioEntryFormModel: Sendable, Equatable {
    public let schema: CardioMetricsSchema
    public let specs: [CardioMetricSpec]
    public private(set) var values: [String: CardioFieldState]

    public init(
        schema: CardioMetricsSchema,
        initialMetrics: CardioMetrics? = nil,
        previousMetrics: CardioMetrics? = nil
    ) {
        self.schema = schema
        specs = CardioMetricsSchemaHelpers.iterateMetrics(schema)
        values = CardioMetricsSchemaHelpers.seedFieldStates(
            specs: specs,
            seed: initialMetrics ?? previousMetrics
        )
    }

    public mutating func setValue(_ value: CardioFieldState, for key: String) {
        values[key] = value
    }

    public func value(for key: String) -> CardioFieldState? {
        values[key]
    }

    public func collectMetrics() -> CardioEntryFormValidationResult {
        var output: CardioMetrics = [:]
        for spec in specs {
            switch CardioMetricsSchemaHelpers.parseField(spec: spec, raw: values[spec.key]) {
            case let .value(value):
                output[spec.key] = value
            case .empty:
                if spec.required {
                    return .failure(key: spec.key, message: "\(spec.label) is required.")
                }
            case .invalid:
                return .failure(key: spec.key, message: "\(spec.label) is invalid.")
            }
        }

        if specs.isEmpty == false, output.isEmpty {
            return .failure(key: specs[0].key, message: "Enter at least one value.")
        }

        if let error = CardioMetricsSchemaHelpers.validate(metrics: output, against: schema).first {
            return .failure(key: error.metricKey, message: error.userMessage(specs: specs))
        }

        return .success(output)
    }
}

public extension CardioMetricsValidationError {
    var metricKey: String {
        switch self {
        case let .missingRequired(key),
             let .unknownMetric(key),
             let .expectedInteger(key),
             let .belowMinimum(key, _),
             let .aboveMaximum(key, _),
             let .atOrAboveExclusiveMaximum(key, _):
            key
        }
    }

    func userMessage(specs: [CardioMetricSpec]) -> String {
        let label = specs.first { $0.key == metricKey }?.label ?? metricKey
        switch self {
        case .missingRequired:
            return "\(label) is required."
        case .unknownMetric:
            return "\(label) is not part of this exercise's metrics."
        case .expectedInteger:
            return "\(label) must be a whole number."
        case let .belowMinimum(_, minimum):
            return "\(label) must be at least \(formatLimit(minimum))."
        case let .aboveMaximum(_, maximum):
            return "\(label) must be at most \(formatLimit(maximum))."
        case let .atOrAboveExclusiveMaximum(_, maximum):
            return "\(label) must be less than \(formatLimit(maximum))."
        }
    }

    private func formatLimit(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(value)
    }
}
