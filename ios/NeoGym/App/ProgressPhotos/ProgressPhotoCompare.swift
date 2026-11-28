import NeoGymKit
import SwiftUI

struct ProgressPhotoCompare: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let initialLabel: String
    let initialPhoto: String?
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var catalog: [ProgressPhotoAngle] = []
    @State private var angle = ""
    @State private var photos: [ProgressPhoto] = []
    @State private var from: String?
    @State private var to: String?
    @State private var request = 0
    @State private var loading = true
    @State private var failed = false
    @State private var readings = PhotoReadings()

    private var pair: ProgressPhotoHistory.Pair? {
        ProgressPhotoHistory.comparison(photos, from: from, to: to)
    }

    var body: some View {
        FormScrollContainer {
            Text(repository.isDemo ? "Two fictional sample photos, oldest on the left." : "Two photos with the same angle, oldest on the left.")
                .font(.subheadline).foregroundStyle(NeoGymTheme.textSecondary)
            if !catalog.isEmpty {
                PhotoAngleChips(catalog: catalog, selection: Binding(get: { angle }, set: { selected in
                    guard angle != selected else { return }
                    photos = []
                    loading = true
                    from = nil
                    to = nil
                    angle = selected
                }))
            }
            if loading {
                AppLoadingStateView(title: "Loading photos to compare")
            } else if failed {
                AppErrorStateView(title: "Couldn't load photos", message: "Check your connection and try again.") { request += 1 }
            } else if let pair {
                comparison(pair)
            } else {
                let name = catalog.first { $0.value == angle }?.name
                let title = name.map { "Add at least two \($0) photos to compare" } ?? "No angles available"
                AppEmptyStateView(title: repository.isDemo ? "Not enough sample photos for this angle" : title,
                                  message: "Comparing works best with photos taken the same way, a few weeks apart.", systemImage: "rectangle.split.2x1")
                if !repository.isDemo {
                    NavigationLink("Add photos", value: ProgressRoute.progressPhotoCreate(date: nil, angle: angle))
                        .buttonStyle(.bordered).controlSize(.large)
                }
            }
        }
        .navigationTitle("Compare photos")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: LoadKey(angle: angle, request: request)) { await load() }
        .task(id: pair) { if let pair { await loadMeasurements(pair) } }
    }

    private struct LoadKey: Equatable { let angle: String; let request: Int }
    private struct PhotoReadings {
        var pair: ProgressPhotoHistory.Pair?
        var before: BodyMeasurement?
        var after: BodyMeasurement?
    }

    private func comparison(_ pair: ProgressPhotoHistory.Pair) -> some View {
        let before = readings.pair == pair ? readings.before : nil
        let after = readings.pair == pair ? readings.after : nil
        let change = ProgressPhotoHistory.change(from: before, to: after)
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 8))
        return VStack(alignment: .leading, spacing: 12) {
            layout {
                choices(pair, choosesBefore: true)
                choices(pair, choosesBefore: false)
            }
            PhotoComparisonSlider(repository: repository, scope: scope, pair: pair).id(pair.before.id + pair.after.id)
            layout {
                caption("Before", photo: pair.before, measurement: before)
                caption("After", photo: pair.after, measurement: after)
            }
            VStack(alignment: .leading, spacing: 6) {
                LabeledContent("Time between", value: pair.days == 0 ? "Same day" : "\(pair.days) \(pair.days == 1 ? "day" : "days")")
                if let weight = change?.weightKg {
                    LabeledContent("Weight change", value: "\(MetricFormat.signedDecimal(weight)) kg")
                }
                if let fat = change?.bodyFatPct {
                    LabeledContent("Body fat change", value: "\(MetricFormat.signedDecimal(fat))%")
                }
            }
            .monospacedDigit()
            .padding(14)
            .cardSurface()
        }
    }

    private func choices(_ pair: ProgressPhotoHistory.Pair, choosesBefore: Bool) -> some View {
        let counts = Dictionary(grouping: photos, by: \.takenOn)
        let choice = Binding(get: { choosesBefore ? pair.before.id : pair.after.id }, set: { selected in
            from = choosesBefore ? selected : pair.before.id
            to = choosesBefore ? pair.after.id : selected
        })
        return Picker(choosesBefore ? "Before" : "After", selection: choice) {
            ForEach(photos) { photo in
                let sameDate = counts[photo.takenOn] ?? []
                let date = ProgressPhotoDate.display(photo.takenOn)
                let ordinal = sameDate.firstIndex { $0.id == photo.id }.map { $0 + 1 } ?? 1
                Text(sameDate.count < 2 ? date : "\(date) (\(ordinal) of \(sameDate.count))").tag(photo.id)
            }
        }
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func caption(_ title: String, photo: ProgressPhoto, measurement: BodyMeasurement?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.headline)
            Text(ProgressPhotoDate.display(photo.takenOn)).font(.subheadline)
            PhotoMeasurementCaption(measurement: measurement, date: photo.takenOn)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func load() async {
        let selected = angle
        loading = true
        failed = false
        photos = []
        do {
            if catalog.isEmpty {
                let values = try await repository.angles()
                try scope.check()
                catalog = values
            }
            let valid = catalog.contains { $0.value == selected }
            if !valid {
                let start = catalog.first { $0.value == initialLabel }?.value ?? catalog.first?.value ?? ""
                guard !start.isEmpty else { loading = false; return }
                from = start == initialLabel ? initialPhoto : nil
                angle = start
                return
            }
            let items = try await repository.history(angle: selected)
            try scope.check()
            guard angle == selected else { return }
            photos = items
            loading = false
        } catch {
            guard (try? scope.check()) != nil, angle == selected else { return }
            failed = true
            loading = false
        }
    }

    private func loadMeasurements(_ pair: ProgressPhotoHistory.Pair) async {
        let dates = ProgressPhotoHistory.measurementDates(for: pair.before.takenOn, lookback: 7)
            + ProgressPhotoHistory.measurementDates(for: pair.after.takenOn, lookback: 7)
        guard let result = try? await repository.measurements(on: dates), (try? scope.check()) != nil, self.pair == pair else { return }
        readings = .init(pair: pair,
                         before: ProgressPhotoHistory.measurement(result, for: pair.before.takenOn, lookback: 7),
                         after: ProgressPhotoHistory.measurement(result, for: pair.after.takenOn, lookback: 7))
    }
}

