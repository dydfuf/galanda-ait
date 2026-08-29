import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { ItemDescription, ItemTitle } from "@/components/ui/item.tsx";
import { SavedIdeasSection } from "./components/SavedIdeasSection.tsx";

/**
 * Home destination (RAON-248 / Goal 13 → RAON-256 DISC-9 저장한 여행 아이디어).
 *
 * Global 탐색의 홈 목적지. Goal 14 UI가 확장할 자리를 남겨두되, 지금은 fake data를
 * 만들지 않는 정직한 minimal surface다. 실제로 이동 가능한 destination(탐색/내 여행)
 * 으로의 안내와, 이미 존재하는 persisted saved-listing capability를 통합한
 * `저장한 여행 아이디어` section만 제공한다. 존재하지 않는 통계·추천·이미지·
 * 대시보드(RAON-246 blocker)는 표시하지 않는다.
 *
 * `저장한 여행 아이디어` section의 loading/error는 독립적으로 composed되어 홈의
 * 제목·바로 가기·핵심 콘텐츠를 가리거나 막지 않는다.
 */
export function HomePage() {
  return (
    <PageBody safeTop>
      <PageTitle
        title="홈"
        description="함께 여행 일정을 만들고 다른 여행 일정을 둘러보세요."
      />

      <div className="mt-2 flex flex-col gap-6">
        <MobileList aria-label="바로 가기">
          <MobileListItem to="/trips" chevron>
            <ItemTitle>내 여행</ItemTitle>
            <ItemDescription>
              참여 중인 여행 일정을 확인하고 이어서 정해요.
            </ItemDescription>
          </MobileListItem>
          <MobileListItem to="/explore" chevron>
            <ItemTitle>탐색</ItemTitle>
            <ItemDescription>공개된 다른 여행 일정을 둘러봐요.</ItemDescription>
          </MobileListItem>
        </MobileList>

        <div className="px-(--app-inline-padding)">
          <SavedIdeasSection />
        </div>
      </div>
    </PageBody>
  );
}
