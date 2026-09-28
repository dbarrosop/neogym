import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

@MainActor
private final class RecordingHintTransport: PhoneHintTransport {
    var contexts: [[String: String]] = []
    var fail = false
    func send(context: [String: String]) throws {
        if fail { throw URLError(.notConnectedToInternet) }
        contexts.append(context)
    }
}

@MainActor
final class PhoneHintPublisherTests: XCTestCase {
    func testTransientStatesAndRefreshChurnNeverReplaceDefinitiveHint() throws {
        let transport = RecordingHintTransport()
        let publisher = PhoneHintPublisher(transport: transport)
        publisher.observe(.loading)
        publisher.observe(.error("offline"))
        publisher.observe(.signedOut)
        publisher.observe(.loading)
        publisher.observe(.signedOut)
        XCTAssertEqual(transport.contexts, [PhoneAccountHint.signedOut.context])
        let payload = Data(#"{"exp":4102444800}"#.utf8).base64EncodedString()
            .replacingOccurrences(of: "=", with: "")
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
        let session = try StoredSession(
            accessToken: "e30.\(payload).signature", accessTokenExpiresIn: 3600,
            refreshTokenId: "test", refreshToken: "test",
            user: AuthUser(avatarUrl: "", createdAt: Date(), defaultRole: "user",
                           displayName: "Not delivered", emailVerified: true, id: "user-1",
                           isAnonymous: false, locale: "en", metadata: [:],
                           phoneNumberVerified: false, roles: ["user"])
        )
        publisher.observe(.signedIn(session))
        publisher.observe(.signedIn(session))
        XCTAssertEqual(transport.contexts.count, 2)
        XCTAssertEqual(transport.contexts[1], PhoneAccountHint.signedIn(userID: "user-1").context)
        XCTAssertEqual(Set(transport.contexts[1].keys), ["version", "state", "userId"])
    }

    func testActivationResendIsOpaqueAndFailuresRetryLatestState() {
        let transport = RecordingHintTransport()
        let publisher = PhoneHintPublisher(transport: transport)
        transport.fail = true
        publisher.observe(.signedOut)
        XCTAssertTrue(transport.contexts.isEmpty)
        transport.fail = false
        publisher.resend()
        publisher.resend()
        XCTAssertEqual(transport.contexts.count, 2)
        XCTAssertNotEqual(transport.contexts[0]["deliveryId"], transport.contexts[1]["deliveryId"])
        for context in transport.contexts {
            XCTAssertEqual(PhoneAccountHint.decode(context), .signedOut)
            XCTAssertEqual(Set(context.keys), ["version", "state", "deliveryId"])
        }
    }
}
