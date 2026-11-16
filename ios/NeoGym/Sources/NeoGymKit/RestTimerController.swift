import Combine
import Foundation

/// Platform mirrors must invalidate pending asynchronous work when cancelled.
@MainActor
public protocol RestTimerEffects: AnyObject {
    func schedule(_ schedule: RestTimerSchedule)
    func cancel()
    /// Natural expiry ends the Live Activity but leaves the completion alert deliverable.
    func finish()
}

/// One owner's rest timer. Account invalidation permanently disables old view callbacks.
@MainActor
public final class RestTimerController: ObservableObject {
    @Published public private(set) var schedule: RestTimerSchedule?
    @Published public private(set) var remainingSeconds = 0
    @Published public private(set) var sessionNames: [String: String] = [:]
    public let ownerId: String?

    static let persistedKey = "neogym.rest.running"
    private let defaults: UserDefaults
    private let effects: any RestTimerEffects
    private let now: () -> Date
    private var tickerTask: Task<Void, Never>?
    private var isValid = true

    public init(ownerId: String?, defaults: UserDefaults = .standard, effects: any RestTimerEffects, now: @escaping () -> Date = AppClock.now) {
        self.ownerId = ownerId
        self.defaults = defaults
        self.effects = effects
        self.now = now
        restore()
    }

    deinit { tickerTask?.cancel() }

    public var isRunning: Bool { schedule != nil }
    public var formattedRemaining: String { RestTimerPreference.countdown(remainingSeconds) }
    public var defaultSeconds: Int {
        RestTimerPreference.sanitized(defaults.object(forKey: RestTimerPreference.storageKey) as? Int)
    }

    public func noteSession(id: String, name: String) {
        guard isValid else { return }
        if sessionNames[id] != name { sessionNames[id] = name }
    }

    public func start(
        seconds: Int? = nil, label: String? = nil, sessionId: String? = nil,
        context: RestTimerSetContext? = nil
    ) {
        guard isValid, let ownerId, !ownerId.isEmpty else { return }
        effects.cancel()
        apply(.start(
            seconds: seconds ?? defaultSeconds, now: now(), label: label, sessionId: sessionId, context: context
        ))
    }

    public func extend(by seconds: Int = RestTimerPreference.extensionSeconds) {
        guard isValid, let schedule else { return }
        apply(schedule.extended(by: seconds))
    }

    public func cancel() {
        guard isValid else { return }
        clearSchedule()
        effects.cancel()
    }

    public func refresh() {
        guard isValid, let schedule else { return }
        remainingSeconds = schedule.remainingSeconds(at: now())
        if schedule.isFinished(at: now()) {
            clearSchedule()
            effects.finish()
        }
    }

    private func clearSchedule() {
        tickerTask?.cancel()
        tickerTask = nil
        schedule = nil
        remainingSeconds = 0
        defaults.removeObject(forKey: Self.persistedKey)
    }

    /// Retire a runtime permanently so callbacks from its old views cannot restart a rest.
    public func invalidate() {
        cancel()
        sessionNames = [:]
        isValid = false
    }

    private func apply(_ next: RestTimerSchedule) {
        guard let ownerId, !ownerId.isEmpty else { return }
        schedule = next
        remainingSeconds = next.remainingSeconds(at: now())
        Self.persist(next, ownerId: ownerId, defaults: defaults)
        effects.schedule(next)
        tickerTask?.cancel()
        tickerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled, let self else { return }
                self.refresh()
                if !self.isRunning { return }
            }
        }
    }

    private func restore() {
        guard let ownerId, !ownerId.isEmpty,
              let (storedOwner, schedule) = Self.persisted(defaults: defaults, now: now()),
              storedOwner == ownerId
        else {
            cancel()
            return
        }
        apply(schedule)
    }
}

