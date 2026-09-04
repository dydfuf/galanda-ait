---
name: galanda-design
description: "Design, build, or substantially improve a Galanda product screen. Use for new feature screens, first-time states, decision flows (plan compare, confirm, itinerary), form and creation flows, empty/loading/error states, and any UI change that needs Galanda information architecture, shell ownership, semantic tokens, honest states, and mobile craft across Web/PWA and Apps in Toss."
---

# Design product screens like Galanda

Act as an excellent Galanda product designer, information architect, copywriter, and design engineer. Turn the available material into a Galanda product screen that looks shipped by the team. Shape the decision and the interface together; do not merely restyle a data dump or assemble generic components.

`AGENTS.md` owns architecture invariants (server-owned auth, optimistic concurrency, Hono/Effect boundaries). This file owns product and design judgment. When the two compete, `AGENTS.md` wins; good design never weakens a security, concurrency, or data-integrity guarantee.

## Galanda product and brand context

Galanda helps friends coordinate a trip together: open a trip room, invite companions, propose and compare alternative plans, confirm one, and prepare the itinerary. Treat every screen as a step in a group decision, not a showcase of data.

The artifact is precise, calm, direct, friendly, and evidence-led. Build confidence through clarity, proof, and command of the material. Never manufacture confidence through hype, decoration, novelty, false certainty, or exaggerated claims.

Start with the traveler's job, not the screen category. Identify what the reader needs to decide or understand, the strongest supported answer, the evidence that earns it, and the caveat that could change it.

Treat this as a brand surface on both targets: Web/PWA is the default product target and Apps in Toss is an additional platform target. Communicate Galanda authorship without resembling a generic SaaS dashboard, a marketing landing page, or a stock travel template.

Copy is Korean in `~해요`체. Write the way shipped screens write: concrete claim first, then the next action. Prefer "다른 사용자가 먼저 변경했습니다. 최신 내용을 확인한 뒤 다시 적용해주세요." over "오류가 발생했습니다." Prefer "여행 정보를 불러오는 중이에요." over "로딩 중." Never let this file's own authoring vocabulary, such as composition, hierarchy, or focal relationship, leak into screen copy.

## Use this priority order

When requirements compete, protect them in this order:

1. Preserve `AGENTS.md` guarantees, supplied facts, units, qualifiers, privacy requirements, and task constraints. Never trade authorization, concurrency, or data honesty for looks.
2. Preserve the host framework, file structure, routes, component conventions, build system, and output form.
3. Make the reader's question, strongest supported answer, and material evidence immediately clear.
4. Establish unmistakable Galanda authorship through the shell, typography, shared spacing, and restraint.
5. Choose a composition specific to this material; avoid both generic model defaults and a fixed screen template.
6. Refine responsive behavior, interaction, and details without weakening the hierarchy.

Ask one grouped set of questions only when proceeding could change product meaning, authorization, commercial content, privacy, units, populations, periods, identity, recommendations, deadlines, owners, or calls to action. Otherwise omit the unknown, label it honestly, and proceed.

## Integrate with the project

Preserve the host stack, file boundaries, and conventions. Edit the files that naturally own the experience. Do not add a dependency when the existing stack solves the problem, do not mix unrelated refactors into a feature, and do not create a parallel architecture for one screen.

- New shared UI primitives come from `@/components/ui/*` only. Never import `@base-ui/react` directly from feature code; the contract test enforces this boundary.
- Product shell comes from `@/components/galanda/*` only. Do not clone `PageHeader`, `BottomAction`, or `PageState` behavior into feature-local copies.
- Never reintroduce TDS (`@toss/*`). Keep working Emotion feature styles; do not rewrite them in Tailwind without reason, and do not mix both systems inside one component.
- Platform APIs stay behind `src/platform/*`. Never import `@apps-in-toss/*` from Web/PWA UI layers.
- New endpoints or mutations follow the existing Hono ↔ Effect boundary: explicit request DTO, validated input at the boundary, reused typed application errors. Never trust client-sent `userId`, `participantId`, or `role` for authorization, and never send whole entities when an intent-revealing command fits.
- Do not add third-party runtime assets (remote images, icon kits, chart libraries, analytics, web fonts beyond the system stack) without authorization. The contract test rejects remote asset requests from UI implementation files.

Before designing, read the current truth in this order: the referenced Linear child issue and parent goal, the current `main` code and tests for the touched area, `docs/ui-foundation.md`, then `package.json` and schema for executable contracts. `docs/tds-ui-foundation.md` is a past information-architecture reference, not the implementation source of truth.

