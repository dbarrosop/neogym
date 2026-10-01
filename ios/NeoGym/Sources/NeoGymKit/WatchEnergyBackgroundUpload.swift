import Foundation

/// Only owner and bearer expiration (never the bearer) are persisted with a
/// background task. Legacy tasks without expiration cannot safely suppress a
/// later wake's reconciliation.
public enum WatchEnergyUploadTaskPolicy {
    public static let minimumRemaining: TimeInterval = 120
    public static let minimumNewBearerLifetime: TimeInterval = 600

    public static func description(ownerID: String, expiresAt: Date) -> String {
        "\(ownerID)|\(Int(expiresAt.timeIntervalSince1970))"
    }

    public static func ownerID(in description: String?) -> String? {
        description?.split(separator: "|", maxSplits: 1).first.map(String.init)
    }

    public static func canPinBearer(expiresAt: Date?, now: Date) -> Bool {
        guard let expiresAt else { return false }
        return expiresAt.timeIntervalSince(now) > minimumNewBearerLifetime
    }

    public static func canDedupe(_ description: String?, ownerID: String, now: Date) -> Bool {
        guard let description, Self.ownerID(in: description) == ownerID,
              let separator = description.firstIndex(of: "|"),
              let expiry = TimeInterval(description[description.index(after: separator)...]),
              expiry.isFinite else { return false }
        return expiry > now.timeIntervalSince1970 + minimumRemaining
    }
}

/// One idempotent, owner-scoped GraphQL mutation instead of seven foreground
/// read/update/create round trips. Hasura insert permissions set userId from the
/// bearer token; the conflict predicate protects manual and edited entries.
public enum WatchEnergyBackgroundUpload {
    public static let mutation = """
    mutation ImportWatchEnergy($objects: [dailyEnergy_insert_input!]!) {
      insertDailyEnergyEntries(
        objects: $objects,
        on_conflict: {
          constraint: daily_energy_user_date_key,
          update_columns: [activeKcal, restingKcal],
          where: { notes: { _eq: "Imported from Apple Health" } }
        }
      ) { affectedRows: affected_rows }
    }
    """

    public static func body(entries: [HealthDailyEnergy], now: Date, calendar: Calendar) throws -> Data? {
        let today = DateOnly.formatLocalISO(now, calendar: calendar)
        let start = calendar.date(byAdding: .day, value: -6, to: calendar.startOfDay(for: now)) ?? now
        let since = DateOnly.formatLocalISO(start, calendar: calendar)
        let objects: [[String: Any]] = entries.compactMap { day in
            guard day.energyOn >= since, day.energyOn <= today,
                  let form = day.formValues(notes: "Imported from Apple Health") else { return nil }
            return [
                "energyOn": form.energyOn,
                "activeKcal": form.activeKcal.isEmpty ? NSNull() : form.activeKcal as Any,
                "restingKcal": form.restingKcal.isEmpty ? NSNull() : form.restingKcal as Any,
                "notes": "Imported from Apple Health"
            ]
        }
        guard !objects.isEmpty else { return nil }
        return try JSONSerialization.data(withJSONObject: [
            "operationName": "ImportWatchEnergy", "query": mutation,
            "variables": ["objects": objects]
        ])
    }

    /// A transport-level HTTP success can still contain GraphQL errors. Never
    /// mark the background mutation complete unless Hasura returned the field.
    public static func succeeded(status: Int?, data: Data?) -> Bool {
        guard status == 200, let data,
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              body["errors"] == nil, let fields = body["data"] as? [String: Any],
              let mutation = fields["insertDailyEnergyEntries"] as? [String: Any],
              mutation["affectedRows"] is Int else { return false }
        return true
    }
}
