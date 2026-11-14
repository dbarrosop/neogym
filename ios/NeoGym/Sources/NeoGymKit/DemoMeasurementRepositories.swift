import Foundation

public struct DemoBodyRepository: BodyMeasurementsRepositoryProtocol {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listMeasurements() async throws -> [BodyMeasurement] {
        try await store.read { state in
            try state.records(BodyMeasurement.self, table: .body).sorted { $0.measuredOn > $1.measuredOn }
        }
    }

    public func measurement(id: String) async throws -> BodyMeasurement? {
        try await store.read { state in
            try state.tables[DemoTable.body.rawValue]?[id].map { try state.decode(BodyMeasurement.self, .object($0)) }
        }
    }

    public func editMeasurement(id: String) async throws -> BodyMeasurement? { try await measurement(id: id) }

    public func createMeasurement(_ values: BodyMeasurementFormValues) async throws -> String {
        try await save(id: nil, values: values)
    }

    public func updateMeasurement(id: String, values: BodyMeasurementFormValues) async throws {
        _ = try await save(id: id, values: values)
    }

    private func save(id: String?, values: BodyMeasurementFormValues) async throws -> String {
        guard case let .success(normalized) = BodyMeasurementValidation.validate(values) else { throw DemoError.invalidEntry }
        return try await store.change { state in
            try state.uniqueDate(.body, key: "measuredOn", value: normalized.measuredOn, excluding: id)
            let record: DemoRecord = [
                "measuredOn": .string(normalized.measuredOn), "weightKg": .demoNumber(normalized.weightKg),
                "bodyFatPct": .demoNumber(normalized.bodyFatPct), "notes": .string(normalized.notes),
                "updatedAt": .string(ISO8601DateFormatter().string(from: Date()))
            ]
            if let id { try state.update(.body, id, record); return id }
            return state.insert(.body, record)
        }
    }

    public func deleteMeasurement(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.body, id)
            state.remove(.body, id)
        }
    }
}

public struct DemoEnergyRepository: DailyEnergyRepositoryProtocol {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listEntries() async throws -> [DailyEnergy] {
        try await store.read { try $0.records(DailyEnergy.self, table: .energy).sorted { $0.energyOn > $1.energyOn } }
    }

    public func energyListPageUpdates(limit: Int, offset: Int) -> AsyncThrowingStream<DailyEnergyListPage, Error> {
        singleValueUpdates {
            let all = try await listEntries()
            return DailyEnergyListPage(entries: Array(all.dropFirst(max(offset, 0)).prefix(max(limit, 0))), totalCount: all.count)
        }
    }

    public func entry(id: String) async throws -> DailyEnergy? {
        try await store.read { state in
            try state.tables[DemoTable.energy.rawValue]?[id].map { try state.decode(DailyEnergy.self, .object($0)) }
        }
    }

    public func editEntry(id: String) async throws -> DailyEnergy? { try await entry(id: id) }
    public func createEntry(_ values: DailyEnergyFormValues) async throws -> String { try await save(id: nil, values: values) }
    public func updateEntry(id: String, values: DailyEnergyFormValues) async throws { _ = try await save(id: id, values: values) }

    private func save(id: String?, values: DailyEnergyFormValues) async throws -> String {
        guard case let .success(normalized) = DailyEnergyValidation.validate(values) else { throw DemoError.invalidEntry }
        return try await store.change { state in
            try state.uniqueDate(.energy, key: "energyOn", value: normalized.energyOn, excluding: id)
            let record: DemoRecord = [
                "energyOn": .string(normalized.energyOn), "activeKcal": .demoNumber(normalized.activeKcal),
                "restingKcal": .demoNumber(normalized.restingKcal), "notes": .string(normalized.notes),
                "updatedAt": .string(ISO8601DateFormatter().string(from: Date()))
            ]
            if let id { try state.update(.energy, id, record); return id }
            return state.insert(.energy, record)
        }
    }

    public func deleteEntry(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.energy, id)
            state.remove(.energy, id)
        }
    }
}
