import Foundation

public struct ProgressPhotoAngle: Decodable, Identifiable, Equatable, Sendable {
    public let value: String
    public let comment: String?
    public var id: String { value }
    public var name: String {
        let title = comment?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return title.isEmpty ? value : title
    }
}

public struct ProgressPhotoCursor: Equatable, Sendable {
    public let takenOn: String
    public let createdAt: String
    public let id: String
}

public struct ProgressPhoto: Decodable, Identifiable, Equatable, Sendable {
    struct File: Decodable, Equatable, Sendable {
        let id: String
        let isUploaded: Bool
    }

    public let id: String
    public let takenOn: String
    public let createdAt: String
    public let label: ProgressPhotoAngle
    let file: File?

    public var isReady: Bool { file?.id == id && file?.isUploaded == true && Self.canonical(id) }
    var cursor: ProgressPhotoCursor { .init(takenOn: takenOn, createdAt: createdAt, id: id) }

    static func canonical(_ id: String) -> Bool {
        UUID(uuidString: id)?.uuidString.lowercased() == id
    }
}

public struct ProgressPhotoPage: Sendable {
    public static let size = 16
    public let photos: [ProgressPhoto]
    public let next: ProgressPhotoCursor?

    init(rows: [ProgressPhoto]) {
        let page = rows.prefix(Self.size)
        photos = page.filter(\.isReady)
        // Keep the full server tuple, including the timestamp's original precision.
        next = rows.count > Self.size ? page.last?.cursor : nil
    }
}

/// The gallery keeps already loaded rows while appending by the full server cursor.
/// This contains only metadata and lives inside the active route.
public struct ProgressPhotoGalleryRows: Sendable {
    public private(set) var photos: [ProgressPhoto] = []
    public private(set) var next: ProgressPhotoCursor?
    private var seen: Set<String> = []

    public init() {}

    public mutating func append(_ page: ProgressPhotoPage) {
        photos.append(contentsOf: page.photos.filter { seen.insert($0.id).inserted })
        next = page.next == next ? nil : page.next
    }
}

public enum ProgressPhotoDate {
    /// A date-only bridge for the picker, not the time zone used to decide "today".
    public static let pickerCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }()

    public static func today(now: Date = AppClock.now(), calendar: Calendar = AppClock.calendar) -> String {
        var gregorian = pickerCalendar
        gregorian.timeZone = calendar.timeZone
        return DateOnly.todayLocalISO(calendar: gregorian, now: now)
    }

    public static func isValid(_ date: String, through today: String) -> Bool {
        guard date.utf8.count == 10, date <= today,
              let parsed = DateOnly.parse(date, calendar: pickerCalendar) else { return false }
        return DateOnly.formatLocalISO(parsed, calendar: pickerCalendar) == date
    }

    public static func display(_ date: String) -> String {
        DateOnly.formatLong(date, calendar: pickerCalendar)
    }
}

public struct ProgressPhotoFields: Equatable, Sendable {
    public let label: String
    public let date: String

    public init?(label: String, date: String, catalog: [ProgressPhotoAngle], today: String = ProgressPhotoDate.today()) {
        guard catalog.contains(where: { $0.value == label }), ProgressPhotoDate.isValid(date, through: today) else { return nil }
        self.label = label
        self.date = date
    }
}

public enum ProgressPhotoError: Error, Equatable, Sendable {
    case unavailable, invalidImage, inputTooLarge, dimensionsTooLarge, encodingFailed
}

public protocol ProgressPhotoRepositoryProtocol: Sendable {
    func angles() async throws -> [ProgressPhotoAngle]
    func summary() async throws -> ProgressPhotoSummary
    func photos(on date: String) async throws -> [ProgressPhoto]
    func history(angle: String) async throws -> [ProgressPhoto]
    func measurements(on dates: [String]) async throws -> [BodyMeasurement]
    func page(angle: String?, after: ProgressPhotoCursor?) async throws -> ProgressPhotoPage
    /// Includes incomplete reservations for reconciliation. Display only `isReady` rows.
    func reservation(_ id: String) async throws -> ProgressPhoto?
    func reserve(_ fields: ProgressPhotoFields) async throws -> String
    func upload(_ jpeg: Data, to id: String) async throws -> Bool
    func update(_ id: String, fields: ProgressPhotoFields) async throws -> Bool
    func delete(_ id: String) async throws -> Bool
    func imageBytes(_ id: String, thumbnail: Bool) async throws -> Data
}

/// An old route can finish after dismissal or backgrounding, even if its
/// dependency ignores cancellation. Check the original scope before publishing.
@MainActor
public final class ProgressPhotoRouteScope {
    public let id = UUID()
    private var retired = false
    private var operations: [UUID: () -> Void] = [:]

    public init() {}
    public func retire() {
        retired = true
        for cancel in operations.values { cancel() }
        operations.removeAll()
    }
    public func check() throws {
        try Task.checkCancellation()
        if retired { throw CancellationError() }
    }
}

extension ProgressPhotoRouteScope {
    func perform<Value: Sendable>(_ operation: @escaping @Sendable () async throws -> Value) async throws -> Value {
        try check()
        let id = UUID()
        let task = Task {
            try Task.checkCancellation()
            return try await operation()
        }
        operations[id] = { task.cancel() }
        defer { operations[id] = nil }
        let value = try await withTaskCancellationHandler {
            try await task.value
        } onCancel: {
            task.cancel()
        }
        try check()
        return value
    }
}

/// Bind all service calls, including individual retry probes and writes, to the
/// route before starting them. Retirement cancels actual requests as well as UI publication.
public struct ScopedProgressPhotoRepository: ProgressPhotoRepositoryProtocol {
    private let base: any ProgressPhotoRepositoryProtocol
    private let scope: ProgressPhotoRouteScope

    public init(_ base: any ProgressPhotoRepositoryProtocol, scope: ProgressPhotoRouteScope) {
        self.base = base
        self.scope = scope
    }

    public func angles() async throws -> [ProgressPhotoAngle] { try await scope.perform { try await base.angles() } }
    public func summary() async throws -> ProgressPhotoSummary { try await scope.perform { try await base.summary() } }
    public func photos(on date: String) async throws -> [ProgressPhoto] { try await scope.perform { try await base.photos(on: date) } }
    public func history(angle: String) async throws -> [ProgressPhoto] { try await scope.perform { try await base.history(angle: angle) } }
    public func measurements(on dates: [String]) async throws -> [BodyMeasurement] {
        try await scope.perform { try await base.measurements(on: dates) }
    }
    public func page(angle: String?, after: ProgressPhotoCursor?) async throws -> ProgressPhotoPage {
        try await scope.perform { try await base.page(angle: angle, after: after) }
    }
    public func reservation(_ id: String) async throws -> ProgressPhoto? {
        try await scope.perform { try await base.reservation(id) }
    }
    public func reserve(_ fields: ProgressPhotoFields) async throws -> String {
        try await scope.perform { try await base.reserve(fields) }
    }
    public func upload(_ jpeg: Data, to id: String) async throws -> Bool {
        try await scope.perform { try await base.upload(jpeg, to: id) }
    }
    public func update(_ id: String, fields: ProgressPhotoFields) async throws -> Bool {
        try await scope.perform { try await base.update(id, fields: fields) }
    }
    public func delete(_ id: String) async throws -> Bool { try await scope.perform { try await base.delete(id) } }
    public func imageBytes(_ id: String, thumbnail: Bool) async throws -> Data {
        try await scope.perform { try await base.imageBytes(id, thumbnail: thumbnail) }
    }
}
