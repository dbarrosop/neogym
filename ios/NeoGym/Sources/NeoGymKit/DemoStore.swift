import Foundation

/// An isolated synthetic database. It never owns an SDK client, credential, cache or App Group URL.
public actor DemoStore {
    public static let userId = "demo-athlete"
    private var state: DemoState
    private let fileURL: URL?
    private var isActive = true

    public init(fileURL: URL? = nil, reset: Bool = false, now: Date = Date(), calendar: Calendar = .current) throws {
        self.fileURL = fileURL
        if !reset, let fileURL, FileManager.default.fileExists(atPath: fileURL.path) {
            let saved = try JSONDecoder().decode(DemoState.self, from: Data(contentsOf: fileURL))
            guard saved.version == DemoState.currentVersion else { throw DemoError.incompatibleData }
            state = saved
            DemoSeed.advance(&state, now: now, calendar: calendar)
        } else {
            state = DemoSeed.make(now: now, calendar: calendar)
        }
        try Self.save(state, to: fileURL)
    }

    public func invalidate() { isActive = false }

    func read<Value: Sendable>(_ body: @Sendable (DemoState) throws -> Value) throws -> Value {
        try checkActive()
        return try body(state)
    }

    /// Persist a complete copy before publishing it: failed saves and multi-row operations are atomic.
    func change<Value: Sendable>(_ body: @Sendable (inout DemoState) throws -> Value) throws -> Value {
        try checkActive()
        var next = state
        let value = try body(&next)
        try Self.save(next, to: fileURL)
        state = next
        return value
    }

    private func checkActive() throws {
        try Task.checkCancellation()
        guard isActive else { throw CancellationError() }
    }

    private static func save(_ state: DemoState, to fileURL: URL?) throws {
        guard let fileURL else { return }
        var directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        // No fallible work after the atomic write: an error must not persist an unreported mutation.
        try JSONEncoder().encode(state).write(to: fileURL, options: .atomic)
    }
}

public enum DemoError: LocalizedError, Sendable {
    case missingRecord, readOnly, duplicateDate, referencedTemplate, invalidEntry, incompatibleData

    public var errorDescription: String? {
        switch self {
        case .missingRecord: "This demo item no longer exists."
        case .readOnly: "Public sample items cannot be changed. Create your own item instead."
        case .duplicateDate: "A demo entry already exists for that date."
        case .referencedTemplate: "Remove this item from its meals or plans before deleting it."
        case .invalidEntry: "This entry does not match the demo item's requirements."
        case .incompatibleData: "The saved demo data cannot be loaded. Reset demo data to start again."
        }
    }
}

typealias DemoRecord = [String: JSONValue]

enum DemoTable: String, Codable, CaseIterable, Sendable {
    case exercises, workouts, sessions, sessionExercises, sets, cardio
    case foods, meals, ingredients, plans, planMeals, planFoods, days, logMeals, logEntries
    case body, energy, journal, workoutLabels, journalLabels
}

struct DemoState: Codable, Sendable {
    static let currentVersion = 1
    var version = currentVersion
    var preparedThrough = ""
    var tables: [String: [String: DemoRecord]] = [:]

    func rows(_ table: DemoTable) -> [DemoRecord] {
        (tables[table.rawValue] ?? [:]).values.sorted { $0.text("id") < $1.text("id") }
    }

    func row(_ table: DemoTable, _ id: String) throws -> DemoRecord {
        guard let value = tables[table.rawValue]?[id] else { throw DemoError.missingRecord }
        return value
    }

    func related(_ table: DemoTable, _ key: String, _ id: String) -> [DemoRecord] {
        rows(table).filter { $0.text(key) == id }.sorted {
            $0.number("position") == $1.number("position")
                ? $0.text("id") < $1.text("id") : $0.number("position") < $1.number("position")
        }
    }

    @discardableResult
    mutating func insert(_ table: DemoTable, _ values: DemoRecord, id: String = UUID().uuidString) -> String {
        var record = values
        record["id"] = .string(id)
        tables[table.rawValue, default: [:]][id] = record
        return id
    }

    mutating func update(_ table: DemoTable, _ id: String, _ values: DemoRecord) throws {
        var record = try row(table, id)
        record.merge(values) { _, new in new }
        tables[table.rawValue, default: [:]][id] = record
    }

    mutating func remove(_ table: DemoTable, _ id: String) {
        tables[table.rawValue]?[id] = nil
    }

    func decode<Value: Decodable>(_ type: Value.Type = Value.self, _ value: JSONValue) throws -> Value {
        try JSONDecoder().decode(type, from: JSONEncoder().encode(value))
    }

    func records<Value: Decodable>(_ type: Value.Type = Value.self, table: DemoTable) throws -> [Value] {
        try decode([Value].self, .array(rows(table).map(JSONValue.object)))
    }

    func editable(_ table: DemoTable, _ id: String) throws {
        if try row(table, id)["isPublic"] == .bool(true) { throw DemoError.readOnly }
    }

    func uniqueDate(_ table: DemoTable, key: String, value: String, excluding id: String? = nil) throws {
        guard !rows(table).contains(where: { $0.text(key) == value && $0.text("id") != id }) else {
            throw DemoError.duplicateDate
        }
    }
}

extension Dictionary where Key == String, Value == JSONValue {
    func text(_ key: String) -> String {
        guard case let .string(value) = self[key] else { return "" }
        return value
    }

    func number(_ key: String) -> Double { NutritionMath.normalizeNumeric(self[key] ?? .null) }
}

extension JSONValue {
    static func demoOptional(_ value: String?) -> JSONValue { value.map(JSONValue.string) ?? .null }
    static func demoNumber(_ value: String) -> JSONValue {
        Double(value).map(JSONValue.number) ?? .null
    }
}
