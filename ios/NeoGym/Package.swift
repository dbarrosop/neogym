// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "NeoGymKit",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "NeoGymKit",
            targets: ["NeoGymKit"]
        )
    ],
    dependencies: [
        .package(path: "../../../../../nhost/nhost/swift/packages/nhost-swift")
    ],
    targets: [
        .target(
            name: "NeoGymKit",
            dependencies: [
                .product(name: "Nhost", package: "nhost-swift")
            ],
            path: "Sources/NeoGymKit"
        ),
        .testTarget(
            name: "NeoGymKitTests",
            dependencies: ["NeoGymKit"],
            path: "Tests/NeoGymKitTests"
        )
    ]
)
