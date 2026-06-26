# NeoGym iOS

Native SwiftUI app for NeoGym. The current milestone implements email OTP
sign-in/sign-up, a protected profile screen, sign out, session bootstrap through
local Nhost Swift SDK storage, and the `neogym` URL scheme registration reserved
for later auth callbacks.

## Layout

```text
ios/NeoGym/
├── project.yml                 # XcodeGen source of truth
├── Package.swift               # NeoGymKit SwiftPM library + tests
├── App/                        # SwiftUI app target only
│   ├── NeoGymApp.swift
│   ├── RootView.swift
│   ├── SignInView.swift / SignUpView.swift / ProfileView.swift
│   ├── Components/ and Theme/
│   ├── Info.plist              # includes neogym:// URL scheme
│   └── Assets.xcassets/
├── Sources/NeoGymKit/          # host-testable auth/session logic
└── Tests/NeoGymKitTests/
```

`NeoGymKit` must stay free of SwiftUI/UIKit so `swift build` and `swift test`
run on the macOS host. SwiftUI views belong in `App/`.

## Prerequisites

- macOS with Xcode installed for simulator builds.
- Nix devshell from the repository root. On Darwin, the shell includes XcodeGen
  when the pinned Nixpkgs exposes `pkgs.xcodegen`.
- Local Nhost Swift SDK checkout at
  `../../../../../nhost/nhost/swift/packages/nhost-swift` relative to this
  directory (normally
  `/Users/dbarroso/workspace/nhost/nhost/swift/packages/nhost-swift`). Adjust
  `Package.swift` if your workspace layout differs.

If XcodeGen is not available from Nix on a Darwin host, install it with Homebrew
(`brew install xcodegen`) and run the same `xcodegen generate` command below. Do
not commit the generated `.xcodeproj`; `project.yml` is the source of truth. App
Info.plist entries that XcodeGen owns, including the `neogym` URL scheme, are
declared under the target `info.properties` in `project.yml`; rerun XcodeGen
after changing them.

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

`NhostConfig.local` defaults to `subdomain = "local"` and `region = "local"`,
matching the web app's local development config. `AuthStore` shows a loading
state while `getUserSession()` reads the SDK's persisted session, subscribes to
`sessionStore.subscribe`, then routes to either signed-out OTP forms or the
protected profile.

Sign-in and sign-up use Nhost email OTP: request a 6-digit code, copy it from
local MailHog, and verify it in the app. Sign-up sends
`AuthSignUpOptions(displayName:)`; both flows verify with
`verifySignInOTPEmail`. Sign out calls Nhost Auth when a refresh token exists and
then always clears the SDK's local session store so the app returns to signed-out
UI even if the remote sign-out request fails.

Manual local OTP check:

1. From the repository root, run `make -C backend dev-env-up`.
2. Build/run the iOS app in a simulator from Xcode, or generate/build with the
   commands above.
3. Sign up with display name + email, open MailHog, copy the 6-digit code, and
   verify.
4. Confirm the profile shows initials, display name, email, locale, role, user
   ID, and member-since date.
5. Sign out, sign in again with the same email, verify the OTP, and relaunch the
   app to confirm the persisted session is restored.

PKCE email-change handling is implemented in a later phase; the profile's
email-change affordance is present but disabled until then.