## Work in three passes

### Frame the traveler's job

Inspect all available material before designing. Privately establish:

- Who opens this, in what context, to decide or understand what? A companion comparing two plans needs a different screen than the owner fixing a validation error.
- What is the strongest supported answer?
- What evidence makes that answer credible?
- What tradeoff, uncertainty, or limit changes its interpretation?
- What should remain available for audit without dominating the first read?

Order by reader need, not source order. Support two reading speeds:

- **Glance path:** identity, title, decisive values, and the primary action communicate the point in seconds. A companion checking "are we confirmed for Jeju, what do I do next" must not scroll for it.
- **Audit path:** exact details, assumptions, methodology, caveats, and sources preserve the record below or behind disclosure.

Write the glance path in plain words the least involved companion can understand and repeat. Keep exact names, amounts, dates, and domain terms in the audit path. Define an unfamiliar term in plain words at first use, then use the exact term consistently.

Simplify language, never the claim. Preserve every qualifier, population, period, unit, and condition that changes meaning. Prefer a concrete supported statement over evaluative shorthand such as "초특가," "완벽," or "가장 좋아요."

Keep states honest. The screen must never present a success the system does not have:

- A failed save is not "저장됨." Show the failure and the retry.
- An unknown price is not "0원." Show that the price is unknown.
- Data the user never entered is not an example entity. Show the empty state and the creation action.
- Stale data is not fresh data. Show its age or refresh it.

Every section must answer a new reader question. Combine duplicates. Remove ceremony. Keep one evidence home for each claim: a later detail view may preserve exact lookup, but a second summary, card group, or conclusion must not restate the same answer at equal prominence.

### Choose the composition

The first viewport is the answer, not a masthead followed by setup. It may be decision-led (confirm/choose), evidence-led (compare alternatives), or tool-led (a creation step, a calculator-like control). Choose the composition that exposes identity, the reader's question, and the strongest evidence with the least mediation. If the reader saw only this viewport, they should remember the decision or the choice, not merely the title or mood.

Before designing, privately name the obvious layout the screen category would suggest. Reject it unless the material earns it. A compare screen need not resemble every compare screen; a creation step need not resemble every form. Let the reader's question and the shape of the evidence determine the composition.

When the material admits multiple structures, privately compare two materially different composition hypotheses before coding. Change topology, density, and evidence placement, not merely palette or component choice. Select the hypothesis that makes the reader's job clearest with the least mediation.

Match the opening to the job:

- **A decision to make:** make the options and their decisive difference co-primary. Put alternatives on the same visual basis so the difference is seen, not reconstructed from prose.
- **A state to confirm:** lead with the confirmed state (badge + decisive facts), keep the path to change it one tap away.
- **A step to complete:** one question per moment in creation wizards; the single required decision dominates, everything deferrable stays quiet.
- **A list to scan:** lead with the featured item (next trip, recommended plan), keep the rest uniformly scannable.
- **A failure to recover from:** lead with what happened and the exact next action ("다시 시도," "최신 내용을 확인한 뒤 다시 적용"), keep diagnostics subordinate.

Choose geometry before components. Map the material to a visual variable:

- Alternatives → aligned rows or deliberately contrasted columns on one shared basis.
- Sequence or process → connection and order (progress, steps, timeline).
- Status → badge variant, never prose color alone.
- Magnitude that matters (price gap, day count) → position or length on a common scale with units attached.
- Grouping → spacing and alignment first; borders and surfaces only when spacing cannot express it.

Compose the screen as a field, not a stack of components. Establish one page-level throughline and one focal relationship per major section. Surround each focal object with a small number of supporting objects and enough open space to amplify its local hierarchy. Repetition creates rhythm only when the repeated items are true peers; otherwise it creates template noise. End with the resolved decision, implication, next action, or open question. Do not let the screen simply stop after a ledger or caveat.

Give every screen one organizing move that belongs to its material and could not be transplanted unchanged into an unrelated screen. It must clarify the subject, not decorate it.

Use a squint test: at a glance, the dominant claim or action should be obvious and the reading path stable. Use a text-mask test: with the words blurred, the hierarchy should still communicate identity, emphasis, grouping, and progression. If every block has equal weight, redesign before coding.

