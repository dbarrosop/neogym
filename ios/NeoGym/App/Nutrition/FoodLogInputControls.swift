import NeoGymKit
import SwiftUI

struct NutritionGramTextField: View {
    @Binding var grams: String
    var title = "Amount"

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: NeoGymTheme.spacingSM) {
            Text(title)
            Spacer(minLength: NeoGymTheme.spacingMD)
            TextField("0", text: $grams)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(minWidth: 72, maxWidth: 120)
            Text("g")
                .foregroundColor(NeoGymTheme.mutedText)
        }
    }
}

enum NutritionLogAmount {
    static func editableNumber(_ value: JSONValue?) -> String {
        let number = NutritionMath.normalizeNumeric(value)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 3
        formatter.usesGroupingSeparator = false
        return formatter.string(from: NSNumber(value: number)) ?? String(number)
    }
}

enum NutritionLogTime {
    static func inputValue(from date: Date) -> String {
        IntakeGrouping.currentTimeInputValue(date)
    }

    static func date(from value: String?) -> Date {
        let inputValue = IntakeGrouping.timeToInputValue(value)
        let parts = inputValue.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return Date() }
        let calendar = Calendar.current
        return calendar.date(
            bySettingHour: parts[0],
            minute: parts[1],
            second: 0,
            of: Date()
        ) ?? Date()
    }
}
