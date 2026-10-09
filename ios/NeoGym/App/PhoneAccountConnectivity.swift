import Combine
import NeoGymKit
import WatchConnectivity

/// Application context remains account hints only. The app-user PAT travels
/// over one live request and is never queued or placed in application context.
@MainActor
final class PhoneAccountConnectivity: NSObject, ObservableObject, PhoneHintTransport {
    private lazy var publisher = PhoneHintPublisher(transport: self)
    private let patService: any WatchPATServicing
    init(patService: any WatchPATServicing) {
        self.patService = patService
        super.init()
    }

    private lazy var assisted: PhoneAssistedSignInModel = {
        let model = PhoneAssistedSignInModel(pat: patService) { [weak self] message, attempt in
            self?.send(message, for: attempt)
        }
        assistedSubscription = model.objectWillChange.sink { [weak self] _ in
            self?.objectWillChange.send()
        }
        return model
    }()
    private var assistedSubscription: AnyCancellable?
    private var authSubscription: AnyCancellable?

    var pending: WatchAssistedSignInAttempt? { assisted.pending }
    var isSending: Bool { assisted.isSending }
    var connected: Bool { assisted.connected }
    var errorMessage: String? { assisted.errorMessage }

    func bind(to authStore: AuthStore) {
        authSubscription = authStore.$state.sink { [weak self] state in
            self?.observe(state)
        }
    }

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    private func observe(_ state: AuthState) {
        publisher.observe(state)
        assisted.observe(state)
    }

    func foreground() {
        expireAttempt()
        guard WCSession.isSupported() else { return }
        if WCSession.default.activationState != .activated { WCSession.default.activate() }
        else { publisher.resend() }
    }

    func send(context: [String: String]) throws {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
            throw ConnectivityError.notActivated
        }
        try WCSession.default.updateApplicationContext(context)
    }

    func connect() async { await assisted.connect() }
    func clearAttempt() { assisted.clearAttempt() }
    func clearPresentedSuccess() { assisted.clearPresentedSuccess() }
    func expireAttempt() { assisted.expireAttempt() }

    private func send(_ message: WatchAssistedSignInMessage, for attempt: WatchAssistedSignInAttempt) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated,
              WCSession.default.isReachable else {
            assisted.deliveryFailed(for: attempt)
            return
        }
        WCSession.default.sendMessage(message.context, replyHandler: nil) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.assisted.deliveryFailed(for: attempt)
            }
        }
    }

    private enum ConnectivityError: Error { case notActivated }
}

extension PhoneAccountConnectivity: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            if state == .activated { publisher.resend() }
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        Task { @MainActor in WCSession.default.activate() }
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        Task { @MainActor in publisher.resend() }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let strings = message.compactMapValues { $0 as? String }
        guard strings.count == message.count,
              let payload = WatchAssistedSignInMessage.decode(strings) else { return }
        let receivedAt = Date()
        Task { @MainActor [self] in
            assisted.receive(payload, receivedAt: receivedAt)
        }
    }
}
