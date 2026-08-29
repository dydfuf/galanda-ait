import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { useSessionQuery } from "@/hooks/useSession.ts";
import type { ExploreListingId } from "@/core/domain/ids.ts";

import { ExploreImportDrawer } from "./ExploreImportDrawer.tsx";

/**
 * Explore 상세 `내 여행으로 가져오기` action (RAON-262 DISC-8).
 *
 * 실제 import CTA를 렌더하고, 클릭 시 대상 선택 drawer를 연다. drawer가 실제
 * 흐름(옵션 선택/복사 확인/pending/성공 후 이동)을 소유한다.
 *
 * 비로그인/세션 미준비 시에는 action을 렌더하지 않는다(dead/오해 소지 CTA 금지).
 * drawer는 열릴 때만 private trip query를 발사하므로 상세 최초 로드에서 private
 * 조회가 나가지 않는다.
 */
export function ExploreImportAction({
  listingId,
}: {
  readonly listingId: ExploreListingId;
}) {
  const { data: session, isSuccess: isSessionReady } = useSessionQuery();
  const [isOpen, setIsOpen] = useState(false);

  if (!isSessionReady || !session) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="min-w-0 flex-1"
        onClick={() => setIsOpen(true)}
        data-slot="explore-import-action"
      >
        <Download className="size-5" aria-hidden="true" />
        <span>내 여행으로 가져오기</span>
      </Button>

      <ExploreImportDrawer
        listingId={listingId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
