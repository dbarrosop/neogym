import Foundation

public protocol DailyEnergyRepositoryProtocol: Sendable {
    func listEntries() async throws -> [DailyEnergy]
    func listEntries(limit: Int, offset: Int) async throws -> [DailyEnergy]
    func listEntryDates() async throws -> [String]
    func listEntriesForHealthRefresh(since energyOn: String) async throws -> [DailyEnergy]
    func entry(id: String) async throws -> DailyEnergy?
    func editEntry(id: String) async throws -> DailyEnergy?
    func createEntry(_ values: DailyEnergyFormValues) async throws -> String
    func updateEntry(id: String, values: DailyEnergyFormValues) async throws
    func deleteEntry(id: String) async throws
}

public extension DailyEnergyRepositoryProtocol {
    func listEntries(limit: Int, offset: Int) async throws -> [DailyEnergy] {
        let allEntries = try await listEntries()
        guard offset < allEntries.count else { return [] }
        return Array(allEntries.dropFirst(offset).prefix(limit))
    }

    func listEntryDates() async throws -> [String] {
        try await listEntries().map(\.energyOn)
    }

    func listEntriesForHealthRefresh(since energyOn: String) async throws -> [DailyEnergy] {
        try await listEntries().filter { $0.energyOn >= energyOn }
    }
}

public struct DailyEnergyRepository: DailyEnergyRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listEntries() async throws -> [DailyEnergy] {
        try await listEntries(limit: Self.pageSize, offset: 0)
    }

    public func listEntries(limit: Int = Self.pageSize, offset: Int = 0) async throws -> [DailyEnergy] {
        let data: DailyEnergyEntriesData = try await graphQL.execute(
            query: Self.dailyEnergyQuery,
            variables: GraphQLScalars.variables(
                ("limit", .number(Double(limit))),
                ("offset", .number(Double(offset)))
            ),
            operationName: "DailyEnergy"
        )
        return data.dailyEnergyEntries
    }

    public func listEntryDates() async throws -> [String] {
        let data: DailyEnergyEntryDatesData = try await graphQL.execute(
            query: Self.dailyEnergyEntryDatesQuery,
            operationName: "DailyEnergyEntryDates"
        )
        return data.dailyEnergyEntries.map(\.energyOn)
    }

    public func listEntriesForHealthRefresh(since energyOn: String) async throws -> [DailyEnergy] {
        let data: DailyEnergyEntriesData = try await graphQL.execute(
            query: Self.dailyEnergyHealthRefreshEntriesQuery,
            variables: ["since": GraphQLScalars.date(energyOn)],
            operationName: "DailyEnergyHealthRefreshEntries"
        )
        return data.dailyEnergyEntries
    }

    public func entry(id: String) async throws -> DailyEnergy? {
        let data: DailyEnergyEntryByIdData = try await graphQL.execute(
            query: Self.dailyEnergyEntryByIdQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DailyEnergyById"
        )
        return data.dailyEnergyEntry
    }

    public func editEntry(id: String) async throws -> DailyEnergy? {
        let data: EditDailyEnergyData = try await graphQL.execute(
            query: Self.editDailyEnergyQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditDailyEnergy"
        )
        return data.dailyEnergyEntry
    }

    public func createEntry(_ values: DailyEnergyFormValues) async throws -> String {
        let data: InsertDailyEnergyData = try await graphQL.execute(
            query: Self.insertDailyEnergyMutation,
            variables: ["obj": Self.entryObject(values)],
            operationName: "InsertDailyEnergy"
        )
        guard let id = data.insertDailyEnergyEntry?.id else {
            throw GraphQLDomainError.missingData(operationName: "InsertDailyEnergy")
        }
        return id
    }

    public func updateEntry(id: String, values: DailyEnergyFormValues) async throws {
        let _: UpdateDailyEnergyData = try await graphQL.execute(
            query: Self.updateDailyEnergyMutation,
            variables: [
                "id": GraphQLScalars.uuid(id),
                "set": Self.entryObject(values)
            ],
            operationName: "UpdateDailyEnergy"
        )
    }

    public func deleteEntry(id: String) async throws {
        let _: DeleteDailyEnergyData = try await graphQL.execute(
            query: Self.deleteDailyEnergyMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteDailyEnergy"
        )
    }

    public static func entryObject(_ values: DailyEnergyFormValues) -> JSONValue {
        .object([
            "energyOn": GraphQLScalars.date(values.energyOn),
            "activeKcal": values.activeKcal.isEmpty ? .null : .string(values.activeKcal),
            "restingKcal": values.restingKcal.isEmpty ? .null : .string(values.restingKcal),
            "notes": values.notes.isEmpty ? .null : .string(values.notes)
        ])
    }
}

