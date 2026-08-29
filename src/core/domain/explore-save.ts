import { Schema } from "effect";
import { ExploreListingIdSchema, ParticipantIdSchema } from "./ids.ts";
import { ExploreTimestampSchema } from "./explore-plan.ts";

/**
 * Explore save domain model (RAON-254 / Goal 14 DISC-6).
 *
 * ## Reference-only 계약
 *
 * save는 listing snapshot을 **복사하지 않는다**. 오직 어떤 참여자가 어떤 listing을
 * 언제 저장했는지(reference + savedAt)만 보관한다. saved-list/detail을 표시할 때는
 * 항상 현재 listing snapshot을 read-through하므로, save 시점의 stale snapshot을
 * 되살리지 않는다(최신 공개 상태를 정직하게 반영).
 *
 * ## 사용자별 uniqueness
 *
 * 사용자별 유일성은 stable `ParticipantId` + `ExploreListingId` composite로
 * 강제한다. 같은 참여자가 같은 listing을 두 번 저장해도 논리적 중복 row가 생기지
 * 않는다(POST save idempotent, DELETE unsave 반복 안전).
 *
 * ## Privacy
 *
 * `savedByParticipantId`는 서버 전용 actor 참조다. public DTO(saved-list item)는
 * listing snapshot(공개 projection)만 노출하며 saver participant ID를 포함하지
 * 않는다. save는 count/trending signal을 계산하거나 노출하지 않는다.
 */
export const ExploreSaveSchema = Schema.Struct({
  savedByParticipantId: ParticipantIdSchema,
  listingId: ExploreListingIdSchema,
  savedAt: ExploreTimestampSchema,
});
export type ExploreSave = typeof ExploreSaveSchema.Type;