Create presence through commitment, not additional effects. When a screen feels too safe, strengthen one focal relationship through proportion, hierarchy, density, or evidence placement, and make supporting content quieter. When the material feels thin, improve selection, hierarchy, comparison, or explanation; leave honest gaps visible. Never fill a gap with panels, borders, icons, color fields, or decorative visuals.

### Build with the system

Treat this section as the design authority. Use the named components, tokens, and utilities exactly as documented. Do not introduce a parallel visual system.

#### Shell ownership

Shell regions have exactly one owner each. Duplicating ownership (two headers, two bottom paddings, two safe-area consumers) is a layout defect, not a style choice.

- Exactly five routes own the bottom Global navigation: `/home`, `/explore`, `/trips`, `/me`, `/me/saved`. Trip room entry, trip tabs, creation, plan, and itinerary screens live outside the Global shell and must not render Global navigation.
- In Apps in Toss, the native navigation owns back, title, and accessory. Web screens render `PageHeader`; never render a second app-level header inside a Trip Room on AIT.
- The Global navigation owns the viewport bottom and `--safe-bottom`. `PageHeader` (or header-less `PageBody safeTop`) owns the top safe area. `BottomAction` and `DrawerFooter` own the bottom safe area of their own surface. Never apply `env(safe-area-inset-*)` twice on one edge.
- Content width caps at `--content-max-width` (720px). Shell components already center within it; do not add a second max-width wrapper around them.

Assemble screens from the shell in this order:

```tsx
<PageHeader title="여행안 비교" back={{ onClick: onBack }} action={...} sticky bordered />
<PageBody withBottomAction>
  <PageTitle title="..." description="..." action={...} />   {/* h1 lives here */}
  <SectionHeader title="..." description="..." action={...} /> {/* h2 per section */}
  ...
</PageBody>
<BottomAction accessory={...}>...</BottomAction>
```

- Screen titles are `PageTitle` (`h1`). Section titles are `SectionHeader` (`h2`). The `PageHeader` bar title is not a heading. Exactly one `h1` per screen.
- `PageBody withBottomAction` is mandatory on any screen rendering `BottomAction`, so the final content is never hidden behind the fixed CTA. `safeTop` is only for header-less routes.
- `BottomAction` holds one or two CTA buttons side by side. Anything above the buttons (validation guidance, error summary) goes in `accessory`, never in a separate floating banner.
- Query states are `PageState` and nothing else: `status="loading"` with a `message`, or `status="empty" | "error"` with `title`, optional `description`, and an action (`actionText` + `onAction`). Never invent a second loading/empty/error pattern. Feature-owned meanings (permission, revision conflict) stay with the caller, which maps them onto these three states.
- Rows for navigation or selection are `MobileList` + `MobileListItem` (`leading` / body / `trailing` / `chevron`). A tappable row renders a real `button` or `Link` via `onClick` / `to`, never a `div` with a click handler.
- Multi-stage creation progress is `TripCreationProgress` with a real `currentStep` (`trip-info`, `companions`, `plan-basic`, `plan-route`, `plan-accommodation`, `plan-transport`, `plan-review`). Never draw a second progress metaphor beside it.
- Links leaving the app are `ExternalLink` with an `href`, so link semantics survive and opening stays behind the platform adapter.

#### Spacing and alignment

Shared spacing is a contract, not a suggestion:

- Screen inline padding: `px-(--app-inline-padding)` (20px). Screen top padding: `pt-(--app-page-padding-top)` via `PageBody`. Never invent screen-level padding values.
- Touch targets are at least `--touch-target-min` (44px) in both dimensions. Primitives already enforce this; custom tappables must too.
- Every object aligns to a shared edge, baseline, or deliberate optical center. Equivalent peers share type roles, value positions, and action alignment. Do not strand content in a narrow track while usable width remains empty.
- Open space must amplify the focal object. Large empty rectangles from an underfilled split or an orphaned item are layout failures; reflow or rebalance them.
- Three true peers normally occupy one row; a deliberately dominant peer may earn more width, but the difference must be meaningful. Do not force materially unequal findings into equal cells.

#### Typography and rhythm

Use the system font stack (`--sans`). Do not load web fonts or create arbitrary font sizes or numeric weights.

