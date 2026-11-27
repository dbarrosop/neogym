import Foundation

/// Fictional check-ins for the offline demo. Only the prepared demo date and
/// matching demo measurements come from the store. All pixels are bundled art;
/// there is no access to the Photos library, SDK, or Storage.
struct DemoProgressPhotoRepository: ProgressPhotoRepositoryProtocol {
    let store: DemoStore
    let isDemo = true

    private static let front = ProgressPhotoAngle(value: "front_a", comment: "Front A")
    private static let back = ProgressPhotoAngle(value: "back_a", comment: "Back A")
    private static let catalog = [front, back]

    private enum Illustration: String {
        case blue, amber, green
    }

    private struct Sample {
        let photo: ProgressPhoto
        let illustration: Illustration
    }

    func angles() async throws -> [ProgressPhotoAngle] {
        try await store.read { _ in Self.catalog }
    }

    func summary() async throws -> ProgressPhotoSummary {
        let photos = try await rows()
        return .init(count: photos.count, latestDate: photos.first?.takenOn)
    }

    func photos(on date: String) async throws -> [ProgressPhoto] {
        try await rows().filter { $0.takenOn == date }
    }

    func history(angle: String) async throws -> [ProgressPhoto] {
        try await rows().filter { $0.label.value == angle }
    }

    func measurements(on dates: [String]) async throws -> [BodyMeasurement] {
        let selected = Set(dates)
        return try await store.read { state in
            try state.rows(.body).filter { selected.contains($0.text("measuredOn")) }.map {
                try state.decode(BodyMeasurement.self, .object($0))
            }
        }
    }

    func page(angle: String?, after: ProgressPhotoCursor?) async throws -> ProgressPhotoPage {
        let photos = try await rows().filter { photo in
            guard angle == nil || photo.label.value == angle else { return false }
            guard let after else { return true }
            return (photo.takenOn, photo.createdAt, photo.id) < (after.takenOn, after.createdAt, after.id)
        }
        return ProgressPhotoPage(rows: Array(photos.prefix(ProgressPhotoPage.size + 1)))
    }

    func reservation(_ id: String) async throws -> ProgressPhoto? {
        try await rows().first { $0.id == id }
    }

    func imageBytes(_ id: String, thumbnail: Bool) async throws -> Data {
        let day = try await preparedDay()
        guard let illustration = Self.samples(through: day, calendar: store.calendar).first(where: { $0.photo.id == id })?.illustration,
              let file = Bundle.module.url(forResource: "demo-progress-photo-\(illustration.rawValue)", withExtension: "png") else {
            throw ProgressPhotoError.unavailable
        }
        // Illustrations are already 480 × 600; there is no second thumbnail file.
        let bytes = try Data(contentsOf: file)
        try Task.checkCancellation()
        return bytes
    }

    func reserve(_ fields: ProgressPhotoFields) async throws -> String { throw DemoError.readOnly }
    func upload(_ jpeg: Data, to id: String) async throws -> Bool { throw DemoError.readOnly }
    func update(_ id: String, fields: ProgressPhotoFields) async throws -> Bool { throw DemoError.readOnly }
    func delete(_ id: String) async throws -> Bool { throw DemoError.readOnly }

    private func preparedDay() async throws -> String {
        try await store.read { $0.preparedThrough }
    }

    private func rows() async throws -> [ProgressPhoto] {
        Self.samples(through: try await preparedDay(), calendar: store.calendar).map(\.photo)
    }

    private static func samples(through day: String, calendar: Calendar) -> [Sample] {
        guard let end = IntakeGrouping.localDateToDate(day, calendar: calendar) else { return [] }
        let checkIns: [(offset: Int, front: Illustration, back: Illustration?)] = [
            (0, .blue, .amber), (14, .amber, .green), (35, .green, nil)
        ]
        return checkIns.flatMap { checkIn -> [Sample] in
            guard let approximate = calendar.date(byAdding: .day, value: -checkIn.offset, to: end) else { return [] }
            // Match the Body seed's cadence in the same local calendar. Today's check-in always has a reading.
            let date = checkIn.offset == 0 ? end : (0...2).lazy.compactMap {
                calendar.date(byAdding: .day, value: -$0, to: approximate)
            }.first { DemoSeed.isScheduledBodyDay(DemoSeed.dayOrdinal($0, calendar: calendar)) }
            guard let date else { return [] }
            let takenOn = DateOnly.formatLocalISO(date, calendar: calendar)
            var samples = [sample(takenOn: takenOn, number: 2, label: front, art: checkIn.front)]
            if let art = checkIn.back { samples.append(sample(takenOn: takenOn, number: 1, label: back, art: art)) }
            return samples
        }
    }

    private static func sample(takenOn: String, number: Int, label: ProgressPhotoAngle, art: Illustration) -> Sample {
        let dayDigits = takenOn.replacingOccurrences(of: "-", with: "")
        let id = "de000000-0000-4000-8000-\(dayDigits)000\(number)"
        return Sample(photo: .init(id: id, takenOn: takenOn, createdAt: "\(takenOn)T12:00:00Z",
                                   label: label, file: .init(id: id, isUploaded: true)), illustration: art)
    }
}
