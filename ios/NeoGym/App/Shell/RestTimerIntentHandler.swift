import NeoGymKit

/// Routes the Live Activity's +30 s and Skip intents to the signed-in account's rest
/// timer, so the session's own timer, notification and Live Activity stay in step.
/// When the system launches the app in the background just to run an intent, no
/// live runtime (or a still-restoring one) has a controller: the persisted rest is
/// updated in place for its stored owner and mirrored to ActivityKit directly.
@MainActor
enum LiveRestTimerIntents {
    private static weak var scope: RestTimerAccountScope?
    private static weak var effects: RestTimerSystemEffects?

    static func install() {
        RestTimerIntentRouter.handler = { action in await handle(action) }
    }

    static func attach(scope: RestTimerAccountScope, effects: RestTimerSystemEffects) {
        self.scope = scope
        self.effects = effects
    }

    /// Demo never shows Live Activities; a retired live runtime must not take actions.
    static func detach(scope: RestTimerAccountScope) {
        guard self.scope === scope else { return }
        self.scope = nil
        effects = nil
    }

    static func handle(_ action: RestTimerIntentAction) async {
        if let timer = scope?.timer, let effects {
            switch action {
            case .extend: timer.extend()
            case .skip: timer.cancel()
            }
            await effects.waitForPendingWork()
            return
        }
        let mirror = effects ?? RestTimerSystemEffects()
        switch action {
        case .extend:
            if let next = RestTimerController.extendPersisted() {
                mirror.schedule(next)
            } else {
                mirror.cancel()
            }
        case .skip:
            RestTimerController.cancelPersisted()
            mirror.cancel()
        }
        await mirror.waitForPendingWork()
    }
}