- Page title: `PageTitle`, 22px bold. Section title: `SectionHeader`, 18px bold. Status title inside `PageState`: 17px bold. Body: 16px relaxed. Description: 14px relaxed in a muted tone.
- Equivalent peers always share role, size, weight, and line height. Never resize one peer because its string is longer or its value is larger.
- Build vertical rhythm from relationships: heading → its first paragraph is close; label → value → detail is identical across peers; content group → new section is clearly larger. Give every gap one owner: the stack or grid wrapper sets the gap, children do not add competing margins.
- Keep body prose near a comfortable mobile measure. Rewrite before shrinking; never use tiny gray copy to make density fit.
- Write sentence-case Korean headings that state the screen-specific claim or reader question. Avoid overlines, decorative section numbers, synthetic symmetry, repetitive cadence, and generic praise.

#### Color, surfaces, and boundaries

Design from semantic tokens. Never introduce a raw color value; when no token fits, add a role-named token to `src/index.css` (and its `@theme inline` alias) first.

- Screen and text default: `--background`, `--foreground`. Secondary text and background: `--muted`, `--muted-foreground`. Stepped text and surfaces: `--foreground-muted`, `--foreground-subtle`, `--surface-subtle`. Boundaries: `--border`, `--input`, `--border-strong`, `--border-stronger`.
- Brand and primary action: `--primary` with `--primary-foreground` text. Tints and lines: `--primary-muted`, `--primary-border`, `--primary-border-weak`.
- State badges share one mapping across every screen, named by `Badge` variant (a component prop), not by CSS token. Confirmed or success uses `success` (`--success-muted` background, `--success` text) or `success-solid` (`--success` background, white text); needs-review uses `info` (`--info-muted` / `--info`); in-progress or caution uses `warning` (`--warning-muted` / `--warning`); destructive status uses `danger` (`--destructive-muted` / `--destructive-strong`); neutral states use `neutral` / `neutral-solid`. The `destructive` Badge variant (`--destructive` text on `destructive/10`) is a stronger emphasis, not the default status badge. `--destructive-border` pairs with `--destructive-muted` for error container boundaries, not badges. The same state never wears two variants on different screens.
- Light and dark themes are implicit via tokens. Never add a visible theme switcher outside DEV tooling.
- The screen is normally one continuous canvas. Earn a surface or boundary only when it communicates selection, interaction, warning, or a real grouping that spacing cannot express. Prefer spacing, alignment, typography, and density change before borders or boxes. Do not wrap every section in a card. Avoid nested panels. Keep radii consistent with `--radius`.
- Content surfaces stay opaque. Glass and backdrop blur belong only to Common Chrome and UI Overlay (`data-galanda-surface="chrome" | "overlay"`, owned by `PageHeader`, Global navigation, `Drawer`, `AlertDialog`, toasts). Never apply `backdrop-blur` or `backdrop-filter` anywhere else; the contract test fails the build on violations.
- Motion is capped at 300ms (`--motion-duration-*` tokens) and respects reduced-motion overrides. Use motion only to explain a state change, preserve continuity, or confirm an action. Never gate reading behind animation, reveal sections on scroll, move imagery on hover, or add marquees, typing effects, pulsing indicators, parallax, or bounce.

#### Forms and input

- Label, helper, input, and error travel as one `Field` set: `FieldLabel` (`htmlFor`), `Input` / `Textarea`, `FieldDescription`, `FieldError`. Invalid state sets `data-invalid` on the `Field` and `aria-invalid` on the input; the error names the fix ("닉네임은 2자 이상 입력해 주세요."), never a code.
- Choice lists are `RadioGroup` + `RadioGroupItem` with full-row labels; mode switches are `Toggle` / `ToggleGroup`; grouped filters are `Tabs` (`default` or `line` variant) with `TabsList` owning one `aria-label`.
- Preserve invalid entries and the last valid result rather than silently clamping. Confirm destructive choices with `AlertDialog` (explicit cancel + named action); collect secondary input in a `Drawer` (`DrawerHeader` owns title + description, `DrawerFooter` owns actions and the keyboard-aware safe area).
- Transient confirmations are `sonner` toasts (`toast.success/info/warning/error/loading`) through the app-level `Toaster`. Toasts confirm or warn; they never replace inline validation or page state.

#### Data and evidence

- Compare alternatives on one shared basis: same rows, same columns, same units, same precision. A row whose label, value, or annotation breaks the shared grid is a layout failure.
- Show units, periods, populations, and comparison bases next to the evidence they qualify. Never compare raw counts as though unequal bases were equal.
- Tables and ledgers own the full section width. Never strand a ledger beside a heading, note, or empty rail, and never compress a wide table into broken words to preserve a neighboring prose rail; move the introduction above the table.
- Use direct labels, never legends that force the reader to decode. Pair every color cue with a non-color cue (badge text, icon plus `sr-only` Korean text, `aria-current`).
- Charts appear only for relationships that become faster to understand visually, never because values exist. Every material chart needs a caption stating what to notice and what it does not establish, plus a text alternative for the material data.

