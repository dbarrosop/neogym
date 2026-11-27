import Foundation
import XCTest
@testable import NeoGymKit

@MainActor
final class ProgressPhotoAttemptTests: XCTestCase {
    func testLostReserveDoesNotReserveAgainOrUpload() async throws {
        let repository = PhotoAttemptFixture(reserveSucceeds: false)
        let attempt = upload(repository)
        try await expect(attempt, .unconfirmedReservation)
        try await expect(attempt, .unconfirmedReservation)
        let trace = await repository.trace
        XCTAssertEqual(trace, ["reserve"])
    }

    func testUnconfirmedUploadOnlyRetriesAfterReadAndWithSameID() async throws {
        let repository = PhotoAttemptFixture(uploads: [false, true], probes: [row(uploaded: nil), row(uploaded: nil)])
        let attempt = upload(repository)
        try await expect(attempt, .checkAgain)
        try await expect(attempt, .ready(photoFixtureId))
        try await expect(attempt, .ready(photoFixtureId))
        let trace = await repository.trace
        XCTAssertEqual(trace, ["reserve", "upload", "probe", "probe", "upload"])
    }

    func testCheckInRetainsOnlyFailedAttemptAndNeverResendsFinishedAngle() async throws {
        let repository = PhotoAttemptFixture(uploads: [false, true, true], probes: [row(uploaded: nil), row(uploaded: nil)])
        let front = ProgressPhotoAngle(value: "front_a", comment: nil)
        let back = ProgressPhotoAngle(value: "back_a", comment: nil)
        let date = "2024-02-29"
        let checkIn = ProgressPhotoCheckIn(repository: repository, date: date)
        let jpeg = Data([1, 2, 3])
        let catalog = [front, back]
        let oldDate = try XCTUnwrap(ProgressPhotoFields(label: front.value, date: "2024-02-28", catalog: catalog, today: date))
        do {
            _ = try await checkIn.upload(jpeg, fields: oldDate)
            XCTFail("A check-in must not switch dates")
        } catch ProgressPhotoError.unavailable {}

        let frontFields = try XCTUnwrap(ProgressPhotoFields(label: front.value, date: date, catalog: catalog, today: date))
        let backFields = try XCTUnwrap(ProgressPhotoFields(label: back.value, date: date, catalog: catalog, today: date))
        let first = try await checkIn.upload(jpeg, fields: frontFields)
        let second = try await checkIn.upload(jpeg, fields: backFields)
        let repeated = try await checkIn.upload(Data([9]), fields: backFields)
        let completed = try await checkIn.upload(Data([9]), fields: frontFields)
        XCTAssertEqual(first, .checkAgain)
        XCTAssertEqual(second, .ready(photoFixtureId))
        XCTAssertEqual(repeated, second)
        XCTAssertEqual(completed, .ready(photoFixtureId), "Retry must reuse the original prepared JPEG")
        let trace = await repository.trace
        let reserved = await repository.reserved
        XCTAssertEqual(trace, ["reserve", "upload", "probe", "reserve", "upload", "probe", "upload"])
        XCTAssertEqual(reserved, [frontFields, backFields])
    }

    func testPendingCanBecomeReadyButNeverResendsAfterObservingAFile() async throws {
        let ready = PhotoAttemptFixture(uploads: [false], probes: [row(uploaded: false), row(uploaded: true)])
        try await expect(upload(ready, delays: [1]), .ready(photoFixtureId))
        let vanished = PhotoAttemptFixture(uploads: [false], probes: [row(uploaded: false), row(uploaded: nil)])
        let attempt = upload(vanished)
        try await expect(attempt, .processing)
        try await expect(attempt, .unavailableReservation)
        let trace = await vanished.trace
        XCTAssertEqual(trace, ["reserve", "upload", "probe", "probe"])
    }

    func testMissingReservationIsTerminal() async throws {
        let fake = PhotoAttemptFixture(uploads: [false], probes: [nil])
        let attempt = upload(fake)
        try await expect(attempt, .unavailableReservation)
        try await expect(attempt, .unavailableReservation)
        let trace = await fake.trace
        XCTAssertEqual(trace, ["reserve", "upload", "probe"])
    }

    func testLateReservationDoesNotUploadAfterCancellation() async throws {
        let fake = PhotoAttemptFixture(holdReserve: true)
        let attempt = upload(fake)
        let task = Task { try await attempt.run() }
        await fake.waitForReserve()
        task.cancel()
        await fake.releaseReserve()
        do { _ = try await task.value; XCTFail("cancelled upload returned a result") } catch is CancellationError {}
        let trace = await fake.trace
        XCTAssertEqual(trace, ["reserve"])
    }

