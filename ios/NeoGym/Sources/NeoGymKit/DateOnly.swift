import Foundation

public enum DateOnly {
    public static func todayLocalISO(calendar: Calendar = .current, now: Date = Date()) -> String {
        formatLocalISO(now, calendar: calendar)
    }

    public static func parse(_ iso: String, calendar: Calendar = .current) -> Date? {
        let parts = iso.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2]),
              year > 0,
              month > 0,
              day > 0
        else {
            return nil
        }

        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        components.year = year
        components.month = month
        components.day = day
        components.hour = 0
        components.minute = 0
        components.second = 0

        return calendar.date(from: components)
    }

    public static func formatLong(_ iso: String, locale: Locale = .current, calendar: Calendar = .current) -> String {
        guard let date = parse(iso, calendar: calendar) else { return iso }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.setLocalizedDateFormatFromTemplate("EEE d MMM yyyy")
        return formatter.string(from: date)
    }

    public static func formatShort(_ iso: String, locale: Locale = .current, calendar: Calendar = .current) -> String {
        guard let date = parse(iso, calendar: calendar) else { return iso }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter.string(from: date)
    }

    public static func formatLocalISO(_ date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 0
        let month = components.month ?? 0
        let day = components.day ?? 0
        return String(format: "%04d-%02d-%02d", year, month, day)
    }
}
