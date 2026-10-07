import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

private actor RefreshProbeTransport: HTTPTransport {
    var requests = 0
    var status = 200
    func setStatus(_ status: Int) { self.status = status }
    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        requests += 1
        return NhostRawResponse(status: status, body: Data(#"{"refreshToken":"secret"}"#.utf8))
    }
}

private actor RefreshProbeEvents {
    var values: [WatchAuthRefreshObservation] = []
    func append(_ event: WatchAuthRefreshObservation) { values.append(event) }
}

final class WatchAuthRefreshTransportTests: XCTestCase {
    func testOnlyAuthRefreshIsObservedAndNoCredentialsAreRetained() async throws {
        let url = try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
        let probe = RefreshProbeTransport()
        let events = RefreshProbeEvents()
        let observer = WatchAuthRefreshObserver()
        await observer.setHandler { event in Task { await events.append(event) } }
        let transport = WatchAuthRefreshTransport(authBaseURL: url, observer: observer, underlying: probe)
        _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("token"),
            body: Data(#"{"refreshToken":"secret"}"#.utf8)))
        _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("signin/otp/email")))
        await probe.setStatus(401)
        _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("token")))
        // The callback launches a task, so wait until it has consumed all observations.
        for _ in 0..<100 where await events.values.count < 4 { await Task.yield() }
        let recorded = await events.values
        XCTAssertEqual(recorded.count, 4)
        XCTAssertEqual(recorded[0].outcome, .started)
        XCTAssertEqual(recorded[1].outcome, .responseReceived)
        XCTAssertEqual(recorded[2].outcome, .started)
        XCTAssertEqual(recorded[3].outcome, .rejected(401))
        XCTAssertEqual(recorded[0].id, recorded[1].id)
        XCTAssertNotEqual(recorded[0].id, recorded[2].id)
        XCTAssertFalse(String(describing: recorded).contains("secret"))
    }
}
