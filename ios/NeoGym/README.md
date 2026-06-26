# NeoGym iOS

Native SwiftUI shell for NeoGym. Phase 1 is intentionally small: it builds a placeholder signed-out/protected shell, registers the `neogym` URL scheme for later auth callbacks, and proves session bootstrap through the local Nhost Swift SDK.

## Layout

```text
ios/NeoGym/
├── project.yml                 # XcodeGen source of truth
├── Package.swift               # NeoGymKit SwiftPM library + tests
├── App/                        # SwiftUI app target only
│   ├── NeoGymApp.swift
│   ├── RootView.swift
│   ├── Info.plist              # includes neogym:// URL scheme
│   └── Assets.xcassets/
├── Sources/NeoGymKit/          # host-testable auth/session logic
└── Tests/NeoGymKitTests/
```

`NeoGymKit` must stay free of SwiftUI/UIKit so `swift build` and `swift test` run on the macOS host. SwiftUI views belong in `App/`.

## Prerequisites

- macOS with Xcode installed for simulator builds.
- Nix devshell from the repository root. On Darwin, the shell includes XcodeGen when the pinned Nixpkgs exposes `pkgs.xcodegen`.
- Local Nhost Swift SDK checkout at `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this directory (normally `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Adjust `Package.swift` if your workspace layout differs.

If XcodeGen is not available from Nix on a Darwin host, install it with Homebrew (`brew install xcodegen`) and run the same `xcodegen generate` command below. Do not commit the generated `.xcodeproj`; `project.yml` is the source of truth. App Info.plist entries that XcodeGen owns, including the `neogym` URL scheme, are declared under the target `info.properties` in `project.yml`; rerun XcodeGen after changing them.

## Commands

From this directory:

```sh
# Build and test the host-compatible package
swift build
swift test

# Generate the Xcode project from project.yml
nix develop ../.. --command xcodegen generate

# Build the simulator app shell
xcodebuild \
  -project NeoGym.xcodeproj \
  -scheme NeoGym \
  -destination 'generic/platform=iOS Simulator' \
  build
```

To confirm XcodeGen is supplied by Nix on Darwin:

```sh
cd ../..
nix develop . --command xcodegen --version
```

## Current auth scope

`NhostConfig.local` defaults to `subdomain = "local"` and `region = "local"`, matching the web app's local development config. `AuthStore` shows a loading state while `getUserSession()` reads the SDK's persisted session, subscribes to `sessionStore.subscribe`, then routes to either the signed-out placeholder or the protected placeholder. OTP forms, profile details, and PKCE email-change handling are implemented in later phases.
