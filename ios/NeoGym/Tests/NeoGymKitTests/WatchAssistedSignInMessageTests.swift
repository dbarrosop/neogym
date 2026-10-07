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
