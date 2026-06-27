# NeoGym iOS

Native SwiftUI app for NeoGym. The current milestone implements email OTP
sign-in/sign-up, a protected seven-destination app shell, sign out, session
bootstrap through local Nhost Swift SDK storage, app-side PKCE email-change
handling through the `neogym://verify` URL scheme, and read-only Apple Health
imports for body weight/body-fat measurements.

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
│   ├── Info.plist              # URL scheme, HealthKit usage, launch screen
│   ├── LaunchScreen.storyboard # required so iOS uses modern full-screen sizing
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
Info.plist entries that XcodeGen owns, including the `neogym` URL scheme and
full-screen launch screen keys, are declared under the target `info.properties`
in `project.yml`; rerun XcodeGen after changing them. Keep
`LaunchScreen.storyboard` wired through `UILaunchStoryboardName`; without a
launch screen, iOS can run the app in legacy letterboxed compatibility sizing on
modern devices.

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

## Apple Health body imports

Opening the Body measurements view requests read-only Apple Health access for
body mass and body-fat percentage, then imports the latest sample per metric per
local calendar day. The app requests no write authorization and does not export
NeoGym measurements back to HealthKit. If NeoGym already has a measurement for a
day, the HealthKit sample for that day is skipped rather than merged or
overwritten.

The HealthKit capability and `NSHealthShareUsageDescription` are declared in
`project.yml`; regenerate the Xcode project after changing them. The concrete
HealthKit importer is compiled only for non-macOS platforms so `NeoGymKit` keeps
building and testing on the macOS host.

## Current auth scope

`NhostConfig.local` defaults to `subdomain = "local"` and `region = "local"`,
matching the web app's local development config. `AuthStore` shows a loading
state while `getUserSession()` reads the SDK's persisted session, subscribes to
`sessionStore.subscribe`, then routes to either signed-out OTP forms or the
protected full-screen app shell.

Sign-in and sign-up use Nhost email OTP: request a 6-digit code, copy it from
local MailHog, and verify it in the app. Sign-up sends
`AuthSignUpOptions(displayName:)`; both flows verify with
`verifySignInOTPEmail`. Sign out calls Nhost Auth when a refresh token exists and
then always clears the SDK's local session store so the app returns to signed-out
UI even if the remote sign-out request fails.

Profile email change uses PKCE on the app side. `ChangeEmailModel` generates a
PKCE verifier/challenge, stores the verifier in Keychain via
`KeychainPKCEVerifierStore`, requests `changeUserEmail` with
`redirectTo = "neogym://verify"`, and handles callbacks from `NeoGymApp`'s
`.onOpenURL` path. A successful `neogym://verify?code=...` callback exchanges
the code with the saved verifier, clears the verifier, and applies the returned
session; error or malformed callbacks surface feedback and also clear stale
verifier state. The backend must allow this native callback by keeping
`neogym://verify` in `auth.redirections.allowedUrls` in both
`backend/nhost/nhost.toml` and the production overlay. Restart the local Nhost
stack after redirect config edits; the CLI does not hot-reload `nhost.toml`.

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

Manual local email-change check:

1. From the repository root, run
   `make -C backend dev-env-down && make -C backend dev-env-up` after redirect
   config changes so local Auth loads the allowlist.
2. Build/run the iOS app in a simulator and sign in as an existing user.
3. Open **Change email** on the profile screen, enter a different email address,
   and submit the request.
4. Open MailHog, open the verification link on the simulator, and confirm iOS
   routes the callback into the app as `neogym://verify?code=...`.
5. Confirm token exchange succeeds, the saved verifier is cleared, and the
   profile shows the updated email.

Hand-crafted callback smoke check, when a simulator is available:

```sh
xcrun simctl openurl booted 'neogym://verify?code=fake'
```

With no matching saved verifier this should drive the app's callback path to the
"saved verification state is missing" error and clear any stale verifier.
