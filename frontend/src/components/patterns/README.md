# App pattern components

`src/components/patterns/` is the app-specific product pattern layer between low-level UI primitives and domain components/routes.

- `src/components/ui/` stays generic shadcn-style UI: buttons, cards, dialogs, inputs, skeletons, and other reusable building blocks with no NeoGym product semantics.
- `src/components/patterns/` holds narrow NeoGym presentation patterns: page shells, page headers, query empty/error/loading states, form sections/actions, confirm dialogs, pickers, ordered-row chrome, and similar shared interaction contracts.
- Domain components and routes keep domain behavior: GraphQL documents, mutations, validation, permissions assumptions, session strength/cardio branching, nutrition snapshot/log semantics, body charts, and route navigation.

Prefer small pattern components with children/render slots over a generic CRUD framework. A pattern should make repeated chrome consistent without hiding the domain-specific data flow that makes each surface correct.

Shared patterns at a glance: `page-shell.tsx` (`PageShell`, `PageHeader`, `ActionLabel`), `form-page.tsx` (`FormPage` with `layout`/`width`/`aside`, `FormPageAside`, `DangerZone`), `form-actions.tsx` (`FormActions`, `FormSection` with `card`), `query-states.tsx` (`EmptyState`, `ErrorState` with `onRetry`, `SkeletonState`), `confirm-action-dialog.tsx` (alert dialog for destructive confirmations), `segmented.tsx` (radio-group segmented control), `metrics.tsx` (`SectionCard`, `StatTile`, `MeterBar` with macro tones, `RingMeter`), `tag.tsx` (`Tag`, `KindTag`), `filter-chip.tsx` (`FilterChip`, `ActiveFilterChip`), `list-footer.tsx` (`ListFooter`), and `number-stepper.tsx`.