/// The persisted rest, shared by restoration and by Live Activity buttons that the
/// system runs while no account runtime is mounted (a background app launch).
extension RestTimerController {
    static func persist(_ schedule: RestTimerSchedule, ownerId: String, defaults: UserDefaults) {
        var stored: [String: Any] = [
            "ownerId": ownerId,
            "endDate": schedule.endDate.timeIntervalSince1970,
            "duration": schedule.duration
        ]
        stored["label"] = schedule.label
        stored["sessionId"] = schedule.sessionId
        if let context = schedule.context {
            stored["contextExercise"] = context.exerciseName
            stored["contextSet"] = context.nextSetNumber
            stored["contextTarget"] = context.target
        }
        defaults.set(stored, forKey: persistedKey)
    }

    /// A running, well-formed persisted rest and its owner; nil once it has ended.
    static func persisted(defaults: UserDefaults, now: Date) -> (ownerId: String, schedule: RestTimerSchedule)? {
        guard let stored = defaults.dictionary(forKey: persistedKey),
              let ownerId = stored["ownerId"] as? String, !ownerId.isEmpty,
              let end = stored["endDate"] as? TimeInterval, end.isFinite,
              let duration = stored["duration"] as? Int, duration > 0,
              end > now.timeIntervalSince1970
        else { return nil }
        var context: RestTimerSetContext?
        if let exercise = stored["contextExercise"] as? String, let set = stored["contextSet"] as? Int {
            context = RestTimerSetContext(exerciseName: exercise, nextSetNumber: set,
                                          target: stored["contextTarget"] as? String)
        }
        let schedule = RestTimerSchedule(
            endDate: Date(timeIntervalSince1970: end), duration: duration,
            label: stored["label"] as? String, sessionId: stored["sessionId"] as? String, context: context
        )
        return (ownerId, schedule)
    }

    /// +30 s from the Live Activity while no controller is mounted. Keeps the stored
    /// owner, so only that account's runtime restores it. Nil when nothing is running.
    public static func extendPersisted(
        by seconds: Int = RestTimerPreference.extensionSeconds,
        defaults: UserDefaults = .standard,
        now: Date = Date()
    ) -> RestTimerSchedule? {
        guard let (ownerId, schedule) = persisted(defaults: defaults, now: now) else {
            defaults.removeObject(forKey: persistedKey)
            return nil
        }
        let next = schedule.extended(by: seconds)
        persist(next, ownerId: ownerId, defaults: defaults)
        return next
    }

    /// Skip from the Live Activity while no controller is mounted.
    public static func cancelPersisted(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: persistedKey)
    }
}

/// Auth-owned lifetime, independent of whether a SwiftUI shell is currently mounted.
@MainActor
public final class RestTimerAccountScope: ObservableObject {
    @Published public private(set) var timer: RestTimerController?
    private let defaults: UserDefaults
    private let effects: any RestTimerEffects
    private let now: () -> Date
    private var subscription: AnyCancellable?

    public init(defaults: UserDefaults = .standard, effects: any RestTimerEffects, now: @escaping () -> Date = AppClock.now) {
        self.defaults = defaults
        self.effects = effects
        self.now = now
    }

    /// Also call `endSession` from AuthStore's clear handler, before remote sign-out.
    public func bind(to authStore: AuthStore) {
        subscription = authStore.$state.sink { [weak self] state in
            guard let self else { return }
            switch state {
            case let .signedIn(session):
                let ownerId = session.user?.id
                if let timer, let ownerId, !ownerId.isEmpty, timer.ownerId == ownerId { return }
                if timer != nil { endSession() }
                // A user-less SDK session can still show the shell, but cannot run/restore a rest.
                timer = RestTimerController(ownerId: ownerId, defaults: defaults, effects: effects, now: now)
            case .signedOut, .error:
                endSession()
            case .loading:
                break // Do not discard a same-owner rest during session restoration.
            }
        }
    }

    public func endSession() {
        if let timer {
            timer.invalidate()
        } else {
            // A cold signed-out/error bootstrap may still have OS effects and stored data.
            defaults.removeObject(forKey: RestTimerController.persistedKey)
            effects.cancel()
        }
        timer = nil
    }
}
