/**
 * Journey fixtures (RAON-258 / Goal 14 DISC-10).
 *
 * 실제 publish validation(`getPlanPublishValidationErrors`) + projection
 * (`projectExplorePlanSnapshot`)을 통과하는 최소한의 유효 plan/room을 만든다.
 * fake popularity/image/count는 넣지 않는다. private field(authorId/opinions 등)는
 * server-side row에만 존재하고 public 응답에는 절대 노출되지 않아야 한다.
 */
import type {
  ExploreListingRecord,
  TripRoomRecord,
} from "./harness.ts";
import { RevisionSchema } from "../../src/core/domain/ids.ts";

/** 실제 publish/projection을 통과하는 단일 도시 왕복 plan. */
export const publishablePlan = (options: {
  readonly planId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly revision?: number;
  readonly title?: string;
  /** private-only opinion (public 응답 누출 금지 검증용). */
  readonly hardReason?: string;
  readonly opinionUserId?: string;
}) => ({
  id: options.planId,
  title: options.title ?? "오사카 벚꽃 여행",
  status: "VOTING" as const,
  revision: options.revision ?? 1,
  publishedAt: "2026-08-20T00:00:00.000Z",
  authorId: options.authorId,
  authorName: options.authorName,
  baseHeadcount: 2,
  routes: [
    { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
  ],
  accommodations: [
    {
      id: `${options.planId}-stay-1`,
      city: "오사카",
      period: "2026-09-01 ~ 2026-09-04",
      nights: 3,
      hotelName: "난바 호텔",
      isSearching: false,
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
  transports: [
    {
      id: `${options.planId}-transport-1`,
      fromCity: "서울",
      toCity: "오사카",
      mode: "비행기",
      hasTransfer: false,
      durationText: "1시간 40분",
      bookingStatus: "NOT_CHECKED" as const,
    },
    {
      id: `${options.planId}-transport-2`,
      fromCity: "오사카",
      toCity: "서울",
      mode: "비행기",
      hasTransfer: false,
      durationText: "1시간 40분",
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
  places: [],
  // private-only signal: 공개 snapshot/DTO에 새어 나가면 안 된다.
  memberOpinions:
    options.hardReason && options.opinionUserId
      ? [
          {
            userId: options.opinionUserId,
            userName: "반대자",
            reaction: "HARD" as const,
            reason: options.hardReason,
          },
        ]
      : [],
  voteCount: 0,
});

/** author가 소유한 private trip room (member는 author + 지정한 추가 멤버). */
export const privateRoom = (options: {
  readonly tripId: string;
  readonly host: { id: string; name: string };
  readonly extraMembers?: ReadonlyArray<{ id: string; name: string }>;
  readonly plans: ReadonlyArray<ReturnType<typeof publishablePlan>>;
  readonly revision?: number;
  readonly createdAt?: string;
}): TripRoomRecord => ({
  id: options.tripId,
  title: "우리끼리 오사카",
  destination: "오사카",
  revision: options.revision ?? 1,
  members: [
    { id: options.host.id, name: options.host.name, role: "HOST" },
    ...(options.extraMembers ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      role: "MEMBER" as const,
    })),
  ],
  plans: options.plans,
  confirmedPlanId: null,
  createdAt: options.createdAt ?? "2026-08-20T00:00:00.000Z",
  updatedAt: options.createdAt ?? "2026-08-20T00:00:00.000Z",
});

/** 이미 게시된 LISTED listing row (직접 seed용). */
export const listedListing = (options: {
  readonly listingId: string;
  readonly sourceTripId: string;
  readonly sourcePlanId: string;
  readonly sourceAuthorParticipantId: string;
  readonly listedAt?: string;
  readonly title?: string;
  readonly cityIds?: readonly string[];
}): ExploreListingRecord => {
  const listedAt = options.listedAt ?? "2026-08-25T00:00:00.000Z";
  return {
    id: options.listingId,
    sourceTripId: options.sourceTripId,
    sourcePlanId: options.sourcePlanId,
    sourceAuthorParticipantId: options.sourceAuthorParticipantId,
    snapshot: {
      title: options.title ?? "오사카 벚꽃 여행",
      destination: "오사카",
      routes: [
        { city: "오사카", arrivalDate: "2026-09-01", departureDate: "2026-09-04" },
      ],
      dateRange: {
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        nightCount: 3,
      },
      stays: [
        { city: "오사카", hotelName: "난바 호텔", isSearching: false, nights: 3 },
      ],
      transports: [
        {
          fromCity: "서울",
          toCity: "오사카",
          mode: "비행기",
          hasTransfer: false,
          durationText: "1시간 40분",
        },
        {
          fromCity: "오사카",
          toCity: "서울",
          mode: "비행기",
          hasTransfer: false,
          durationText: "1시간 40분",
        },
      ],
      author: { displayName: "여행작가" },
      sourcePlanRevision: RevisionSchema.make(1),
    },
    status: "LISTED",
    listingRevision: 1,
    sourcePlanRevision: 1,
    listedAt,
    updatedAt: listedAt,
    unlistedAt: null,
    cityIds: options.cityIds ?? ["osaka"],
  };
};
