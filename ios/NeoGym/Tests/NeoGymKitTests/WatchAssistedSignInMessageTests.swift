import Foundation
import XCTest
@testable import NeoGymKit

final class WatchAssistedSignInMessageTests: XCTestCase {
    func testOnlyNonceBoundPATMessagesDecode() {
        let id = UUID()
        let credential = WatchPATCredential(userID: "user-1", token: UUID().uuidString,
                                            expiresAt: Date(timeIntervalSince1970: 1_800_000_000))
        for message: WatchAssistedSignInMessage in [.request(id), .credential(id, credential),
                                                     .result(id, succeeded: true)] {
            XCTAssertEqual(WatchAssistedSignInMessage.decode(message.context), message)
            var extra = message.context
            extra["refreshToken"] = "not-allowed"
            XCTAssertNil(WatchAssistedSignInMessage.decode(extra))
            var newer = message.context
            newer["version"] = "3"
            XCTAssertNil(WatchAssistedSignInMessage.decode(newer))
        }
        var malformed = WatchAssistedSignInMessage.credential(id, credential).context
        malformed["pat"] = "not-a-token"
        XCTAssertNil(WatchAssistedSignInMessage.decode(malformed))
        XCTAssertNil(WatchAssistedSignInMessage.decode(["version": "1", "kind": "code", "otp": "123456"]))
    }

    func testAttemptExpiresAndCannotChangeOwner() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let attempt = WatchAssistedSignInAttempt(id: UUID(), userID: "first", startedAt: now)
        XCTAssertTrue(attempt.accepts(id: attempt.id, userID: "first", now: now.addingTimeInterval(599)))
        XCTAssertFalse(attempt.accepts(id: attempt.id, userID: "first", now: now.addingTimeInterval(600)))
        XCTAssertFalse(attempt.accepts(id: attempt.id, userID: "second", now: now))
        XCTAssertFalse(attempt.accepts(id: UUID(), userID: "first", now: now))
    }
}
