import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import NeoGymKit

@MainActor
final class ProgressPhotoTests: XCTestCase {
    func testCalendarDayIsIndependentOfUTCAndRegionCalendar() throws {
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2024-03-01T01:00:00Z"))
        var west = Calendar(identifier: .buddhist)
        west.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        var east = west
        east.timeZone = try XCTUnwrap(TimeZone(identifier: "Pacific/Kiritimati"))
        XCTAssertEqual(ProgressPhotoDate.today(now: now, calendar: west), "2024-02-29")
        XCTAssertEqual(ProgressPhotoDate.today(now: now, calendar: east), "2024-03-01")
        XCTAssertTrue(ProgressPhotoDate.isValid("2024-02-29", through: "2024-03-01"))
        XCTAssertFalse(ProgressPhotoDate.isValid("2023-02-29", through: "2024-03-01"))
        XCTAssertFalse(ProgressPhotoDate.isValid("2024-03-01", through: "2024-02-29"))
        XCTAssertFalse(ProgressPhotoDate.isValid("0000-01-01", through: "2024-03-01"))
        XCTAssertTrue(ProgressPhotoDate.isValid("2011-12-30", through: "2024-03-01"), "a skipped date in another zone stays a valid wire date")
    }

    func testPageUsesExactServerTimestampAndIDAndKeepsSameDayDuplicates() throws {
        let rows = (1...17).map { index in
            let id = String(format: "00000000-0000-4000-8000-%012d", 18 - index)
            return row(id: id, uploaded: true)
        }
        let page = ProgressPhotoPage(rows: rows)
        XCTAssertEqual(page.photos.count, 16)
        XCTAssertEqual(Set(page.photos.map(\.takenOn)), ["2024-02-29"])
        XCTAssertEqual(Set(page.photos.map(\.id)).count, 16)
        XCTAssertEqual(page.next, rows[15].cursor)
        XCTAssertNil(ProgressPhotoPage(rows: Array(rows.prefix(16))).next)
        XCTAssertTrue(ProgressPhotoPage(rows: [row(uploaded: nil), row(uploaded: false)]).photos.isEmpty)
        let filter = ProgressPhotoRepository.galleryWhere(owner: "owner", angle: "profile", after: try XCTUnwrap(page.next))
        XCTAssertEqual(filter["labelValue"] as? [String: String], ["_eq": "profile"])
        let branches = try XCTUnwrap(filter["_or"] as? [[String: [String: String]]])
        XCTAssertEqual(branches, [
            ["takenOn": ["_lt": "2024-02-29"]],
            ["takenOn": ["_eq": "2024-02-29"], "createdAt": ["_lt": rows[15].createdAt]],
            ["takenOn": ["_eq": "2024-02-29"], "createdAt": ["_eq": rows[15].createdAt], "id": ["_lt": rows[15].id]]
        ])
        XCTAssertEqual(rows[15].createdAt, "2024-03-01T00:00:00.123456+00:00")
    }

    func testAppendingOlderRowsMergesOneDateWithoutCollapsingDistinctUploads() {
        let photos = (1...18).map { photo(index: 19 - $0, date: "2024-02-29", angle: "front_a") }
        var rows = ProgressPhotoGalleryRows()
        let first = ProgressPhotoPage(rows: Array(photos.prefix(17)))
        rows.append(first)
        XCTAssertEqual(rows.next, photos[15].cursor)
        // A repeated ID (but not a different upload for the same day and pose) is skipped.
        rows.append(ProgressPhotoPage(rows: Array(photos.suffix(3))))
        let sheet = ProgressPhotoHistory.sheet(rows.photos, catalog: [])
        XCTAssertEqual(sheet.days.map(\.date), ["2024-02-29"])
        XCTAssertEqual(sheet.days.first?.photos.map(\.id), photos.map(\.id))
        XCTAssertNil(rows.next)

        rows = .init()
        rows.append(first)
        rows.append(first)
        XCTAssertNil(rows.next, "A repeated cursor must not loop")
        XCTAssertEqual(rows.photos.count, 16)
    }

