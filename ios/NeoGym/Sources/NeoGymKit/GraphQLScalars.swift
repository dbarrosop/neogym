import Foundation
import Nhost

public typealias JSONValue = Nhost.JSONValue

public enum GraphQLScalars {
    public static func uuid(_ value: UUID) -> JSONValue {
        .string(value.uuidString.lowercased())
    }

    public static func uuid(_ value: String) -> JSONValue {
        .string(value)
    }

    public static func date(_ value: Date, calendar: Calendar? = nil) -> JSONValue {
        .string(dateFormatter(calendar: calendar ?? utcCalendar).string(from: value))
    }

    public static func date(_ value: String) -> JSONValue {
        .string(value)
    }

    public static func time(_ value: Date, calendar: Calendar? = nil) -> JSONValue {
        .string(timeFormatter(calendar: calendar ?? utcCalendar).string(from: value))
    }

    public static func time(_ value: String) -> JSONValue {
        .string(value)
    }

    public static func timestamptz(_ value: Date) -> JSONValue {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return .string(formatter.string(from: value))
    }

    public static func timestamptz(_ value: String) -> JSONValue {
        .string(value)
    }

    public static func numeric(_ value: Decimal) -> JSONValue {
        .string(NSDecimalNumber(decimal: value).stringValue)
    }

    public static func numeric(_ value: Double) -> JSONValue {
        .number(value)
    }

    public static func jsonb(_ value: JSONValue) -> JSONValue {
        value
    }

    public static func variables(_ pairs: (String, JSONValue?)...) -> [String: JSONValue] {
        Dictionary(uniqueKeysWithValues: pairs.compactMap { key, value in
            guard let value else { return nil }
            return (key, value)
        })
    }

    private static var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US_POSIX")
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? TimeZone.current
        return calendar
    }

    private static func dateFormatter(calendar: Calendar) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private static func timeFormatter(calendar: Calendar) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "HH:mm:ss"
        return formatter
    }
}

public extension JSONValue {
    var objectValue: [String: JSONValue]? {
        guard case let .object(value) = self else { return nil }
        return value
    }

    var arrayValue: [JSONValue]? {
        guard case let .array(value) = self else { return nil }
        return value
    }

    var boolValue: Bool? {
        guard case let .bool(value) = self else { return nil }
        return value
    }

    var numberValue: Double? {
        switch self {
        case let .integer(value): Double(value)
        case let .number(value): value
        default: nil
        }
    }
}
