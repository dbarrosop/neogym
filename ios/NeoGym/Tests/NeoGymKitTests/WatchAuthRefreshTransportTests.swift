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

private actor FailingRefreshProbeTransport: HTTPTransport {
    enum Failure { case cancelled, urlCancelled, timedOut }
    let failure: Failure

    init(_ failure: Failure) { self.failure = failure }

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        switch failure {
        case .cancelled: throw CancellationError()
        case .urlCancelled: throw URLError(.cancelled)
        case .timedOut: throw URLError(.timedOut)
        }
    }
}

private func captureRefreshEvents(_ observer: WatchAuthRefreshObserver) async -> AsyncStream<WatchAuthRefreshObservation> {
    let (stream, continuation) = AsyncStream<WatchAuthRefreshObservation>.makeStream()
    await observer.setHandler { event in _ = continuation.yield(event) }
    return stream
}

private func takeEvents(_ count: Int, from stream: AsyncStream<WatchAuthRefreshObservation>) async
    -> [WatchAuthRefreshObservation] {
    await withTaskGroup(of: [WatchAuthRefreshObservation].self) { group in
        group.addTask {
            var iterator = stream.makeAsyncIterator()
            var events: [WatchAuthRefreshObservation] = []
            for _ in 0..<count {
                guard let event = await iterator.next() else { break }
                events.append(event)
            }
            return events
        }
        group.addTask {
            try? await Task.sleep(for: .seconds(2))
            return []
        }
        let received = await group.next() ?? []
        group.cancelAll()
        return received
    }
}

final class WatchAuthRefreshTransportTests: XCTestCase {
    func testOnlyAuthRefreshIsObservedAndNoCredentialsAreRetained() async throws {
        let url = try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
        let probe = RefreshProbeTransport()
        let observer = WatchAuthRefreshObserver()
        let stream = await captureRefreshEvents(observer)
        let transport = WatchAuthRefreshTransport(authBaseURL: url, observer: observer, underlying: probe)
        _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("token"),
            body: Data(#"{"refreshToken":"secret"}"#.utf8)))
        _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("signin/otp/email")))
        await probe.setStatus(401)
        _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("token")))
        let recorded = await takeEvents(4, from: stream)
        XCTAssertEqual(recorded.count, 4)
        XCTAssertEqual(recorded[0].outcome, .started)
        XCTAssertEqual(recorded[1].outcome, .responseReceived)
        XCTAssertEqual(recorded[2].outcome, .started)
        XCTAssertEqual(recorded[3].outcome, .rejected(401))
        XCTAssertEqual(recorded[0].id, recorded[1].id)
        XCTAssertNotEqual(recorded[0].id, recorded[2].id)
        XCTAssertFalse(String(describing: recorded).contains("secret"))
    }

    func testCancellationIsObservedWithoutChangingThrownError() async throws {
        for failure in [FailingRefreshProbeTransport.Failure.cancelled, .urlCancelled] {
            let url = try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
            let observer = WatchAuthRefreshObserver()
            let stream = await captureRefreshEvents(observer)
            let transport = WatchAuthRefreshTransport(authBaseURL: url, observer: observer,
                                                       underlying: FailingRefreshProbeTransport(failure))
            do {
                _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("token")))
                XCTFail("Expected the original cancellation error")
            } catch is CancellationError {
                XCTAssertEqual(failure, .cancelled)
            } catch let error as URLError {
                XCTAssertEqual(failure, .urlCancelled)
                XCTAssertEqual(error.code, .cancelled)
            }
            let recorded = await takeEvents(2, from: stream)
            XCTAssertEqual(recorded.count, 2)
            XCTAssertEqual(recorded.map(\.outcome), [.started, .cancelled])
            XCTAssertEqual(recorded.first?.id, recorded.last?.id)
            if let started = recorded.first(where: { $0.outcome == .started }),
               let cancelled = recorded.first(where: { $0.outcome == .cancelled }) {
                XCTAssertGreaterThanOrEqual(cancelled.occurredAt, started.occurredAt)
                XCTAssertNotNil(cancelled.wallSeconds)
            }
        }
    }

    func testTimeoutRemainsATransportFailure() async throws {
        let url = try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
        let observer = WatchAuthRefreshObserver()
        let stream = await captureRefreshEvents(observer)
        let transport = WatchAuthRefreshTransport(authBaseURL: url, observer: observer,
                                                   underlying: FailingRefreshProbeTransport(.timedOut))
        do {
            _ = try await transport.fetch(NhostRequest(method: "POST", url: url.appendingPathComponent("token")))
            XCTFail("Expected timeout to propagate")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .timedOut)
        }
        let recorded = await takeEvents(2, from: stream)
        XCTAssertEqual(recorded.map(\.outcome), [.started, .failed(.init(kind: .urlSession, code: -1001))])
    }
}
