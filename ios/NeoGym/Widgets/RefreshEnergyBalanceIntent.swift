import AppIntents
import WidgetKit

@available(iOSApplicationExtension 17.0, *)
struct RefreshEnergyBalanceIntent: AppIntent {
    static let title: LocalizedStringResource = "Refresh Energy Balance"
    static let description = IntentDescription(
        "Attempts to refresh the Energy Balance widget using the shared NeoGym session."
    )
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
        return .result()
    }
}
