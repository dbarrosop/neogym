# Toggle nutrition chart series and green weight average

**Status:** ready
**Created:** 2026-07-11

---

## 1. Requirements

Captured from the user's request: in the Nutrition Overview, make the 7-day average weight series green and allow chart series to be toggled on/off by tapping them.

### 1.1 Problem / motivation

The native iOS Nutrition Overview Body composition chart currently renders the `7-day avg weight` rolling series in blue and chart series are always visible. Users need the rolling weight average to stand out as green and need an easy way to hide/show chart series without losing the current period controls or point-callout interaction.

### 1.2 Functional requirements

- Change the Nutrition Overview Body composition `TimeSeriesChartSeries` with `id: "weight-rolling"` / name `7-day avg weight` from blue to green.
- Add reusable series visibility toggling to the shared time-series chart, using the legend as the primary tap target.
- Hidden series must not render, affect axes/ranges/date extent, participate in nearest-point selection, or be included as visible in default accessibility summaries.
- Hidden legend items must remain visible/tappable so users can restore a series.
- Preserve `TimeSeriesTrendChartView` period/custom-date filtering and existing plot tap/drag callouts.
- Prevent hiding the last visible non-empty series and include an effective-visibility fallback so the empty state represents genuine no-data, not user-hidden data.

### 1.3 Non-functional requirements / constraints

- Native iOS SwiftUI only; no backend, schema, metadata, GraphQL, codegen, HealthKit, or navigation changes.
- Keep implementation small, idiomatic SwiftUI, and reusable across all `TimeSeriesChartView` call sites.
- Keep SwiftUI/UIKit out of `ios/NeoGym/Sources/NeoGymKit`.
- Preserve or improve chart accessibility: the plot remains a summarized accessibility element while legend rows become separate accessible controls.
- Series visibility is in-view state only; it is not persisted across view recreation or app launches.

### 1.4 Surfaces in scope

- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — recolor the `weight-rolling` Body composition series.
- `ios/NeoGym/App/Components/TimeSeriesChartView.swift` — own visibility state, render tappable legend controls, and derive rendering/selection/axis/accessibility from effective visible series.
- `ios/NeoGym/App/Components/TimeSeriesTrendChartView.swift` — keep period filtering intact and ensure default accessibility summary reflects effective visible series.
- `ios/NeoGym/Sources/NeoGymKit/ChartSeriesVisibilityState.swift` — new pure testable visibility helper.
- `ios/NeoGym/Tests/NeoGymKitTests/ChartSeriesVisibilityStateTests.swift` — unit tests for pure visibility behavior.
- `ios/NeoGym/CLAUDE.md` — update chart/accessibility guidance for tappable legends.

### 1.5 Out of scope

- Backend/schema/metadata/codegen changes.
- Redesigning Nutrition Overview beyond chart color and series visibility toggling.
- Tapping plotted lines/points to toggle series; this is deferred to preserve the current full-plot selection gesture.
- Persisting hidden/visible series preferences across view recreation or app launches.
- New app-level UI/snapshot test infrastructure.

### 1.6 Success criteria

- Body composition `7-day avg weight` line and legend swatch are green.
- Tapping legend items toggles the corresponding series on/off across shared chart call sites.
- Hidden series are excluded from render, axes/ranges/date extent, selected-point lookup, and the default accessibility summary.
- The last visible non-empty series cannot be hidden; the no-data empty state appears only when the filtered period has no candidate points.
- Period controls and tap/drag point callouts continue to work.
- `swift build`, `swift test`, and the simulator app build pass, or any environment-specific failure is documented.

---

## 2. Implementation strategy

### 2.1 Central design decision

Keep period filtering in `TimeSeriesTrendChartView`, and add in-view series visibility state to the reusable `TimeSeriesChartView` keyed by stable `TimeSeriesChartSeries.id` values. The legend is the toggle surface because the plot area already uses a full-surface drag/tap gesture for nearest-point callouts. Use a small pure `NeoGymKit` helper for candidate/effective visibility logic so the last-visible guard and fallback are covered by SwiftPM tests while SwiftUI rendering remains in the app target.

### 2.2 Key constraints and invariants

