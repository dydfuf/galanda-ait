import { useParams } from "react-router-dom";
import { Result } from "effect";

import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { useAppNavigation } from "@/hooks/useAppNavigation.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { ApiClientError } from "@/app/api-client.ts";

import {
  decodeRouteParams,
  ExploreListingParamsSchema,
} from "@/app/routes/route-params.ts";

import { useExploreListingDetailQuery } from "./queries.ts";
import { ExploreListingDetailContent } from "./components/ExploreListingDetailContent.tsx";
import { ExploreSaveToggle } from "./components/ExploreSaveToggle.tsx";
import { ExploreImportAction } from "./components/ExploreImportAction.tsx";

/**
 * Explore listing focused detail page (RAON-263 / Goal 14 DISC-5).
 *
 * ## Route ownership
 *
 * 이 화면은 GlobalShellLayout **밖**의 SessionRoute에 마운트되어 하단 Global
 * 탐색 nav가 렌더되지 않는다. 뒤로가기는 Web/PWA에서 PageHeader back이 소유하고,
 * AIT(platformNavigation)에서는 native shell이 back/title을 소유하므로 Web
 * header를 렌더하지 않는다(중복 chrome 금지).
 *
 * direct URL/refresh/back 진입도 지원한다. `goBack`은 세션 내 이동 기록이 없으면
 * fallback으로 `/explore`(feed)로 이동한다.
 *
 * ## Privacy / states
 *
 * detail query는 오직 `/api/explore/listings/:listingId`만 호출한다. source
 * private Trip/Plan route나 private endpoint는 호출하지 않는다. cached private
 * fallback 없이 서버 상태를 그대로 반영한다:
 * - listed → public detail.
 * - unlisted(410 LISTING_UNAVAILABLE) → unavailable 안내(존재하지만 게시 중단).
 * - not-found(404) → 존재하지 않음 안내.
 * - 그 외 오류/infra 장애 → 재시도 가능한 error 안내.
 *
 * save/import action은 공개 detail이 로드된 뒤 action slot으로 주입한다
 * (DISC-6 save, DISC-8 import). 로드 전/오류 상태에서는 slot을 주입하지 않으므로
 * dead CTA DOM이 렌더되지 않는다.
 */

type DetailErrorKind = "unavailable" | "not-found" | "error";

const classifyError = (error: unknown): DetailErrorKind => {
  if (error instanceof ApiClientError) {
    if (error.status === 410) return "unavailable";
    if (error.status === 404) return "not-found";
  }
  return "error";
};

export function ExploreListingDetailPage() {
  const params = useParams();
  const { goBack, platformNavigation } = useAppNavigation();
  const { isError: isSessionError, error: sessionError } = useSessionQuery();

  const validated = decodeRouteParams(ExploreListingParamsSchema, params);

  const handleBack = () => {
    void goBack("/explore");
  };

  const header = platformNavigation ? null : (
    <PageHeader
      sticky
      bordered
      safeTop
      title="여행 일정"
      back={{ onClick: handleBack }}
    />
  );

  // path validation 실패(무효한 listingId 형식): private read 없이 not-found 처리.
  const invalidParam = Result.isFailure(validated);
  const listingId = Result.isSuccess(validated)
    ? validated.success.listingId
    : undefined;

  const detail = useExploreListingDetailQuery(
    // enabled=false일 때는 호출되지 않지만 hook 규칙상 항상 호출한다.
    (listingId ?? "") as NonNullable<typeof listingId>
  );

  const body = (() => {
    if (invalidParam) {
      return (
        <PageState
          status="error"
          title="여행 일정을 찾을 수 없어요"
          description="주소가 올바르지 않거나 변경되었어요."
          actionText="탐색으로 돌아가기"
          onAction={handleBack}
        />
      );
    }

    if (isSessionError) {
      return (
        <PageState
          status="error"
          title="로그인 정보를 확인할 수 없어요"
          description={toUserMessage(sessionError, "잠시 후 다시 시도해주세요.")}
          actionText="탐색으로 돌아가기"
          onAction={handleBack}
        />
      );
    }

    if (detail.isPending) {
      return (
        <PageState status="loading" message="여행 일정을 불러오는 중이에요." />
      );
    }

    if (detail.isError) {
      const kind = classifyError(detail.error);
      if (kind === "unavailable") {
        return (
          <PageState
            status="error"
            title="공개가 중단된 여행 일정이에요"
            description="작성자가 공개를 중단했거나 더 이상 볼 수 없는 여행 일정이에요."
            actionText="탐색으로 돌아가기"
            onAction={handleBack}
          />
        );
      }
      if (kind === "not-found") {
        return (
          <PageState
            status="error"
            title="여행 일정을 찾을 수 없어요"
            description="이미 삭제되었거나 존재하지 않는 여행 일정이에요."
            actionText="탐색으로 돌아가기"
            onAction={handleBack}
          />
        );
      }
      return (
        <PageState
          status="error"
          title="여행 일정을 불러오지 못했어요"
          description={toUserMessage(detail.error, "잠시 후 다시 시도해주세요.")}
          actionText="다시 시도"
          onAction={() => void detail.refetch()}
        />
      );
    }

    // 공개 detail이 로드되면 save toggle + import action을 action slot으로
    // 주입한다(DISC-6 save, DISC-8 import). 좁은 화면(320~430)에서 겹치지 않도록
    // min-w-0 반응형 stack으로 배치한다.
    return (
      <ExploreListingDetailContent
        item={detail.data}
        action={
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <ExploreSaveToggle listingId={detail.data.listingId} />
            <ExploreImportAction listingId={detail.data.listingId} />
          </div>
        }
      />
    );
  })();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      {header}
      <main className="flex flex-1 flex-col">
        <PageBody>{body}</PageBody>
      </main>
    </div>
  );
}
