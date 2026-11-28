import Foundation

public struct ProgressPhotoSummary: Equatable, Sendable {
    public let count: Int
    public let latestDate: String?
}

/// A deliberate swipe in the full-screen viewer. Ignore short drags and
/// diagonals so an attempted photo step doesn't accidentally dismiss it.
public enum ProgressPhotoSwipe: Equatable, Sendable {
    case older, newer, dismiss

    public init?(horizontal: Double, vertical: Double) {
        let width = abs(horizontal)
        let height = abs(vertical)
        if height >= 55, height >= 1.4 * width {
            self = .dismiss
        } else if width >= 55, width >= 1.4 * height {
            self = horizontal < 0 ? .newer : .older
        } else {
            return nil
        }
    }
}

/// Presentation rules shared by the Body card, gallery, viewer, and comparison.
/// Input photo rows use the server's descending (takenOn, createdAt, id) order.
public enum ProgressPhotoHistory {
    public static let angleLimit = 500

    public static func sortedAngles(_ angles: [ProgressPhotoAngle]) -> [ProgressPhotoAngle] {
        angles.sorted { (rank($0.value), $0.value) < (rank($1.value), $1.value) }
    }

    private static func rank(_ label: String) -> Int {
        ["front", "side", "back"].firstIndex { label == $0 || label.hasPrefix($0 + "_") } ?? 3
    }

    public struct Day: Identifiable, Sendable {
        public let date: String
        public let photos: [ProgressPhoto]
        public var id: String { date }
    }

    public struct Sheet: Sendable {
        public let columns: [ProgressPhotoAngle]
        public let days: [Day]
    }

    public static func sheet(_ photos: [ProgressPhoto], catalog: [ProgressPhotoAngle]) -> Sheet {
        let items = unique(photos)
        let used = Dictionary(items.map { ($0.label.value, $0.label) }, uniquingKeysWith: { first, _ in first })
        let known = sortedAngles(catalog).filter { used[$0.value] != nil }
        let knownValues = Set(known.map(\.value))
        let unknown = sortedAngles(used.values.filter { !knownValues.contains($0.value) })
        let byDate = Dictionary(grouping: items, by: \.takenOn)
        return Sheet(columns: known + unknown, days: byDate.keys.sorted(by: >).map {
            Day(date: $0, photos: byDate[$0] ?? [])
        })
    }

    public static func unique(_ photos: [ProgressPhoto]) -> [ProgressPhoto] {
        var seen = Set<String>()
        return photos.filter { $0.isReady && seen.insert($0.id).inserted }
    }

    public static func latestTiles(_ photos: [ProgressPhoto]) -> [ProgressPhoto] {
        Array(unique(photos).enumerated().sorted { lhs, rhs in
            let left = lhs.element.label.value, right = rhs.element.label.value
            return (rank(left), left, lhs.offset) < (rank(right), right, rhs.offset)
        }.prefix(4).map(\.element))
    }

    public static func comparableAngle(_ photos: [ProgressPhoto]) -> String? {
        let items = unique(photos)
        let grouped = Dictionary(grouping: items, by: { $0.label.value })
        return items.first { (grouped[$0.label.value]?.count ?? 0) > 1 }?.label.value
    }

    public struct Neighbors: Equatable, Sendable {
        public let older: ProgressPhoto?
        public let newer: ProgressPhoto?
        public let position: Int
        public let total: Int
    }

    public static func neighbors(_ photos: [ProgressPhoto], id: String) -> Neighbors? {
        guard let index = photos.firstIndex(where: { $0.id == id }) else { return nil }
        return .init(older: index + 1 < photos.count ? photos[index + 1] : nil,
                     newer: index > 0 ? photos[index - 1] : nil, position: photos.count - index, total: photos.count)
    }

    public struct Pair: Equatable, Sendable {
        public let before: ProgressPhoto
        public let after: ProgressPhoto
        public var days: Int {
            guard let start = DateOnly.parse(before.takenOn, calendar: ProgressPhotoDate.pickerCalendar),
                  let end = DateOnly.parse(after.takenOn, calendar: ProgressPhotoDate.pickerCalendar) else { return 0 }
            return ProgressPhotoDate.pickerCalendar.dateComponents([.day], from: start, to: end).day ?? 0
        }
    }

    public static func comparison(_ photos: [ProgressPhoto], from: String?, to: String?) -> Pair? {
        guard photos.count >= 2 else { return nil }
        let newest = photos.firstIndex { $0.id == to } ?? 0
        let opposite = newest == photos.count - 1 ? 0 : photos.count - 1
        let requested = photos.firstIndex { $0.id == from && $0.id != photos[newest].id }
        let oldest = requested ?? opposite
        return .init(before: photos[max(oldest, newest)], after: photos[min(oldest, newest)])
    }

    public static func measurementDates(for date: String, lookback: Int = 0) -> [String] {
        let calendar = ProgressPhotoDate.pickerCalendar
        guard let parsed = DateOnly.parse(date, calendar: calendar) else { return [] }
        return (0...max(0, min(lookback, 7))).compactMap { days in
            guard let day = calendar.date(byAdding: .day, value: -days, to: parsed),
                  calendar.component(.era, from: day) == 1 else { return nil }
            return DateOnly.formatLocalISO(day, calendar: calendar)
        }
    }

    public static func measurement(_ rows: [BodyMeasurement], for date: String, lookback: Int = 0) -> BodyMeasurement? {
        let dates = Set(measurementDates(for: date, lookback: lookback))
        return rows.filter { dates.contains($0.measuredOn) && ($0.weightKg != nil || $0.bodyFatPct != nil) }
            .max { $0.measuredOn < $1.measuredOn }
    }

    public struct Change: Equatable, Sendable {
        public let weightKg: Double?
        public let bodyFatPct: Double?
    }

    public static func change(from before: BodyMeasurement?, to after: BodyMeasurement?) -> Change? {
        guard let before, let after, before.measuredOn != after.measuredOn else { return nil }
        func diff(_ old: Double?, _ new: Double?) -> Double? {
            guard let old, let new else { return nil }
            return new - old
        }
        return Change(weightKg: diff(before.weightKg, after.weightKg), bodyFatPct: diff(before.bodyFatPct, after.bodyFatPct))
    }
}
