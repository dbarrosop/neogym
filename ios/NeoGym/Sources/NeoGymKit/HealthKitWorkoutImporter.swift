import Foundation

#if canImport(HealthKit) && !os(macOS)
import CoreFoundation
import HealthKit

public enum HealthKitWorkoutImportError: LocalizedError, Sendable {
    case unavailable
    case authorizationDenied
    case invalidAnchor

    public var errorDescription: String? {
        switch self {
        case .unavailable: "Apple Health is not available on this device."
        case .authorizationDenied: "Apple Health workout access was not granted."
        case .invalidAnchor: "The saved Apple Health workout cursor could not be read."
        }
    }
}

/// Only requests workout read access. This does not read workout routes or individual
/// heart-rate/energy samples, which are distinct HealthKit types and permissions.
@available(iOS 16.0, *)
public final class HealthKitWorkoutImporter: HealthWorkoutImporting, @unchecked Sendable {
    private let store: HKHealthStore
    private static let batchSize = 100

    public init(store: HKHealthStore = HKHealthStore()) {
        self.store = store
    }

    public func changes(since anchor: Data?) async throws -> HealthWorkoutChangeBatch {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthKitWorkoutImportError.unavailable }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
            store.requestAuthorization(toShare: [], read: [HKObjectType.workoutType()]) { success, error in
                if let error { continuation.resume(throwing: error) }
                else if success { continuation.resume() }
                else { continuation.resume(throwing: HealthKitWorkoutImportError.authorizationDenied) }
            }
        }
        let savedAnchor: HKQueryAnchor?
        if let anchor {
            guard let decoded = try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: anchor) else {
                throw HealthKitWorkoutImportError.invalidAnchor
            }
            savedAnchor = decoded
        } else {
            savedAnchor = nil
        }

        let descriptor = HKAnchoredObjectQueryDescriptor<HKWorkout>(
            predicates: [.workout()], anchor: savedAnchor, limit: Self.batchSize
        )
        let result = try await descriptor.result(for: store)
        let newAnchor = try NSKeyedArchiver.archivedData(withRootObject: result.newAnchor, requiringSecureCoding: true)
        return HealthWorkoutChangeBatch(
            added: result.addedSamples.map { HealthWorkoutSnapshot(
                healthkitUuid: $0.uuid.uuidString.lowercased(),
                raw: Self.snapshot($0)
            ) },
            deletedIds: result.deletedObjects.map { $0.uuid.uuidString.lowercased() },
            nextAnchor: newAnchor,
            hasMore: result.addedSamples.count + result.deletedObjects.count >= Self.batchSize
        )
    }

    private static func snapshot(_ workout: HKWorkout) -> JSONValue {
        let activeEnergyType = HKQuantityType(.activeEnergyBurned)
        let activeKcal = workout.statistics(for: activeEnergyType)?.sumQuantity()?.doubleValue(for: .kilocalorie())
            ?? workout.totalEnergyBurned?.doubleValue(for: .kilocalorie())
        var value: [String: JSONValue] = [
            "uuid": .string(workout.uuid.uuidString.lowercased()),
            "workoutActivityType": .integer(Int64(workout.workoutActivityType.rawValue)),
            "workoutActivityTypeDescription": .string(String(describing: workout.workoutActivityType)),
            "startDate": date(workout.startDate),
            "endDate": date(workout.endDate),
            "durationSeconds": number(workout.duration),
            "activeEnergyBurnedKcal": optionalNumber(activeKcal),
            "totalDistanceMeters": optionalNumber(workout.totalDistance?.doubleValue(for: .meter())),
            "totalSwimmingStrokeCount": optionalNumber(workout.totalSwimmingStrokeCount?.doubleValue(for: .count())),
            "totalFlightsClimbed": optionalNumber(workout.totalFlightsClimbed?.doubleValue(for: .count())),
            "metadata": metadata(workout.metadata),
            "source": .object([
                "name": .string(workout.sourceRevision.source.name),
                "bundleIdentifier": .string(workout.sourceRevision.source.bundleIdentifier),
                "version": optionalString(workout.sourceRevision.version),
                "productType": optionalString(workout.sourceRevision.productType),
                "operatingSystemVersion": .string(String(describing: workout.sourceRevision.operatingSystemVersion))
            ]),
            "device": device(workout.device),
            "events": .array((workout.workoutEvents ?? []).map(event))
        ]
        value["activities"] = .array(workout.workoutActivities.map(activity))
        value["statistics"] = statistics(workout.allStatistics)
        return .object(value)
    }

    private static func activity(_ activity: HKWorkoutActivity) -> JSONValue {
        let configuration = activity.workoutConfiguration
        return .object([
            "uuid": .string(activity.uuid.uuidString.lowercased()),
            "activityType": .integer(Int64(configuration.activityType.rawValue)),
            "locationType": .integer(Int64(configuration.locationType.rawValue)),
            "swimmingLocationType": .integer(Int64(configuration.swimmingLocationType.rawValue)),
            "lapLength": activity.workoutConfiguration.lapLength.map { .string($0.description) } ?? .null,
            "startDate": date(activity.startDate),
            "endDate": activity.endDate.map(date) ?? .null,
            "durationSeconds": number(activity.duration),
            "metadata": metadata(activity.metadata),
            "events": .array(activity.workoutEvents.map(event)),
            "statistics": statistics(activity.allStatistics)
        ])
    }

    private static func statistics(_ all: [HKQuantityType: HKStatistics]) -> JSONValue {
        .object(Dictionary(uniqueKeysWithValues: all.map { type, stat in
            (type.identifier, JSONValue.object([
                "sum": stat.sumQuantity().map { .string($0.description) } ?? .null,
                "average": stat.averageQuantity().map { .string($0.description) } ?? .null,
                "minimum": stat.minimumQuantity().map { .string($0.description) } ?? .null,
                "maximum": stat.maximumQuantity().map { .string($0.description) } ?? .null
            ]))
        }))
    }

    private static func event(_ event: HKWorkoutEvent) -> JSONValue {
        .object([
            "type": .integer(Int64(event.type.rawValue)),
            "startDate": date(event.dateInterval.start),
            "endDate": date(event.dateInterval.end),
            "metadata": metadata(event.metadata)
        ])
    }

    private static func device(_ device: HKDevice?) -> JSONValue {
        guard let device else { return .null }
        return .object([
            "name": optionalString(device.name),
            "manufacturer": optionalString(device.manufacturer),
            "model": optionalString(device.model),
            "hardwareVersion": optionalString(device.hardwareVersion),
            "firmwareVersion": optionalString(device.firmwareVersion),
            "softwareVersion": optionalString(device.softwareVersion),
            "localIdentifier": optionalString(device.localIdentifier),
            "udiDeviceIdentifier": optionalString(device.udiDeviceIdentifier)
        ])
    }

    private static func metadata(_ values: [String: Any]?) -> JSONValue {
        .object((values ?? [:]).mapValues(jsonValue))
    }

    private static func jsonValue(_ value: Any) -> JSONValue {
        switch value {
        case let value as String: return .string(value)
        case let value as Date: return date(value)
        case let value as HKQuantity: return .string(value.description)
        case let value as NSNumber:
            if CFGetTypeID(value) == CFBooleanGetTypeID() { return .bool(value.boolValue) }
            return number(value.doubleValue)
        case let value as [Any]: return .array(value.map(jsonValue))
        case let value as [String: Any]: return .object(value.mapValues(jsonValue))
        case let value as Data: return .string(value.base64EncodedString())
        default: return .string(String(describing: value))
        }
    }

    private static func date(_ value: Date) -> JSONValue { GraphQLScalars.timestamptz(value) }
    private static func number(_ value: Double) -> JSONValue { value.isFinite ? .number(value) : .null }
    private static func optionalNumber(_ value: Double?) -> JSONValue { value.map(number) ?? .null }
    private static func optionalString(_ value: String?) -> JSONValue { value.map(JSONValue.string) ?? .null }
}
#endif