    func testContactSheetAndLatestTilesUseWebAngleOrder() {
        let front = photo(index: 3, date: "2024-02-29", angle: "front_b")
        let side = photo(index: 2, date: "2024-02-29", angle: "side_left")
        let back = photo(index: 1, date: "2024-02-22", angle: "back_a")
        let unknown = photo(index: 4, date: "2024-02-29", angle: "other")
        let sheet = ProgressPhotoHistory.sheet([front, side, back, unknown], catalog: [back.label, side.label, front.label])
        XCTAssertEqual(sheet.columns.map(\.value), ["front_b", "side_left", "back_a", "other"])
        XCTAssertEqual(sheet.days.map(\.date), ["2024-02-29", "2024-02-22"])
        XCTAssertEqual(sheet.days.last?.photos, [back], "A missing angle must remain an empty slot")
        XCTAssertEqual(ProgressPhotoHistory.latestTiles([unknown, front, side]), [front, side, unknown])
    }

    func testSameAngleNavigationAndComparisonIncludingSameDayDuplicates() throws {
        let newest = photo(index: 3, date: "2024-03-01", angle: "front_a")
        let duplicate = photo(index: 2, date: "2024-03-01", angle: "front_a")
        let oldest = photo(index: 1, date: "2024-02-29", angle: "front_a")
        let photos = [newest, duplicate, oldest]
        XCTAssertEqual(ProgressPhotoHistory.comparableAngle([newest, newest]), nil)
        XCTAssertEqual(ProgressPhotoHistory.comparableAngle(photos), "front_a")
        let middle = try XCTUnwrap(ProgressPhotoHistory.neighbors(photos, id: duplicate.id))
        XCTAssertEqual(middle.position, 2)
        XCTAssertEqual(middle.older, oldest)
        XCTAssertEqual(middle.newer, newest)

        let defaults = try XCTUnwrap(ProgressPhotoHistory.comparison(photos, from: nil, to: nil))
        XCTAssertEqual(defaults.before, oldest)
        XCTAssertEqual(defaults.after, newest)
        XCTAssertEqual(defaults.days, 1)
        let fromNewest = try XCTUnwrap(ProgressPhotoHistory.comparison(photos, from: newest.id, to: nil))
        XCTAssertEqual(fromNewest, defaults)
        let reversed = try XCTUnwrap(ProgressPhotoHistory.comparison(photos, from: newest.id, to: duplicate.id))
        XCTAssertEqual(reversed.before, duplicate)
        XCTAssertEqual(reversed.after, newest)
        XCTAssertEqual(reversed.days, 0)
    }

    func testPhotoMeasurementsUseSameDayOrBoundedComparisonLookback() {
        let older = BodyMeasurement(id: "1", measuredOn: "2024-02-22", weightKg: 73, bodyFatPct: 19)
        let latest = BodyMeasurement(id: "2", measuredOn: "2024-03-02", weightKg: 72)
        let empty = BodyMeasurement(id: "3", measuredOn: "2024-03-01")
        let rows = [older, latest, empty]
        XCTAssertNil(ProgressPhotoHistory.measurement(rows, for: "2024-02-29"))
        XCTAssertEqual(ProgressPhotoHistory.measurement(rows, for: "2024-02-29", lookback: 7), older)
        XCTAssertNil(ProgressPhotoHistory.measurement(rows, for: "2024-03-01", lookback: 7), "An eighth-day row or a future row is not eligible")
        XCTAssertEqual(ProgressPhotoHistory.measurement(rows, for: "2024-03-02"), latest)
        XCTAssertNil(ProgressPhotoHistory.change(from: older, to: older))
        XCTAssertEqual(ProgressPhotoHistory.change(from: older, to: latest), .init(weightKg: -1, bodyFatPct: nil))
    }

    private func photo(index: Int, date: String, angle: String) -> ProgressPhoto {
        let id = String(format: "00000000-0000-4000-8000-%012d", index)
        return .init(id: id, takenOn: date, createdAt: "2024-03-01T00:00:00.123456+00:00",
                     label: .init(value: angle, comment: nil), file: .init(id: id, isUploaded: true))
    }

    func testRejectsOversizedFileAndLargeDeclaredRasterBeforeDecode() throws {
        let file = try syntheticFile(type: .png, width: 12_001, height: 2)
        defer { try? FileManager.default.removeItem(at: file) }
        XCTAssertThrowsError(try ProgressPhotoImage.prepare(file: file)) {
            XCTAssertEqual($0 as? ProgressPhotoError, .dimensionsTooLarge)
        }
        let handle = try FileHandle(forWritingTo: file)
        try handle.truncate(atOffset: UInt64(ProgressPhotoImage.inputLimit + 1))
        try handle.close()
        XCTAssertThrowsError(try ProgressPhotoImage.prepare(file: file)) {
            XCTAssertEqual($0 as? ProgressPhotoError, .inputTooLarge)
        }
    }

