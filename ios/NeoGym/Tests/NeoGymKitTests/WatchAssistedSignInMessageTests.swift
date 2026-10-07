import Foundation
import XCTest
@testable import NeoGymKit

final class WatchAssistedSignInMessageTests: XCTestCase {
    func testMessagesAreStrictlyVersionedAndBoundToOneRequest() {
        let id = UUID()
        let messages: [WatchAssistedSignInMessage] = [
            .request(id),
            .challenge(id, email: "athlete@example.test", userID: "user-1"),
            .code(id, otp: "012345"),
            .result(id, succeeded: true)
        ]
        for message in messages {
            XCTAssertEqual(WatchAssistedSignInMessage.decode(message.context), message)
            var extra = message.context
            extra["refreshToken"] = "must-not-be-accepted"
            XCTAssertNil(WatchAssistedSignInMessage.decode(extra))
            var newer = message.context
            newer["version"] = "2"
            XCTAssertNil(WatchAssistedSignInMessage.decode(newer))
        }
        var malformed = WatchAssistedSignInMessage.code(id, otp: "012345").context
        malformed["otp"] = "abc123"
        XCTAssertNil(WatchAssistedSignInMessage.decode(malformed))
    }

    func testCodeNeedsLiveMatchingAttemptAndAcceptedChallenge() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let attempt = WatchAssistedSignInAttempt(id: UUID(), userID: "user-1", startedAt: now)
        func canVerify(_ id: UUID, attempt: WatchAssistedSignInAttempt? = nil,
                       currentUserID: String? = "user-1", challengeEmail: String? = nil,
                       at date: Date? = nil) -> Bool {
            WatchAssistedSignInAttempt.canVerifyCode(
                id: id, attempt: attempt, currentUserID: currentUserID,
                challengeEmail: challengeEmail, now: date ?? now
            )
        }
        XCTAssertFalse(canVerify(attempt.id, challengeEmail: "athlete@example.test")) // Relaunched watch.
        XCTAssertFalse(canVerify(attempt.id, attempt: attempt)) // Challenge was never delivered.
        XCTAssertFalse(canVerify(UUID(), attempt: attempt, challengeEmail: "athlete@example.test"))
        XCTAssertFalse(canVerify(attempt.id, attempt: attempt, currentUserID: "other",
                                 challengeEmail: "athlete@example.test"))
        XCTAssertFalse(canVerify(attempt.id, attempt: attempt, currentUserID: nil,
                                 challengeEmail: "athlete@example.test"))
        XCTAssertFalse(canVerify(attempt.id, attempt: attempt, challengeEmail: "athlete@example.test",
                                 at: now.addingTimeInterval(600)))
        XCTAssertTrue(canVerify(attempt.id, attempt: attempt, challengeEmail: "athlete@example.test",
                                at: now.addingTimeInterval(599)))
        let failure = WatchAssistedSignInMessage.result(attempt.id, succeeded: false)
        XCTAssertEqual(WatchAssistedSignInMessage.decode(failure.context), failure)
    }

    func testSuccessfulResultCannotBeOverwrittenByDelayedDuplicateFailure() {
        let attempt = WatchAssistedSignInAttempt(id: UUID(), userID: "user-1")
        var verificationSucceeded = false
        func apply(_ result: WatchAssistedSignInMessage) {
            guard case .result(let id, let succeeded) = result,
                  attempt.acceptsResult(id: id, verificationSucceeded: verificationSucceeded) else { return }
            verificationSucceeded = succeeded
        }

        apply(.result(UUID(), succeeded: true))
        XCTAssertFalse(verificationSucceeded)
        XCTAssertTrue(attempt.acceptsResult(id: attempt.id, verificationSucceeded: false))
        apply(.result(attempt.id, succeeded: true))
        XCTAssertTrue(verificationSucceeded)
        apply(.result(attempt.id, succeeded: false)) // Duplicate arrives after watch sign-in.
        XCTAssertTrue(verificationSucceeded)
        let nextAttempt = WatchAssistedSignInAttempt(id: UUID(), userID: "user-1")
        XCTAssertTrue(nextAttempt.acceptsResult(id: nextAttempt.id, verificationSucceeded: false))
    }

    func testAttemptRejectsWrongUserNonceAndExpiredDelivery() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let attempt = WatchAssistedSignInAttempt(id: UUID(), userID: "user-1", startedAt: now)
        XCTAssertTrue(attempt.accepts(id: attempt.id, userID: "user-1", now: now.addingTimeInterval(599)))
        XCTAssertFalse(attempt.accepts(id: UUID(), userID: "user-1", now: now))
        XCTAssertFalse(attempt.accepts(id: attempt.id, userID: "other", now: now))
        XCTAssertFalse(attempt.accepts(id: attempt.id, userID: "user-1", now: now.addingTimeInterval(600)))
        XCTAssertFalse(attempt.accepts(id: attempt.id, userID: "user-1", now: now.addingTimeInterval(-1)))
    }
}
