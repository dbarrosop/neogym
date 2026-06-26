import Foundation

public extension CardioMetricsSchemaHelpers {
    static func validate(
        metrics: CardioMetrics,
        against schema: CardioMetricsSchema
    ) -> [CardioMetricsValidationError] {
        let specs = iterateMetrics(schema)
        let specByKey = Dictionary(uniqueKeysWithValues: specs.map { ($0.key, $0) })
        var errors = metrics.keys
            .filter { specByKey[$0] == nil }
            .map(CardioMetricsValidationError.unknownMetric)

        for spec in specs {
            guard let value = metrics[spec.key] else {
                if spec.required {
                    errors.append(.missingRequired(spec.key))
                }
                continue
            }
            errors.append(contentsOf: validationErrors(for: value, spec: spec))
        }

        return errors
    }

    private static func validationErrors(for value: Double, spec: CardioMetricSpec) -> [CardioMetricsValidationError] {
        var errors: [CardioMetricsValidationError] = []
        if isIntegerLike(spec), value.rounded() != value {
            errors.append(.expectedInteger(spec.key))
        }
        if let minimum = spec.minimum, value < minimum {
            errors.append(.belowMinimum(spec.key, minimum))
        }
        if let maximum = spec.maximum, value > maximum {
            errors.append(.aboveMaximum(spec.key, maximum))
        }
        if let exclusiveMaximum = spec.exclusiveMaximum, value >= exclusiveMaximum {
            errors.append(.atOrAboveExclusiveMaximum(spec.key, exclusiveMaximum))
        }
        return errors
    }

    private static func isIntegerLike(_ spec: CardioMetricSpec) -> Bool {
        spec.format == .integer || spec.format == .durationSeconds || spec.format == .average
    }
}