private struct DailyEnergyEntriesData: Decodable, Sendable {
    let dailyEnergyEntries: [DailyEnergy]
}

private struct DailyEnergyEntryDatesData: Decodable, Sendable {
    let dailyEnergyEntries: [DailyEnergyDate]
}

private struct DailyEnergyDate: Decodable, Sendable {
    let energyOn: String
}

private struct DailyEnergyEntryByIdData: Decodable, Sendable {
    let dailyEnergyEntry: DailyEnergy?
}

private struct EditDailyEnergyData: Decodable, Sendable {
    let dailyEnergyEntry: DailyEnergy?
}

private struct InsertDailyEnergyData: Decodable, Sendable {
    let insertDailyEnergyEntry: DailyEnergyMutationIdPayload?
}

private struct UpdateDailyEnergyData: Decodable, Sendable {
    let updateDailyEnergyEntry: DailyEnergyMutationIdPayload?
}

private struct DeleteDailyEnergyData: Decodable, Sendable {
    let deleteDailyEnergyEntry: DailyEnergyMutationIdPayload?
}

private struct DailyEnergyMutationIdPayload: Decodable, Sendable {
    let id: String
}

public extension DailyEnergyRepository {
    static let pageSize = 25

    static let dailyEnergyQuery = """
    query DailyEnergy($limit: Int!, $offset: Int!) {
      dailyEnergyEntries(order_by: { energyOn: desc }, limit: $limit, offset: $offset) {
        id
        energyOn
        activeKcal
        restingKcal
        notes
      }
    }
    """

    static let dailyEnergyEntryDatesQuery = """
    query DailyEnergyEntryDates {
      dailyEnergyEntries(order_by: { energyOn: desc }) {
        energyOn
      }
    }
    """

    static let dailyEnergyHealthRefreshEntriesQuery = """
    query DailyEnergyHealthRefreshEntries($since: date!) {
      dailyEnergyEntries(where: { energyOn: { _gte: $since } }, order_by: { energyOn: desc }) {
        id
        energyOn
        activeKcal
        restingKcal
        notes
      }
    }
    """

    static let dailyEnergyEntryByIdQuery = """
    query DailyEnergyById($id: uuid!) {
      dailyEnergyEntry(id: $id) {
        id
        energyOn
        activeKcal
        restingKcal
        notes
        updatedAt
      }
    }
    """

    static let editDailyEnergyQuery = """
    query EditDailyEnergy($id: uuid!) {
      dailyEnergyEntry(id: $id) {
        id
        energyOn
        activeKcal
        restingKcal
        notes
      }
    }
    """

    static let insertDailyEnergyMutation = """
    mutation InsertDailyEnergy($obj: dailyEnergy_insert_input!) {
      insertDailyEnergyEntry(object: $obj) {
        id
      }
    }
    """

    static let updateDailyEnergyMutation = """
    mutation UpdateDailyEnergy($id: uuid!, $set: dailyEnergy_set_input!) {
      updateDailyEnergyEntry(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let deleteDailyEnergyMutation = """
    mutation DeleteDailyEnergy($id: uuid!) {
      deleteDailyEnergyEntry(id: $id) {
        id
      }
    }
    """
}
