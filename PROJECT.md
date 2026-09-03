# Project: Granular Trip Creation Wizard (First Plan Single-Question Flow)

## Product Contract Status

- **Implementation delivery:** COMPLETE
- **Canonical product contract:** [`ADR-002-trip-creation-wizard-product-contract.md`](docs/adr/ADR-002-trip-creation-wizard-product-contract.md)
- **Product validation:** ONGOING during MVP/private beta
- **Superseded baseline:** the former 7-step section-based first-trip Wizard recorded by PR #90 / RAON-285

The current baseline is the shipped **4-stage creation shell + single-question first-plan sub-wizard**. Future simplification should be driven by completion, resume, validation/backtracking, abandonment, and qualitative mobile-usability evidence rather than raw screen count.

## Architecture
The Granular Trip Creation Wizard transforms the initial plan creation experience (`/trips/:tripRoomId/plans/new/*`) into a single-question-per-screen flow while preserving existing section-based editing for subsequent plan creation, edits, and clones.

```text
User Flow:
[1. 여행방 만들기 (/trips/new)]
       ↓ (replace navigation to establish history anchor at /trips/:id/plans)
[2. 동행자 초대 (/trips/:id/setup/companions)]
       ↓ (replace navigation)
[3. 첫 여행안 작성 (Sub-Wizard: /trips/:id/plans/new/:section?question=...&index=...)]
       ├── Basic Info (title → proposal-reason → headcount)
       ├── Route Stops (city → arrival-date → departure-date → add-city prompt)
       ├── Accommodations (status: decided/searching → hotel-name)
       └── Transports (endpoints → status: decided/not-checked → mode → duration)
       ↓ (replace navigation)
[4. 검토 및 등록 (/trips/:id/plans/new)]
       ├── Review Summary with "수정" jump-to-cursor links
       └── "여행안 제안 등록" (or "대안 여행안 제안하기" if concurrent plan published)
```

