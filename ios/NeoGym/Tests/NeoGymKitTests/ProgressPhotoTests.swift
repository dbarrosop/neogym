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

    func testPagingBackRestoresTheExactPageStartAndResetDropsHistory() {
        let second = row(uploaded: true).cursor
        let third = row(id: "00000000-0000-4000-8000-000000000002", uploaded: true).cursor
        var paging = ProgressPhotoPaging()
        XCTAssertTrue(paging.next(after: second))
        XCTAssertFalse(paging.next(after: second), "A repeated cursor must not advance")
        XCTAssertTrue(paging.next(after: third))
        XCTAssertEqual(paging.number, 3)
        XCTAssertTrue(paging.previous())
        XCTAssertEqual(paging.cursor, second)
        XCTAssertEqual(paging.number, 2)
        XCTAssertTrue(paging.previous())
        XCTAssertNil(paging.cursor)
        XCTAssertFalse(paging.previous())
        XCTAssertTrue(paging.next(after: second))
        paging.reset()
        XCTAssertEqual(paging.number, 1)
        XCTAssertNil(paging.cursor)
        XCTAssertFalse(paging.canGoBack)
    }

    func testPagingRemembersOnlyTheMostRecentPageStarts() {
        var paging = ProgressPhotoPaging()
        let limit = ProgressPhotoPaging.previousPageLimit
        let cursors = (0...limit).map { offset in
            ProgressPhotoCursor(takenOn: "2024-02-29", createdAt: "2024-03-01T00:00:00.123456+00:00", id: "fixture-\(offset)")
        }
        for cursor in cursors { XCTAssertTrue(paging.next(after: cursor)) }
        for cursor in cursors.dropLast().reversed() {
            XCTAssertTrue(paging.previous())
            XCTAssertEqual(paging.cursor, cursor)
        }
        XCTAssertEqual(paging.number, 2)
        XCTAssertFalse(paging.previous())
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