    func testPreparationDownsamplesOrientationAndStripsGPSAndTIFF() throws {
        let file = try syntheticFile(type: .jpeg, width: 3_840, height: 2_560, tagged: true)
        defer { try? FileManager.default.removeItem(at: file) }
        let source = try XCTUnwrap(CGImageSourceCreateWithURL(file as CFURL, nil))
        let before = try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
        XCTAssertNotNil(before[kCGImagePropertyGPSDictionary])
        XCTAssertEqual(before[kCGImagePropertyOrientation] as? Int, 6)
        let data = try ProgressPhotoImage.prepare(file: file)
        XCTAssertLessThanOrEqual(data.count, ProgressPhotoImage.jpegLimit)
        let output = try XCTUnwrap(CGImageSourceCreateWithData(data as CFData, nil))
        XCTAssertEqual(CGImageSourceGetType(output) as String?, UTType.jpeg.identifier)
        let after = try XCTUnwrap(CGImageSourceCopyPropertiesAtIndex(output, 0, nil) as? [CFString: Any])
        XCTAssertNil(after[kCGImagePropertyGPSDictionary])
        XCTAssertNil((after[kCGImagePropertyTIFFDictionary] as? [CFString: Any])?[kCGImagePropertyTIFFArtist])
        XCTAssertEqual(after[kCGImagePropertyOrientation] as? Int ?? 1, 1)
        XCTAssertEqual(after[kCGImagePropertyPixelHeight] as? Int, 2_560)
        XCTAssertEqual(after[kCGImagePropertyPixelWidth] as? Int, 1_707)
        let thumb = try ProgressPhotoImage.display(data, thumbnail: true)
        XCTAssertEqual(thumb.height, 600)
        XCTAssertTrue((399...400).contains(thumb.width), "ImageIO preserves the aspect ratio with pixel rounding")
    }

    func testCommonHEICStill() throws {
        guard (CGImageDestinationCopyTypeIdentifiers() as? [String])?.contains(UTType.heic.identifier) == true else {
            throw XCTSkip("Host ImageIO cannot encode a synthetic HEIC fixture")
        }
        let file = try syntheticFile(type: .heic, width: 144, height: 96)
        defer { try? FileManager.default.removeItem(at: file) }
        let data = try ProgressPhotoImage.prepare(file: file)
        let photo = try ProgressPhotoImage.display(data, thumbnail: false)
        XCTAssertEqual(photo.width, 144)
        XCTAssertEqual(photo.height, 96)
    }

    func testOnlyTheRetiredRouteRejectsLatePublication() async throws {
        let retired = ProgressPhotoRouteScope()
        let newRoute = ProgressPhotoRouteScope()
        let task = Task { @MainActor in try retired.check() }
        retired.retire()
        do { try await task.value; XCTFail("retired route published") } catch is CancellationError {}
        XCTAssertNoThrow(try newRoute.check())
        XCTAssertNotEqual(retired.id, newRoute.id)
    }

    private func syntheticFile(type: UTType, width: Int, height: Int, tagged: Bool = false) throws -> URL {
        let context = try XCTUnwrap(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(red: 0.2, green: 0.7, blue: 0.3, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let encoder = try XCTUnwrap(CGImageDestinationCreateWithURL(file as CFURL, type.identifier as CFString, 1, nil))
        let properties: [CFString: Any] = [
            kCGImagePropertyOrientation: 6,
            kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 42.0, kCGImagePropertyGPSLatitudeRef: "N"],
            kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFArtist: "Synthetic fixture"]
        ]
        CGImageDestinationAddImage(encoder, try XCTUnwrap(context.makeImage()), tagged ? properties as CFDictionary : nil)
        XCTAssertTrue(CGImageDestinationFinalize(encoder))
        return file
    }
}

let photoFixtureId = "00000000-0000-4000-8000-000000000001"

func row(id: String = photoFixtureId, uploaded: Bool?) -> ProgressPhoto {
    ProgressPhoto(id: id, takenOn: "2024-02-29", createdAt: "2024-03-01T00:00:00.123456+00:00",
                  label: .init(value: "profile", comment: "Profile"), file: uploaded.map { .init(id: id, isUploaded: $0) })
}