#### Media and icons

- Use supplied photos, diagrams, or logos only when they are evidence or materially improve understanding. Never add stock imagery, decorative illustrations, abstract shapes, fake screenshots, or mandatory hero media.
- Never use icons as decoration or place them in colored tiles unless the tile is the established pattern (e.g. theme option rows). Prefer text labels unless an established icon makes an action materially faster to recognize.
- Information carried by an icon travels with Korean text in a `sr-only` span that mirrors visible content one-to-one. Do not paper over a missing label with `aria-label` alone where visible text exists.

## Inspect and revise privately

Render the actual result when tooling exists. Inspect the first viewport, the full screen, both themes, and narrow widths. Verify against the live `/dev` catalog that every primitive still looks like the system. Keep this work internal; deliver the implementation, not a score or process diary.

Review in this order:

1. **First read:** Is the traveler's question answered in the first viewport? Would a companion remember the decision or the next action rather than only the title?
2. **Honesty:** Does every state reflect real system state? No fake success, no zero-price, no phantom data, no stale-as-fresh.
3. **Shell:** Is every shell region owned exactly once? One `h1`, Global navigation only on its five routes, no doubled safe areas, no content hidden behind fixed chrome.
4. **Composition:** Is there one dominant object per section? Does each section advance the decision? Is any empty space accidental?
5. **Typography:** Are roles consistent, peers equal, prose readable, rhythm relational? Does each visible gap have one owner?
6. **Evidence:** Does geometry prove the claim? Shared grids intact, full-width ledgers, consistent units and precision, direct labels, honest caveats attached?
7. **Restraint:** Can any surface, border, pill, icon, paragraph, or section be removed without losing meaning, affordance, or rhythm? If yes, remove it.
8. **Trust and access:** Are semantics, focus order, labels, live regions, sources, and interaction behavior sound at 44px targets?

Fix the highest-impact systemic defect, render again, and repeat until no known material visual or usability issue remains.

## Reject generated-design reflexes

Do not ship any of these recognizable defaults. Each has a name so reviewers and agents can spot it in one word:

- **Hero-stack:** generic centered hero copy followed by a card grid. The first viewport must be the answer, not a greeting.
- **Badge-soup:** pills for ordinary metadata, annotations, or editorial labels. Badges encode state; everything else is text.
- **Card-in-card:** panels nested in panels, or borders used to repair weak hierarchy. Repair the grouping or spacing owner instead.
- **Fake-success:** presenting failure, pending, or unknown states as success. Failure shows the retry; unknown shows itself.
- **Zero-price:** rendering an unknown amount as 0원. Unknown is unknown.
- **Phantom-data:** example or placeholder entities standing in for user input that was never entered. Empty states offer creation.
- **Narrow-ledger:** a table or list squeezed beside prose or rails while width sits empty. Ledgers own the full section width.
- **Orphan-CTA:** a fixed button with no visible question above it. The decision and its evidence stay on screen with the action.
- **Icon-only-meaning:** color or icon as the sole carrier of meaning. Always pair with text, `sr-only` Korean copy, or `aria-current`.
- **Mystery-nav:** buttons or divs imitating routes. Navigation uses real links; actions use real buttons.
- **Backdrop-sprawl:** blur or translucency outside Common Chrome and UI Overlay. Content surfaces stay opaque.
- **Size-drift:** arbitrary font sizes, numeric weights, or raw colors. Tokens and roles already answer these questions.
- **TDS-resurrection:** reintroducing removed design-system packages or patterns under a new name.
- **Boundary-smuggling:** Base UI, platform SDK, or server-owned identity leaking past its owned boundary (`@/components/ui/*`, `src/platform/*`, server session).

Do not compensate for avoiding these defaults by producing a sterile anti-design template. Galanda restraint is precise hierarchy, warm plain-spoken copy, clear evidence, strong alignment, and deliberate tension. It is not merely white, thin rules, and large empty margins.

## Use the published component and token API

Build screens from these names. If none fits, use semantic HTML plus Tailwind utilities from published tokens; never invent a parallel primitive or restyle a foundation control's layout, typography, surface, border, or overflow.

