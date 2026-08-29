/**
 * Test-only runtime bridge between the Web/jsdom TypeScript project and the
 * Worker journey harness. The harness itself remains typechecked by
 * tsconfig.worker.json; the adjacent declaration exposes only this test's
 * narrow cross-project surface so DOM ambient types do not recompile Worker
 * sources under tsconfig.app.json.
 */
export {
  createJourneyHarness,
  routeFetchToApp,
} from "../../../worker/journey/harness.ts";
export {
  listedListing,
  privateRoom,
  publishablePlan,
} from "../../../worker/journey/fixtures.ts";