- `candidateSeries` means non-empty series in the already-filtered period; it drives legend rows.
- `effectiveVisibleSeries` means candidates after applying visibility helper fallback; it drives rendering, axes/ranges, x-axis labels, nearest-point lookup, and default chart accessibility summaries.
- Legend visual state and accessibility state must use effective visibility, not raw hidden IDs, so fallback-rendered series are not announced as hidden.
- Clear `selectedPoint` on every visibility toggle and when visible point identity changes due to period/data updates.
- `visibleSeries` or equivalent helper used by cross-file accessibility code must be accessible from its extension location; either keep it internal/default-access or move the accessibility extension into `TimeSeriesChartView.swift`.
- If the first visible series on an axis changes (for example hiding `weight` so green `weight-rolling` is first on the left axis), axis label color changing to that visible series color is expected.
- Hidden IDs may persist across period switches; if a hidden series is the only candidate in a narrower period, fallback shows it there, and it can be hidden again when other candidates return.

### 2.3 Touched surfaces

- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — one-line color change from `.blue` to `.green` for `weight-rolling`.
- `ios/NeoGym/App/Components/TimeSeriesChartView.swift` — visibility state, candidate/effective series derivation, tappable/wrapping legend, accessibility restructuring, stale-selection clearing.
- `ios/NeoGym/App/Components/TimeSeriesTrendChartView.swift` — adjust or relocate default accessibility summary so it summarizes effective visible series.
- `ios/NeoGym/Sources/NeoGymKit/ChartSeriesVisibilityState.swift` — pure helper with no SwiftUI/UIKit import.
- `ios/NeoGym/Tests/NeoGymKitTests/ChartSeriesVisibilityStateTests.swift` — unit tests.
- `ios/NeoGym/CLAUDE.md` — chart guidance update.

### 2.4 Compatibility, deployment, and rollback notes

- **Compatibility:** No schema/API/config changes. Existing chart callers automatically inherit legend toggling because they use the shared `TimeSeriesTrendChartView` / `TimeSeriesChartView` path.
- **Deployment:** Standard iOS app/package build. Adding a SwiftPM package source under `Sources/NeoGymKit` does not require XcodeGen; app SwiftUI changes should still be validated with the simulator `xcodebuild` gate.
- **Rollback:** Standard revert is sufficient; all changes are app/package source and docs only.

---

## 3. Phased plan of action

### Phase 1 — Add reusable chart series toggles

**Goal:** Recolor rolling weight average to green and add accessible legend-based series toggling to shared native iOS charts.

**Depends on:** none

**Routed implementer:** `nhost-implementer`

**Routed reviewer:** `nhost-reviewer`

**Scope / files:**

- `ios/NeoGym/Sources/NeoGymKit/ChartSeriesVisibilityState.swift` — new pure state helper.
- `ios/NeoGym/Tests/NeoGymKitTests/ChartSeriesVisibilityStateTests.swift` — new pure helper tests.
- `ios/NeoGym/App/Components/TimeSeriesChartView.swift` — chart state/render/accessibility/legend changes.
- `ios/NeoGym/App/Components/TimeSeriesTrendChartView.swift` — default accessibility summary update or extension relocation.
- `ios/NeoGym/App/Nutrition/NutritionOverviewViews.swift` — `weight-rolling` color change.
- `ios/NeoGym/CLAUDE.md` — chart/accessibility guidance update.

**Implementation steps:**

1. Add `ChartSeriesVisibilityState` to `NeoGymKit` with hidden IDs, `isVisible(_:)`, `visibleIDs(among:)`, and `toggle(_:among:)`.
   - `visibleIDs(among:)` preserves input order.
   - `toggle` un-hides hidden IDs and refuses to hide the last effectively visible candidate.
   - `visibleIDs(among:)` falls back to all candidates if raw hidden state would hide every candidate.
2. Add unit tests for default all-visible state, hide/unhide, last-visible guard, all-hidden fallback, order preservation, and behavior when the candidate set changes.
3. In `TimeSeriesChartView`, add `NeoGymKit` import and visibility state; derive `candidateSeries` from non-empty input series and derive `effectiveVisibleSeries` from the helper.
4. Repoint all chart semantics except legend rows to effective visible series: `allPoints`, plotted series, axes, `normalizedPoints` date/value domains, `plottedPoints(size:)`, nearest-point lookup, x-axis labels, and default accessibility summaries.
5. Convert legend rows to `Button`s rendered from candidates, using effective visibility for dimming/accessibility selected state. Use wrapping/adaptive or horizontally scrollable layout so tappable rows do not clip on narrow screens or shrink the fixed-height plot unacceptably.
6. Clear `selectedPoint` unconditionally on every visibility toggle, and also clear it when visible point IDs/candidate IDs change due to period or data updates.
7. Move or restructure accessibility so the plot is one summarized accessibility element and the legend remains a separate container of reachable buttons. If a caller provides a custom `accessibilityValue`, document that it is caller-owned text and will not automatically reflect hidden series.
8. Change `NutritionOverviewView.bodySeries` `weight-rolling` color from `.blue` to `.green`.
9. Update `ios/NeoGym/CLAUDE.md` “Graphs and summaries” wording to say chart plots/axes/markers/callouts are summarized as one plot element while legends are tappable controls.
10. Validate with package and app build commands.

