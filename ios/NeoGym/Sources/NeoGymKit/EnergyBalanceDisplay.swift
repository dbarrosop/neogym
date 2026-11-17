import Foundation

/// The numbers behind every energy-balance surface outside the phone app: the
/// iPhone Home and Lock Screen widgets, the watch app and its complication.
public struct EnergyBalanceDisplayInput: Equatable, Sendable {
    public let localDate: String
    public let updatedAt: Date
    public let consumedKcal: Double
    /// Nil when the date has no energy row: balance and out are unknown, not zero.
    public let burnedKcal: Double?
    public let activeKcal: Double?
    public let restingKcal: Double?
    public let sevenDayAverageNet: Double?
    public let planKcal: Double?
    public let estimatedBurnedKcal: Double?
    public let estimatedNetKcal: Double?

    public init(
        localDate: String, updatedAt: Date, consumedKcal: Double, burnedKcal: Double?,
        activeKcal: Double? = nil, restingKcal: Double? = nil, sevenDayAverageNet: Double? = nil,
        planKcal: Double? = nil, estimatedBurnedKcal: Double? = nil, estimatedNetKcal: Double? = nil
    ) {
        self.localDate = localDate
        self.updatedAt = updatedAt
        self.consumedKcal = consumedKcal
        self.burnedKcal = burnedKcal
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
        self.sevenDayAverageNet = sevenDayAverageNet
        self.planKcal = planKcal
        self.estimatedBurnedKcal = estimatedBurnedKcal
        self.estimatedNetKcal = estimatedNetKcal
    }
}

/// Whole-kilocalorie text in the design's notation: locale grouping, a true minus
/// sign (U+2212) and no unit, so a heading or caption can carry "kcal".
public enum KcalText {
    public static let missing = "—"

    /// "1,461"
    public static func plain(_ value: Double, locale: Locale = .current) -> String {
        guard value.isFinite else { return missing }
        let rounded = value.rounded()
        let magnitude = format(abs(rounded), fractionDigits: 0, locale: locale)
        return rounded < 0 ? "−\(magnitude)" : magnitude
    }

    /// "+251", "−851" or "0".
    public static func signed(_ value: Double, locale: Locale = .current) -> String {
        guard value.isFinite else { return missing }
        let rounded = value.rounded()
        let magnitude = format(abs(rounded), fractionDigits: 0, locale: locale)
        if rounded > 0 { return "+\(magnitude)" }
        if rounded < 0 { return "−\(magnitude)" }
        return magnitude
    }

    /// "≈ −851" for a net estimate, "≈ 2,312" for burned.
    public static func approximate(_ value: Double, signed isSigned: Bool, locale: Locale = .current) -> String {
        "≈ " + (isSigned ? signed(value, locale: locale) : plain(value, locale: locale))
    }

    /// "951", "1.5k", "13k": for the watch's circular complication.
    public static func compact(_ value: Double, locale: Locale = .current) -> String {
        guard value.isFinite else { return missing }
        let rounded = value.rounded()
        let magnitude = abs(rounded)
        guard magnitude >= 1000 else { return plain(rounded, locale: locale) }
        let thousands = magnitude / 1000
        let text = format(thousands, fractionDigits: thousands < 10 ? 1 : 0, locale: locale)
        return (rounded < 0 ? "−" : "") + text + "k"
    }

    private static func format(_ value: Double, fractionDigits: Int, locale: Locale) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = fractionDigits
        formatter.roundingMode = .halfUp
        return formatter.string(from: NSNumber(value: value)) ?? String(Int(value))
    }
}

/// Energy out so far, split by metric. Both parts are non-negative and sum above zero.
public struct EnergyBalanceSplit: Equatable, Sendable {
    public let resting: Double
    public let active: Double

    public var total: Double { resting + active }
}

/// One formatter for every widget and watch surface, so they show the same words and
/// numbers as Today's Balance card. Estimates appear only on their own local date.
public struct EnergyBalanceDisplay: Equatable, Sendable {
    /// False once the entry date has moved past the snapshot's local date.
    public let isCurrentDay: Bool
    public let balanceKcal: Double?
    /// "+251", or "—" without an energy row.
    public let balance: String
    public let consumed: String
    public let compactConsumed: String
    /// "1,210", or "—" without an energy row.
    public let burned: String
    public let resting: String
    public let active: String
    public let split: EnergyBalanceSplit?
    public let endOfDayNet: String?
    public let endOfDayBurned: String?
    /// "−371", or "—" before any day has both intake and energy.
    public let sevenDayAverage: String
    public let planTarget: String?
    /// Food in against the plan, clamped to 0...1, when a plan is selected.
    public let planProgress: Double?
    /// When the numbers were read: "13:40".
    public let updatedTime: String
    /// "today", or the snapshot's weekday ("Sunday") after local midnight.
    public let dayLabel: String