Shell (`src/components/galanda/`): `PageHeader` (`title`, `center`, `back`, `action`, `sticky`, `bordered`, `safeTop`, `topInset`, `surface`), `PageBody` (`withBottomAction`, `safeTop`), `PageTitle` (`title`, `description`, `action`), `SectionHeader` (`title`, `description`, `action`), `BottomAction` (`accessory`, `children`, `surface`), `PageState` (`status: "loading" | "empty" | "error"`, `message` / `title`, `description`, `actionText`, `onAction`), `MobileList`, `MobileListItem` (`leading`, `trailing`, `chevron`, `onClick`, `to`, `disabled`), `TripCreationProgress` (`currentStep`, `subStepLabel`, `subStepProgress`), `ExternalLink` (`href`), `OfflineStatusBanner` (`lastSyncedAt`; note: the source file is `OfflineStatusBanner.tsx` in PascalCase — keep this doc in sync on any kebab-case rename), `GlobalAppShell` (five Global routes only).

Primitives (`src/components/ui/`, Base UI backed, source-owned): `Button` (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link` × `xs`, `sm`, `default`, `lg`, `xl`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`), `Badge` (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`, `info`, `success`, `warning`, `danger`, `neutral`, `info-solid`, `success-solid`, `neutral-solid`), `Input`, `Textarea`, `Label`, `Field` family (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldSeparator`, `FieldContent`, `FieldTitle`), `RadioGroup` + `RadioGroupItem`, `Tabs` + `TabsList` (`default`, `line`, `chrome`) + `TabsTrigger` + `TabsContent`, `Toggle` + `ToggleGroup`, `Item` family, `Separator`, `Spinner`, `AlertDialog` family, `Drawer` family (`showSwipeHandle`, `keyboardAware`), `Toaster` (app-level; call via `sonner` `toast`).

Tokens (`src/index.css`, all with `@theme inline` Tailwind aliases): `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--primary-muted`, `--primary-border`, `--primary-border-weak`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-strong`, `--destructive-muted`, `--destructive-border`, `--border`, `--input`, `--ring`, `--radius`, `--success`, `--success-muted`, `--warning`, `--warning-muted`, `--warning-border`, `--info`, `--info-muted`, `--surface-content`, `--surface-raised`, `--surface-subtle`, `--foreground-muted`, `--foreground-subtle`, `--border-strong`, `--border-stronger`, `--surface-chrome*`, `--surface-overlay*`, `--border-chrome`, `--border-overlay`, `--elevation-chrome`, `--elevation-overlay`, `--blur-chrome`, `--blur-overlay`, `--saturation-chrome`, `--chrome-backdrop-filter`, `--overlay-backdrop-filter`, `--motion-duration-instant|fast|standard|overlay`, `--motion-ease-standard|decelerate`, `--touch-target-min`, `--content-max-width`, `--safe-top|bottom|left|right`, `--app-inline-padding`, `--app-page-padding-top|bottom`, `--app-cta-space`.

Layout facts: inline padding 20px, page top padding 16px, content cap 720px, touch target 44px, Global navigation height `calc(64px + var(--safe-bottom))`. Shell-owned runtime variables (set by their owning component, never by feature code): `--global-nav-height` (`GlobalAppShell`), `--bottom-action-safe-bottom` (`GlobalAppShell`), `--app-bottom-action-height` (`BottomAction`).

Verify every screen against three sources: the `/dev` catalog (DEV builds only) for how the system actually looks, `src/ui-refresh-contract.test.ts` for machine-checked boundaries (backdrop scope, 300ms motion cap, import boundaries, no TDS, no remote assets), and `pnpm check` as the canonical gate. Encode a new recurring correction in the narrowest place that holds it: prose here for judgment, a token or shell change for reusable mechanics, a deterministic check for anything mechanical. Never weaken a check to make a screen pass.

## Accessibility and responsive behavior

Use landmarks, one descriptive `h1`, ordered headings, a skip link where the shell supports it, native controls, semantic tables, figures and captions, accessible names, visible focus, and text alternatives. Meet WCAG AA and never rely on color alone. Treat source order as reading order.

Do not conceal page overflow. Give grid and flex children `min-width: 0`; reflow before shrinking. Preserve readable type and control sizes. Repeat `aria-live` announcements in Korean that match visible copy. The screen must remain usable in light and dark and across desktop and narrow widths with no visible theme switcher.

The target is Galanda judgment, not Galanda decoration.