**Tests and checks:**

- `swift build` from `ios/NeoGym/` — validates `NeoGymKit`, including the new pure helper, without SwiftUI/UIKit leakage.
- `swift test` from `ios/NeoGym/` — validates the new helper tests plus existing package tests.
- `nix develop ../.. --command xcodegen generate` from `ios/NeoGym/` if project generation is needed/stale.
- `xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination 'generic/platform=iOS Simulator' build` from `ios/NeoGym/` — validates SwiftUI app changes.
- Manual simulator/VoiceOver verification: green rolling weight line, legend toggles, hidden series exclusion from visible behavior, last-visible guard, period controls, and plot callouts.

**Definition of done:**

- Unit-tested: pure visibility helper preserves order, hides/restores IDs, refuses last-visible hides, and falls back when the candidate set would otherwise all be hidden.
- Build-verified: SwiftPM build/test and simulator app build pass, or environment failures are recorded with exact output.
- Manually verifiable: `weight-rolling` renders green; legend buttons toggle series; hidden series are absent from render/axes/ranges/selection/default summary; last visible series stays visible; period controls and callouts still work.
- System remains fully functional because no backend/data contracts change and all chart callers use the shared component.

**Phase commit message:** `feat(ios): add toggleable chart series legends`

**Implementation log**

- Implemented reusable chart series visibility through a pure `NeoGymKit`
  `ChartSeriesVisibilityState` helper plus unit tests, and wired
  `TimeSeriesChartView` to derive candidates, effective visible series, legend
  controls, axes, point selection, and default summaries from that state.
- Recolored Nutrition Overview `weight-rolling` from `.blue` to `.green`, split
  chart model/support types into `TimeSeriesChartModels.swift`, and updated
  `ios/NeoGym/CLAUDE.md` to document tappable chart legends and caller-owned
  custom accessibility values.
- Reviewer verdict: `ACCEPT`. The reviewer verified the phase diff against the
  plan, ran `swift test`, `xcodegen generate`, and the simulator `xcodebuild`
  gate, and reported no blocking concerns. The review subagent wrapper marked
  the run failed only because its structured acceptance-report trailer was
  missing; the textual review verdict was accepted as sufficient for this phase.
- Autonomous decisions / assumptions:
  - Used the autonomous all-remaining-phases default; this plan has one phase.
    Pillar: correctness and long-term maintenance, because it matches the
    user's request to implement all phases autonomously.
  - Treated the extracted `TimeSeriesChartModels.swift` app file as in-scope.
    Pillar: long-term maintenance, because it keeps the chart view small while
    preserving the same app-target model semantics.
  - Removed the untracked `inline` file generated by subagent output capture and
    did not commit it. Pillar: correctness, because it was unrelated
    orchestration output rather than phase implementation.
  - Used a clean Xcode environment (`DEVELOPER_DIR=/Applications/Xcode.app/...`
    with Nix toolchain variables cleared) for Swift/Xcode gates after the
    inherited Nix shell made plain `swift build` unable to find a usable SDK.
    Pillar: correctness, following `ios/NeoGym/CLAUDE.md` guidance for this
    known environment mismatch.
  - Manual simulator and VoiceOver interaction checks were not performed in this
    non-interactive run. Pillar: long-term maintenance, recorded as an accepted
    validation limitation because `swift test` and simulator build passed and
    the reviewer inspected the SwiftUI behavior paths.