    func testRouteRetirementRejectsLateResponseEvenWhenServiceIgnoresCancellation() async throws {
        let fake = PhotoAttemptFixture(holdReserve: true)
        let scope = ProgressPhotoRouteScope()
        let attempt = upload(ScopedProgressPhotoRepository(fake, scope: scope))
        let task = Task { try await attempt.run() }
        await fake.waitForReserve()
        scope.retire()
        await fake.releaseReserve()
        do { _ = try await task.value; XCTFail("retired scope accepted reservation") } catch is CancellationError {}
        let trace = await fake.trace
        XCTAssertEqual(trace, ["reserve"])
    }

    func testUncertainDeleteRechecksAndDoesNotDeleteVanishedFileAgain() async throws {
        let fake = PhotoAttemptFixture(probes: [row(uploaded: true), nil])
        let attempt = ProgressPhotoDeleteAttempt(repository: fake, id: photoFixtureId)
        let visible = try await attempt.run()
        XCTAssertFalse(visible)
        let gone = try await attempt.run()
        XCTAssertTrue(gone)
        let trace = await fake.trace
        XCTAssertEqual(trace, ["delete", "probe", "probe"])
    }

    private func upload(_ fake: any ProgressPhotoRepositoryProtocol, delays: [UInt64] = []) -> ProgressPhotoUploadAttempt {
        let fields = ProgressPhotoFields(label: "profile", date: "2024-02-29", catalog: [row(uploaded: nil).label], today: "2024-03-01")!
        return ProgressPhotoUploadAttempt(repository: fake, fields: fields, jpeg: Data([1, 2, 3]), delays: delays, now: { Date() })
    }

    private func expect(_ attempt: ProgressPhotoUploadAttempt, _ expected: ProgressPhotoUploadResult) async throws {
        let result = try await attempt.run()
        XCTAssertEqual(result, expected)
    }
}

private actor PhotoAttemptFixture: ProgressPhotoRepositoryProtocol {
    var trace: [String] = []
    var reserved: [ProgressPhotoFields] = []
    let reserveSucceeds: Bool
    let holdReserve: Bool
    var uploads: [Bool]
    var probes: [ProgressPhoto?]
    var held: CheckedContinuation<Void, Never>?
    var waiting: CheckedContinuation<Void, Never>?

    init(reserveSucceeds: Bool = true, holdReserve: Bool = false, uploads: [Bool] = [], probes: [ProgressPhoto?] = []) {
        self.reserveSucceeds = reserveSucceeds
        self.holdReserve = holdReserve
        self.uploads = uploads
        self.probes = probes
    }

    func waitForReserve() async {
        if held == nil { await withCheckedContinuation { waiting = $0 } }
    }

    func releaseReserve() { held?.resume(); held = nil }
    func reserve(_ fields: ProgressPhotoFields) async throws -> String {
        trace.append("reserve")
        reserved.append(fields)
        if holdReserve {
            await withCheckedContinuation { held = $0; waiting?.resume(); waiting = nil }
        }
        guard reserveSucceeds else { throw ProgressPhotoError.unavailable }
        return photoFixtureId
    }
    func upload(_ jpeg: Data, to id: String) throws -> Bool {
        guard id == photoFixtureId, jpeg == Data([1, 2, 3]) else { throw ProgressPhotoError.unavailable }
        trace.append("upload")
        return uploads.removeFirst()
    }
    func reservation(_ id: String) throws -> ProgressPhoto? {
        guard id == photoFixtureId else { throw ProgressPhotoError.unavailable }
        trace.append("probe")
        return probes.removeFirst()
    }
    func delete(_ id: String) throws -> Bool {
        guard id == photoFixtureId else { throw ProgressPhotoError.unavailable }
        trace.append("delete")
        throw ProgressPhotoError.unavailable
    }
    func update(_ id: String, fields: ProgressPhotoFields) throws -> Bool { throw ProgressPhotoError.unavailable }
    func angles() throws -> [ProgressPhotoAngle] { throw ProgressPhotoError.unavailable }
    func summary() throws -> ProgressPhotoSummary { throw ProgressPhotoError.unavailable }
    func photos(on date: String) throws -> [ProgressPhoto] { throw ProgressPhotoError.unavailable }
    func history(angle: String) throws -> [ProgressPhoto] { throw ProgressPhotoError.unavailable }
    func measurements(on dates: [String]) throws -> [BodyMeasurement] { throw ProgressPhotoError.unavailable }
    func page(angle: String?, after: ProgressPhotoCursor?) throws -> ProgressPhotoPage { throw ProgressPhotoError.unavailable }
    func imageBytes(_ id: String, thumbnail: Bool) throws -> Data { throw ProgressPhotoError.unavailable }
}