Key Architectural Invariants:
1. **Zero Server / DB Schema Changes**: Pure client-side state machine using existing Hono / Effect / Drizzle persistence contracts.
2. **Deterministic URL Cursor Model**: URL query parameters (`?question=...&index=...`) track sub-question progress with `replace` navigation, preserving browser and AIT back navigation anchors to the Trip Room.
3. **Local Draft Auto-Save & Resume**: Seamless persistence in `StoredPlanEditorDraft` with full backward compatibility for legacy drafts.
4. **Collaboration Boundary Isolation**: Safe transition to alternative plan ("대안 여행안") when a peer participant publishes a plan concurrently.
5. **Deterministic Completion Path**: AI recommendation loading/failure never owns or blocks editor, back, review, or publish actions.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 4-Stage Main Progress Indicator | Update `TripCreationProgress` to show 4 stages (`여행방 / 동행자 / 첫 여행안 / 검토`) with active sub-step context. | M1 | Survey (Explorer 1 & 2) |
| 2 | Pure Flow Engine & Cursor Normalizer | Pure state machine in `first-plan-wizard-flow.ts` computing next/prev questions, bounds clamping, and error-to-cursor mapping. | M1 | Survey (Spec Miner) |
| 3 | Draft State & Cursor Persistence | Extend `usePlanEditorState.ts` with optional `wizardCursor` persistence and backward-compatible parser. | M1 | Survey (Explorer 2) |
| 4 | Question Shell & A11y / Focus | Unified `FirstPlanWizard.tsx` container with autofocus, live region announcements, and IME composition guards. | M2 | Survey (Explorer 1 & Spec Miner) |
| 5 | Basic Info Questions | Granular single-question screens for Title, Proposal Reason (skippable), and Headcount stepper. | M2 | Survey (Spec Miner) |
| 6 | Route Stops Repeated Questions | Sequence for City -> Arrival Date -> Departure Date -> Add City Prompt, supporting repeated visits and date gaps. | M3 | Survey (Spec Miner) |
| 7 | Accommodations Repeated Questions | Per-stop Accommodation Status (Decided / Searching) and Hotel Name (when decided). | M3 | Survey (Spec Miner) |
| 8 | Transport N+1 Repeated Questions | N+1 Transport legs with prefilled endpoints, confirmation status (Decided / Not Checked), mode and duration. | M3 | Survey (Spec Miner) |
| 9 | Review Jump & Return-to-Review | Jump to exact question cursor from Review "수정" and return directly to Review upon completion. | M4 | Survey (Explorer 2 & Spec Miner) |
| 10 | Plan Home Draft Resume | "이어서 작성하기" CTA on `PlanHomePage` when owner draft with cursor exists. | M4 | Survey (Explorer 2) |
| 11 | Concurrent Plan Isolation | Seamless downgrade to alternative plan ("대안 여행안") without losing active draft inputs if peer publishes first. | M4 | Survey (Explorer 2 & Spec Miner) |
| 12 | Verification & Repository Gate | Comprehensive unit, component, navigation tests, and project-wide canonical check (`pnpm check`). | M5 | Survey (All) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Pure Flow Engine, Draft State & Progress Indicator | `first-plan-wizard-flow.ts`, `first-plan-wizard-flow.test.ts`, `trip-creation-progress.tsx`, `usePlanEditorState.ts` cursor storage & tests | none | DONE |
| M2 | Question Shell & Basic Info Questions | `FirstPlanWizard.tsx` (Shell + Basic Questions), `PlanCreatePage.tsx` first-plan branch & query normalization, tests | M1 | DONE |
| M3 | Route, Accommodation & Transport Questions | Route repeated questions, accommodation questions, N+1 transport questions, synchronization logic & tests | M2 | DONE |
| M4 | Review Navigation, Draft Resume & Collaboration Isolation | Review jump & return-to-review, `PlanHomePage.tsx` resume CTA, concurrent plan alternative transition & tests | M3 | DONE |
| M5 | E2E Navigation Verification & Project Quality Gate | `trip-creation-navigation.test.tsx`, all component tests, acceptance criteria check, `pnpm check`, `git diff --check` | M4 | DONE (PR #113: 140 files / 1,369 tests + `pnpm check`) |

Delivery milestones are complete. Ongoing beta validation is a product-learning loop, not an unfinished implementation milestone.

## MVP / Beta Validation

Do not optimize this flow by raw screen count alone. The current first-plan sequence can dynamically span roughly 13–17 question screens depending on trip data; the sub-step counter exists for orientation, not as a KPI.

Evaluate changes against:

1. creation start → review → publish completion
2. correct cursor restoration and completion after draft resume
3. repeated validation errors or late surprises at review
4. repeated backtracking between particular questions
5. abandonment concentrated at particular questions/sections
6. qualitative mobile usability: whether the user understands the one decision required now versus information that can be decided later

If telemetry is required, extend the existing RAON-222 product-event infrastructure rather than introducing a Wizard-specific analytics stack.

## Interface Contracts

### `FirstPlanWizardCursor`
```typescript
export type FirstPlanWizardSection = "basic" | "route" | "accommodation" | "transport" | "review";

export type FirstPlanWizardQuestion =
  | "title"
  | "proposal-reason"
  | "headcount"
  | "city"
  | "arrival-date"
  | "departure-date"
  | "add-city"
  | "status"
  | "hotel-name"
  | "endpoints"
  | "mode"
  | "duration";

export interface FirstPlanWizardCursor {
  readonly section: FirstPlanWizardSection;
  readonly question: FirstPlanWizardQuestion;
  readonly index?: number;
  readonly returnToReview?: boolean;
}
```

### `first-plan-wizard-flow.ts` Contract
```typescript
export function parseWizardCursor(searchParams: URLSearchParams, pathname: string): FirstPlanWizardCursor;
export function serializeWizardCursor(cursor: FirstPlanWizardCursor, tripId: string): { pathname: string; search: string };
export function normalizeWizardCursor(cursor: Partial<FirstPlanWizardCursor>, formData: PlanEditorFormData): FirstPlanWizardCursor;
export function getNextWizardCursor(currentCursor: FirstPlanWizardCursor, formData: PlanEditorFormData): FirstPlanWizardCursor;
export function getPreviousWizardCursor(currentCursor: FirstPlanWizardCursor, formData: PlanEditorFormData): FirstPlanWizardCursor;
export function mapValidationErrorToCursor(validationError: string, formData: PlanEditorFormData): FirstPlanWizardCursor;
```

### `TripCreationProgress` Contract
```typescript
export type TripCreationStep =
  | "trip-info"
  | "companions"
  | "plan-basic"
  | "plan-route"
  | "plan-accommodation"
  | "plan-transport"
  | "plan-review";

export interface TripCreationProgressProps {
  readonly currentStep: TripCreationStep;
  readonly subStepLabel?: string;
  readonly subStepProgress?: {
    readonly current: number;
    readonly total: number;
  };
  readonly className?: string;
}
```

## Code Layout
- `src/features/plan-editor/first-plan-wizard-flow.ts` — Pure flow state machine and cursor resolver
- `src/features/plan-editor/first-plan-wizard-flow.test.ts` — Pure flow unit tests
- `src/features/plan-editor/components/FirstPlanWizard.tsx` — Granular question wizard component
- `src/features/plan-editor/components/FirstPlanWizard.test.tsx` — Question wizard UI component tests
- `src/features/plan-editor/hooks/usePlanEditorState.ts` — Draft persistence hook
- `src/features/plan-editor/PlanCreatePage.tsx` — Plan creation page with wizard / section bifurcation
- `src/features/plan-editor/components/PlanEditorSections.tsx` — Section editor & review summary
- `src/components/galanda/trip-creation-progress.tsx` — 4-stage main progress bar with optional question-level progress
- `src/components/galanda/trip-creation-progress.test.tsx` — Progress bar accessibility & state tests
- `src/features/plan-home/PlanHomePage.tsx` — Plan home with draft resume CTA
- `src/app/trip-creation-navigation.test.tsx` — End-to-end trip creation navigation integration tests