- Quality gate history:
  - `swift build` from the inherited Nix shell failed due SDK/compiler mismatch.
  - `env DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer ... xcrun
    swift build` from `ios/NeoGym/` passed.
  - `env DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer ... xcrun
    swift test` from `ios/NeoGym/` passed, including 7 new
    `ChartSeriesVisibilityStateTests`.
  - `nix develop ../.. --command ... xcodegen generate` from `ios/NeoGym/`
    passed.
  - `env DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer ...
    xcodebuild -project NeoGym.xcodeproj -scheme NeoGym -destination
    'generic/platform=iOS Simulator' build` passed with only the existing
    `UIRequiresFullScreen` deprecation warning.
  - `git diff --check` passed.
  - `lens_diagnostics mode=all` reported Markdown line-length warnings in the
    plan/audit artifacts only; no blocking Swift diagnostics were reported.

---

## 4. Implementation execution protocol

Use this loop for each phase, starting with the first unimplemented phase:

1. **Implement:** Ask the routed implementer to implement only the current phase while keeping the full plan in mind. Use `subagent` with `agentScope: "both"`, `model: "gpt-5.5"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the implementer listed for the phase. The prompt must include the full plan, the current phase, and the requirement that tests be written or updated for the implementation.
2. **Review:** Ask the routed reviewer to review the implementation. Use `subagent` with `agentScope: "both"`, `model: "claude-opus-4-8"`, `context: "fresh"`, inline `output`, no `acceptance` gate, no `worktree`, and the reviewer listed for the phase. The reviewer must inspect the actual diff, verify consistency with the full plan and surrounding phases, and run the tests/checks written by the implementer when practical.
3. **Improve:** If the reviewer provides feedback, ask the implementer to address it. Keep the feedback scoped to the current phase unless fixing it safely requires adjusting the plan.
4. **Repeat:** Continue review/improve cycles until the reviewer accepts the phase or no blocking concerns remain. If the loop stalls or the reviewer raises a plan-level issue, stop and ask the user before proceeding.
5. **Commit:** Commit all changes made during the phase with the phase commit message, after the relevant checks pass or any skipped checks are explicitly justified.
6. **Continue:** Move to the next phase and repeat until all phases are complete.

Language routing:

| Phase files | Implementer | Reviewer |
| --- | --- | --- |
| Swift/Markdown under `ios/NeoGym` | `nhost-implementer` | `nhost-reviewer` |

The unified agents infer Go, JS/TS, mixed, or generic guidance from the files in scope and load the matching repository rules before acting.

---

## 5. Validation matrix

| Requirement | Phase(s) | Validation |
| --- | --- | --- |
| `weight-rolling` is green | Phase 1 | Code review/manual simulator check; app build |
| Legend toggles chart series | Phase 1 | Manual simulator check; app build |
| Hidden series excluded from render/axes/range/selection/default summary | Phase 1 | Code review/manual simulator check; app build |
| Last visible series cannot be hidden; empty state is genuine no-data | Phase 1 | `ChartSeriesVisibilityStateTests`; manual simulator check |
| Period/custom filtering remains intact | Phase 1 | Manual simulator check; existing `TimeSeriesTrendChartView` period logic unchanged |
| Reusable across chart call sites | Phase 1 | Central implementation in `TimeSeriesChartView`; app build |
| Accessibility structure remains usable | Phase 1 | Code review/manual VoiceOver check; docs update |

---

## 6. Risks and mitigations

- **Risk:** Legend buttons are swallowed by the chart's existing `.accessibilityElement(children: .ignore)` modifier. — **Mitigation:** Move the summarized accessibility element to the plot only and keep legend as separate controls.
- **Risk:** Cross-file Swift access control breaks the default accessibility summary. — **Mitigation:** Keep effective visible-series helpers internal/default access or move the summary extension into `TimeSeriesChartView.swift`.
- **Risk:** Stale selected callout remains after series/period/data changes. — **Mitigation:** Clear `selectedPoint` on every toggle and when visible point identity changes.
- **Risk:** Larger tappable legend rows shrink or clip the fixed-height chart on narrow devices. — **Mitigation:** Use adaptive/wrapping or horizontal scrolling legend layout and validate app build/manual layout.
- **Risk:** Custom caller-provided `accessibilityValue` cannot automatically reflect hidden series. — **Mitigation:** Current call sites use the default; document caller ownership if custom values are used.

---

## 7. Follow-ups (out of scope for this plan)

- Add plot-line/point tap toggling if users still need it after legend toggles — tracked in: TBD.
- Persist chart visibility preferences across app launches — tracked in: TBD.
- Add app-level SwiftUI/snapshot/UI tests for chart rendering and VoiceOver behavior — tracked in: TBD.
