import Foundation
import XCTest
@testable import NeoGymKit

final class DemoProgressPhotoTests: XCTestCase {
    func testBundledPhotosSupportGalleryHistoryAndMeasurements() async throws {
        let calendar = ProgressPhotoDate.pickerCalendar
        let now = try XCTUnwrap(DateOnly.parse("2025-01-15", calendar: calendar))
        let store = try DemoStore(now: now, calendar: calendar)
        let repository = try XCTUnwrap(AppRepositories.demo(store: store).progressPhotos)
        XCTAssertTrue(repository.isDemo)
        let angles = try await repository.angles()
        XCTAssertEqual(angles.map(\.value), ["front_a", "back_a"])
        let summary = try await repository.summary()
        XCTAssertEqual(summary.count, 5)
        XCTAssertEqual(summary.latestDate, "2025-01-15")
        let latest = try await repository.photos(on: "2025-01-15")
        XCTAssertEqual(latest.map(\.label.value), ["front_a", "back_a"])
        let page = try await repository.page(angle: nil, after: nil)
        XCTAssertEqual(page.photos.count, summary.count)
        XCTAssertTrue(page.photos.allSatisfy(\.isReady))
        XCTAssertNil(page.next)
        let front = try await repository.history(angle: "front_a")
        XCTAssertEqual(front.count, 3)
        XCTAssertEqual(Set(front.map(\.takenOn)).count, 3)
        XCTAssertEqual(front.map(\.takenOn), front.map(\.takenOn).sorted(by: >))
        let first = try XCTUnwrap(front.first)
        let filtered = try await repository.page(angle: "front_a", after: first.cursor)
        XCTAssertEqual(filtered.photos, Array(front.dropFirst()))
        let measurements = try await repository.measurements(on: front.map(\.takenOn))
        XCTAssertEqual(Set(measurements.map(\.measuredOn)), Set(front.map(\.takenOn)))
        XCTAssertTrue(measurements.allSatisfy { $0.weightKg != nil && $0.bodyFatPct != nil })

        var illustrations = Set<Data>()
        for photo in front {
            let full = try await repository.imageBytes(photo.id, thumbnail: false)
            let thumbnail = try await repository.imageBytes(photo.id, thumbnail: true)
            XCTAssertEqual(full, thumbnail)
            XCTAssertEqual(Array(full.prefix(8)), [137, 80, 78, 71, 13, 10, 26, 10], "Bundled art must be a PNG")
            illustrations.insert(full)
        }
        XCTAssertEqual(illustrations.count, front.count)
        let unknown = try await repository.reservation(UUID().uuidString.lowercased())
        XCTAssertNil(unknown)
    }

    @MainActor
    func testScopedDemoRejectsEveryWriteAndHonorsStoreRetirement() async throws {
        let store = try DemoStore()
        let base = try XCTUnwrap(AppRepositories.demo(store: store).progressPhotos)
        let repository = ScopedProgressPhotoRepository(base, scope: ProgressPhotoRouteScope())
        XCTAssertTrue(repository.isDemo)
        let angles = try await repository.angles()
        let photos = try await repository.history(angle: "front_a")
        let photo = try XCTUnwrap(photos.first)
        let fields = try XCTUnwrap(ProgressPhotoFields(label: photo.label.value, date: photo.takenOn,
                                                      catalog: angles, today: photo.takenOn))
        do { _ = try await repository.reserve(fields); XCTFail("Demo reserved a photo") } catch DemoError.readOnly {}
        do { _ = try await repository.upload(Data(), to: photo.id); XCTFail("Demo accepted an upload") } catch DemoError.readOnly {}
        do { _ = try await repository.update(photo.id, fields: fields); XCTFail("Demo updated a photo") } catch DemoError.readOnly {}
        do { _ = try await repository.delete(photo.id); XCTFail("Demo deleted a photo") } catch DemoError.readOnly {}
        let original = try await repository.reservation(photo.id)
        XCTAssertEqual(original, photo)
        await store.invalidate()
        do { _ = try await repository.imageBytes(photo.id, thumbnail: false); XCTFail("Retired demo served a photo") }
        catch is CancellationError {}
    }
}