    public init(_ input: EnergyBalanceDisplayInput, at date: Date, calendar: Calendar = .current,
                locale: Locale = .current) {
        isCurrentDay = input.localDate == DateOnly.formatLocalISO(date, calendar: calendar)
        balanceKcal = input.burnedKcal.map { input.consumedKcal - $0 }
        balance = balanceKcal.map { KcalText.signed($0, locale: locale) } ?? KcalText.missing
        consumed = KcalText.plain(input.consumedKcal, locale: locale)
        compactConsumed = KcalText.compact(input.consumedKcal, locale: locale)
        burned = input.burnedKcal.map { KcalText.plain($0, locale: locale) } ?? KcalText.missing
        resting = input.restingKcal.map { KcalText.plain($0, locale: locale) } ?? KcalText.missing
        active = input.activeKcal.map { KcalText.plain($0, locale: locale) } ?? KcalText.missing
        split = Self.split(input)
        endOfDayNet = isCurrentDay
            ? input.estimatedNetKcal.map { KcalText.approximate($0, signed: true, locale: locale) } : nil
        endOfDayBurned = isCurrentDay
            ? input.estimatedBurnedKcal.map { KcalText.approximate($0, signed: false, locale: locale) } : nil
        sevenDayAverage = input.sevenDayAverageNet.map { KcalText.signed($0, locale: locale) } ?? KcalText.missing
        if let plan = input.planKcal, plan.isFinite, plan > 0 {
            planTarget = KcalText.plain(plan, locale: locale)
            planProgress = min(max(input.consumedKcal / plan, 0), 1)
        } else {
            planTarget = nil
            planProgress = nil
        }
        updatedTime = Self.time(input.updatedAt, calendar: calendar, locale: locale)
        dayLabel = isCurrentDay ? "today" : Self.weekday(input.localDate, calendar: calendar, locale: locale)
    }

    public var hasEnergy: Bool { balanceKcal != nil }
    /// "+251 kcal", or "— kcal" without an energy row.
    public var balanceWithUnit: String { "\(balance) kcal" }
    /// "In 1,461 · Out 1,210"
    public var inOut: String { "In \(consumed) · Out \(burned)" }
    /// "today so far", or "Sunday so far" for a snapshot carried past midnight.
    public var periodCaption: String { "\(dayLabel) so far" }
    /// "Today so far · 13:40"
    public var periodHeader: String { "\(periodCaption.capitalizedFirst) · \(updatedTime)" }
    /// Lock Screen inline text: "+251 kcal so far", or intake when energy is missing.
    /// Both forms name the snapshot's weekday once carried past local midnight.
    public var inlineText: String {
        guard hasEnergy else {
            return isCurrentDay ? "In \(consumed) kcal" : "In \(consumed) kcal \(dayLabel)"
        }
        return isCurrentDay ? "\(balanceWithUnit) so far" : "\(balanceWithUnit) \(dayLabel)"
    }

    public var inlineAccessibility: String {
        guard hasEnergy else {
            return "In \(consumed) kilocalories \(periodCaption), no energy recorded"
        }
        return balanceAccessibility
    }

    /// Watch complication title; stale data names its time instead of claiming "so far".
    public func watchTitle(isStale: Bool) -> String {
        isStale ? "Balance at \(updatedTime)" : "Balance so far"
    }

    public var balanceAccessibility: String {
        guard let balanceKcal else { return "Balance unavailable, no energy recorded \(periodCaption)" }
        return "Balance \(periodCaption), \(KcalText.signed(balanceKcal)) kilocalories"
    }

    public var inOutAccessibility: String {
        let out = hasEnergy ? "out \(burned) kilocalories" : "out unavailable"
        return "In \(consumed) kilocalories, \(out)"
    }

    public var splitAccessibility: String? {
        guard split != nil else { return nil }
        return "Out so far: resting \(resting) and active \(active) kilocalories"
    }

    public var endOfDayAccessibility: String? {
        guard let endOfDayNet else { return nil }
        let burnedText = endOfDayBurned.map { ", burned \($0.dropApproximation) kilocalories" } ?? ""
        return "Estimated by end of day: net \(endOfDayNet.dropApproximation) kilocalories\(burnedText)"
    }

    public var planAccessibility: String {
        guard let planTarget else { return "Food in, \(consumed) kilocalories" }
        return "Food in, \(consumed) of \(planTarget) planned kilocalories"
    }

    private static func split(_ input: EnergyBalanceDisplayInput) -> EnergyBalanceSplit? {
        guard input.burnedKcal != nil else { return nil }
        let resting = max(input.restingKcal ?? 0, 0)
        let active = max(input.activeKcal ?? 0, 0)
        guard resting.isFinite, active.isFinite, resting + active > 0 else { return nil }
        return EnergyBalanceSplit(resting: resting, active: active)
    }

    private static func time(_ date: Date, calendar: Calendar, locale: Locale) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private static func weekday(_ localDate: String, calendar: Calendar, locale: Locale) -> String {
        guard let date = DateOnly.parse(localDate, calendar: calendar) else { return localDate }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.setLocalizedDateFormatFromTemplate("EEEE")
        return formatter.string(from: date)
    }
}

private extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
    var dropApproximation: String { hasPrefix("≈ ") ? String(dropFirst(2)) : self }
}
