import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { copyToClipboard } from "@/platform/web/adapter.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import {
  getInviteShareFallback, invalidateInviteShare, subscribeInviteShareFallback,
} from "./invite-share-fallback.ts";

export function InviteShareFallback() {
  const url = useSyncExternalStore(subscribeInviteShareFallback, getInviteShareFallback);
  const location = useLocation();
  const { data: session } = useSessionQuery();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<{ url: string; message: string }>();
  const message = copyStatus?.url === url ? copyStatus?.message : undefined;
  useLayoutEffect(() => {
    invalidateInviteShare();
    return () => {
      invalidateInviteShare();
      setCopyStatus(undefined);
    };
  }, [location.key, session?.participantId, session?.accountType, session?.isAuthenticated]);

  function close() {
    invalidateInviteShare();
    setCopyStatus(undefined);
  }

  async function copy() {
    if (!url) return;
    const outcome = await copyToClipboard(url);
    // 닫기/이동 후 끝난 비동기 복사는 capability를 다시 보관하지 않는다.
    if (getInviteShareFallback() !== url) return;
    setCopyStatus({ url, message: outcome === "copied"
      ? "초대 링크를 복사했어요. 동행에게 보내주세요."
      : "자동 복사가 차단되어 있어요. 링크를 길게 누르거나 선택한 뒤 직접 복사해주세요." });
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  return (
    <Drawer open={Boolean(url)} onOpenChange={(open) => { if (!open) close(); }}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle>초대 링크 직접 복사</DrawerTitle>
          <DrawerDescription className="text-pretty break-keep">이 브라우저에서는 자동 공유가 어려워요. 아래 링크를 복사해 동행에게 보내주세요.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-2 p-4">
          <label htmlFor="manual-invite-link" className="text-sm font-medium">초대 링크</label>
          <Input id="manual-invite-link" ref={inputRef} readOnly value={url ?? ""} onFocus={(event) => event.currentTarget.select()} />
          <p className="text-sm text-muted-foreground">링크를 받은 사람은 여행방에 참여할 수 있어요. 함께할 동행에게만 보내주세요.</p>
          {message && <output className="text-sm text-foreground">{message}</output>}
        </div>
        <DrawerFooter>
          <Button onClick={() => void copy()}>링크 복사</Button>
          <Button variant="outline" onClick={close}>닫기</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