private struct PhotoComparisonSlider: View {
    let repository: any ProgressPhotoRepositoryProtocol
    let scope: ProgressPhotoRouteScope
    let pair: ProgressPhotoHistory.Pair
    @State private var position = 0.5

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geometry in
                ZStack(alignment: .topLeading) {
                    image(pair.before, side: "Before")
                    image(pair.after, side: "After")
                        .clipShape(AfterPhotoReveal(position: position))
                        .contentShape(AfterPhotoReveal(position: position))
                    Rectangle().fill(.white.opacity(0.9)).frame(width: 2)
                        .offset(x: max(0, min(geometry.size.width - 2, geometry.size.width * position)))
                        .allowsHitTesting(false).accessibilityHidden(true)
                }
            }
            .aspectRatio(4.0 / 5.0, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 14))
            Slider(value: $position, in: 0...1) { Text("Photo comparison divider") }
                .frame(minHeight: 44)
                .accessibilityIdentifier("progressPhotos.compareDivider")
        }
    }

    // Clip hit testing too, so the left image's Retry stays reachable.
    private struct AfterPhotoReveal: Shape {
        let position: Double

        func path(in rect: CGRect) -> Path {
            let split = rect.width * position
            return Path(CGRect(x: rect.minX + split, y: rect.minY, width: rect.width - split, height: rect.height))
        }
    }

    private func image(_ photo: ProgressPhoto, side: String) -> some View {
        ProgressPhotoDisplay(repository: repository, scope: scope, id: photo.id,
                             label: "\(side), \(photo.label.name), \(ProgressPhotoDate.display(photo.takenOn))", fillFrame: true)
    }
}
