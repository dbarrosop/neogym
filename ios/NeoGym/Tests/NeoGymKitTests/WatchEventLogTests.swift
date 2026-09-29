import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

final class WatchEventLogTests: XCTestCase {
    func testRecentEventsPersistNewestFirstAndStayBounded() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite, maximumCount: 3)
        for index in 0..<5 {
            _ = store.record(WatchEvent(
                action: .backgroundScheduling,
                outcome: index == 4 ? .failed : .accepted,
                errorCode: index == 4 ? 42 : nil,
                occurredAt: Date(timeIntervalSince1970: Double(index))
            ))
        }
        let events = WatchEventStore(suite: suite, maximumCount: 3).load()
        XCTAssertEqual(events.map(\.occurredAt), [4, 3, 2].map { Date(timeIntervalSince1970: Double($0)) })
        XCTAssertEqual(events.first?.outcome, .failed)
        XCTAssertEqual(events.first?.errorCode, 42)
        store.clear()
        XCTAssertTrue(WatchEventStore(suite: suite).load().isEmpty)
    }

    func testDetailedHealthKitFailureExportsAsAFileWithoutRawErrorText() throws {
        let raw = NSError(domain: "HKErrorDomain", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "token=secret user@example.test URL=https://private.example.test"
        ])
        let failure = WatchHealthSyncFailure(stage: .activeHealthQuery, cause: raw)
        XCTAssertEqual(failure.underlyingCode, 3)
        XCTAssertEqual(failure.underlyingDomain, "HKErrorDomain")
        let event = WatchEvent(action: .healthSync, outcome: .failed,
                               trigger: .healthObserver, errorCode: failure.underlyingCode,
                               errorSource: .healthKit, stage: failure.stage,
                               occurredAt: Date(timeIntervalSince1970: 0))
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        store.record(event)
        let restored = try XCTUnwrap(store.load().first)
        XCTAssertEqual(restored.failureDetails,
                       "Active energy HealthKit query · HealthKit · code 3 · Invalid HealthKit argument")
        let backendCodeThree = WatchEvent(action: .healthSync, outcome: .failed,
                                          errorCode: 3, errorSource: .backend, stage: .backendRead)
        XCTAssertEqual(backendCodeThree.failureDetails, "Backend read · Backend · code 3")

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory); store.clear() }
        let url = try WatchEventExport.write(events: store.load(), to: directory,
                                             generatedAt: Date(timeIntervalSince1970: 0))
        let contents = try String(contentsOf: url, encoding: .utf8)
        XCTAssertEqual(url.pathExtension, "txt")
        XCTAssertTrue(contents.contains("Active energy HealthKit query · HealthKit · code 3"))
        XCTAssertTrue(contents.contains("Health event"))
        XCTAssertFalse(contents.contains("secret"))
        XCTAssertFalse(contents.contains("user@example.test"))
        XCTAssertFalse(contents.contains("https://private.example.test"))
    }

    func testHealthObserverAndDeliveryFailuresExportOnlyTypedDetails() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        defer { store.clear() }
        let observer = WatchEvent(action: .healthObservation, outcome: .failed,
                                  trigger: .healthObserver, errorCode: 3,
                                  errorSource: .healthKit, stage: .observerQuery)
        let delivery = WatchEvent(action: .healthBackgroundDelivery, outcome: .failed,
                                  trigger: .healthObserver, errorSource: .other,
                                  stage: .backgroundDelivery)
        store.record(observer)
        store.record(delivery)
        let restored = store.load()
        XCTAssertEqual(restored, [delivery, observer])
        let exported = WatchEventExport.text(events: restored)
        XCTAssertTrue(exported.contains(
            "Health observer | Failed · Health event · HealthKit observer query · HealthKit · code 3"
        ))
        XCTAssertTrue(exported.contains(
            "Health background delivery | Failed · Health event · HealthKit background delivery registration · Other"
        ))
    }

    func testOldNumericOnlyEventsStillDecode() throws {
        let legacy = Data(#"{"id":"00000000-0000-0000-0000-000000000001","occurredAt":0,"action":"healthSync","outcome":"failed","trigger":"healthObserver","errorCode":3}"#.utf8)
        let event = try JSONDecoder().decode(WatchEvent.self, from: legacy)
        XCTAssertNil(event.errorSource)
        XCTAssertNil(event.transportKind)
        XCTAssertNil(event.stage)
        XCTAssertNil(event.attemptID)
        XCTAssertNil(event.metric)
        XCTAssertNil(event.durationSeconds)
        XCTAssertNil(event.pendingWallSeconds)
        XCTAssertNil(event.wallSeconds)
        XCTAssertEqual(event.failureDetails, "code 3")
        XCTAssertEqual(event.diagnosticDetails, "code 3")
    }

    func testCorrelatedObserverTimeoutAndTypedTransportStayPrivateInExport() throws {
        let id = try XCTUnwrap(UUID(uuidString: "00000000-0000-0000-0000-0000000000AB"))
        let transport = GraphQLDomainError.map(FetchError.transport(
            "URLError -1009: https://private.example.test?token=secret"
        ))
        let failure = WatchHealthSyncFailure(stage: .backendRead, cause: transport,
                                              backendOperation: .healthReconciliationRead)
        XCTAssertEqual(failure.diagnosticSource, .transport)
        XCTAssertEqual(failure.transportDiagnostic, .init(kind: .urlSession, code: -1009))
        XCTAssertEqual(failure.backendOperation, .healthReconciliationRead)
        XCTAssertEqual(WatchEventErrorSource.graphQL(.decoding("private")), .backend)

        let received = WatchEvent(action: .healthObservation, outcome: .started,
                                  trigger: .healthObserver, attemptID: id, metric: .activeEnergy,
                                  runtimeState: .background)
        let readFailure = WatchEvent(action: .healthSync, outcome: .failed,
                                     trigger: .healthObserver, errorCode: failure.transportDiagnostic?.code,
                                     errorSource: failure.diagnosticSource,
                                     transportKind: failure.transportDiagnostic?.kind, stage: failure.stage,
                                     attemptID: id, backendOperation: failure.backendOperation,
                                     durationSeconds: 14)
        let acknowledged = WatchEvent(action: .healthObservation, outcome: .timedOut,
                                      trigger: .healthObserver, attemptID: id, metric: .activeEnergy,
                                      runtimeState: .background, durationSeconds: 25)
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        defer { store.clear() }
        store.record(received)
        store.record(readFailure)
        store.record(acknowledged)
        let events = store.load()
        XCTAssertEqual(events, [acknowledged, readFailure, received])
        let export = WatchEventExport.text(events: events)
        XCTAssertTrue(export.contains("attempt 00000000 · active energy · app background · 25s"))
        XCTAssertTrue(export.contains(
            "Health reconciliation read · Backend read · GraphQL transport · URLSession · code -1009"
        ))
        let skipped = WatchEvent(action: .energyRefresh, outcome: .skipped, attemptID: id,
                                 skipReason: .accountValidationFailed)
        XCTAssertEqual(skipped.diagnosticDetails, "attempt 00000000 · account validation failed")
        XCTAssertFalse(export.contains("private.example.test"))
        XCTAssertFalse(export.contains("secret"))
        XCTAssertTrue(export.contains("Legacy timeout events may have been acknowledged long after 25s"))
    }

    func testHTTPAndUnknownTransportExportsNeverIncludeRawResponses() {
        let response = NhostHTTPError(
            status: 503, headers: ["x-secret": "token"], body: nil,
            rawBody: Data("user@example.test https://private.example.test".utf8),
            messages: ["user@example.test https://private.example.test"]
        )
        let mapped = GraphQLDomainError.map(FetchError.http(response))
        XCTAssertEqual(mapped.transportDiagnostic, .init(kind: .http, code: 503))
        let event = WatchEvent(action: .energyRefresh, outcome: .failed,
                               errorCode: mapped.transportDiagnostic?.code,
                               errorSource: .graphQL(mapped),
                               transportKind: mapped.transportDiagnostic?.kind, stage: .backendRead)
        let unknown = GraphQLDomainError.map(FetchError.transport("token=private"))
        XCTAssertEqual(unknown.transportDiagnostic, .init(kind: .unknown))
        XCTAssertEqual(WatchTransportDiagnostic.classify(FetchError.transport(
            "URLError -1009 https://private.example.test"
        )), .init(kind: .unknown))
        XCTAssertEqual(WatchTransportDiagnostic.classify(URLError(.timedOut)),
                       .init(kind: .urlSession, code: -1001))
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        defer { store.clear() }
        store.record(event)
        XCTAssertEqual(store.load().first?.transportKind, .http)
        XCTAssertEqual(store.load().first?.errorCode, 503)
        let export = WatchEventExport.text(events: store.load())
        XCTAssertTrue(export.contains("Backend read · GraphQL transport · HTTP status · code 503"))
        XCTAssertFalse(export.contains("token"))
        XCTAssertFalse(export.contains("private.example.test"))
        XCTAssertFalse(export.contains("user@example.test"))
    }

    func testLifecycleAndAccountValidationEmitOnlyFixedStateAndCodes() {
        let changed = WatchEvent(action: .appLifecycle, outcome: .entered,
                                 runtimeState: .background)
        let validation = WatchEvent(action: .accountValidation, outcome: .failed,
                                    errorCode: -1009, errorSource: .transport,
                                    transportKind: .urlSession, stage: .profileRead,
                                    runtimeState: .background)
        let export = WatchEventExport.text(events: [changed, validation])
        XCTAssertTrue(export.contains("App state | Entered · app background"))
        XCTAssertTrue(export.contains("Auth profile read · GraphQL transport · URLSession · code -1009"))
    }

    func testPendingWallClockAgeIsExportedSeparatelyFromActiveDuration() {
        let event = WatchEvent(action: .energyRefresh, outcome: .started, trigger: .automatic,
                               durationSeconds: 2, pendingWallSeconds: 3_300)
        let export = WatchEventExport.text(events: [event])
        XCTAssertTrue(export.contains("2s · pending 3300s wall"))
        XCTAssertTrue(export.contains("including watch sleep"))
    }

    func testDelayedCallbackRetainsActualTimestampAndChronologicalExportOrder() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        defer { store.clear() }
        let acknowledgedAt = Date(timeIntervalSince1970: 1_000)
        let persistedLater = Date(timeIntervalSince1970: 1_050)
        store.record(WatchEvent(action: .healthObservation, outcome: .started,
                                occurredAt: persistedLater))
        store.record(WatchEvent(action: .healthObservation, outcome: .acknowledged,
                                occurredAt: acknowledgedAt))
        XCTAssertEqual(store.load().map(\.occurredAt), [persistedLater, acknowledgedAt])
        let export = WatchEventExport.text(events: store.load())
        let lines = export.split(separator: "\n").filter { $0.contains(" | Health observer | ") }
        XCTAssertEqual(lines.count, 2)
        if lines.count == 2 {
            XCTAssertTrue(lines[0].contains("| Started"))
            XCTAssertTrue(lines[1].contains("| HealthKit acknowledged"))
        }
    }

    func testStageStartCompletionAndExpiryExportOnlyTypedWallClockDetails() {
        let id = UUID()
        let started = WatchEvent(action: .refreshStage, outcome: .started,
                                 stage: .activeHealthQuery, attemptID: id)
        let completed = WatchEvent(action: .refreshStage, outcome: .succeeded,
                                   stage: .activeHealthQuery, attemptID: id, wallSeconds: 120)
        let expired = WatchEvent(action: .backgroundTask, outcome: .expired,
                                 attemptID: id, wallSeconds: 25)
        let export = WatchEventExport.text(events: [expired, completed, started])
        XCTAssertTrue(export.contains("Refresh stage | Started · attempt \(id.uuidString.prefix(8))"
                                       + " · Active energy HealthKit query"))
        XCTAssertTrue(export.contains("Active energy HealthKit query · elapsed 120s wall"))
        XCTAssertTrue(export.contains("Background wake | Expired by watchOS"
                                       + " · attempt \(id.uuidString.prefix(8)) · elapsed 25s wall"))
    }

    func testDefaultStoreKeepsMoreThanOneHundredEvents() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        defer { store.clear() }
        for _ in 0..<105 { store.record(WatchEvent(action: .healthObservation, outcome: .started)) }
        XCTAssertEqual(store.load().count, 105)
    }

    func testInvalidStorageIsIgnoredAndOnlyTypedEventsArePersisted() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)
        defaults?.set(Data("invalid".utf8), forKey: "watchEvents.v1")
        let store = WatchEventStore(suite: suite, maximumCount: 0)
        XCTAssertTrue(store.load().isEmpty)
        let event = WatchEvent(action: .energyRefresh, outcome: .succeeded, trigger: .background)
        XCTAssertEqual(store.record(event), [event])
        XCTAssertEqual(store.record(WatchEvent(action: .complicationReload, outcome: .requested)).count, 1)
        XCTAssertEqual(store.load().first?.action, .complicationReload)
        XCTAssertEqual(event.action.title, "Energy refresh")
        XCTAssertEqual(event.trigger?.title, "background")
        XCTAssertEqual(WatchEventOutcome.accepted.title, "Accepted by watchOS")
        store.clear()
    }
}
