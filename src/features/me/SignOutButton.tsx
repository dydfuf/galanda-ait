import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { sessionKeys } from "@/hooks/useSession.ts";
import { getLoginPath } from "@/platform/auth.ts";
import { invalidateInviteShare } from "../invite/invite-share-fallback.ts";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog.tsx";

/** End the server session before discarding the current account's query cache. */
export function SignOutButton({ guest = false }: { guest?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmGuest, setConfirmGuest] = useState(false);

  const signOut = async () => {
    if (inFlight.current) return;
    invalidateInviteShare();
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" ||
          !("success" in result) || result.success !== true) {
        throw new Error("Sign out failed");
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      queryClient.setQueryData(sessionKeys.current(), null);
      navigate("/login", { replace: true });
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-(--app-inline-padding) py-6">
      <Button variant="outline" disabled={pending} aria-busy={pending} onClick={() => guest ? setConfirmGuest(true) : void signOut()}>
        {pending ? "로그아웃 중…" : "로그아웃"}
      </Button>
      {failed && <p role="alert" className="text-sm text-destructive">로그아웃하지 못했어요. 다시 시도해 주세요.</p>}
      <AlertDialog open={confirmGuest} onOpenChange={(open) => { if (!pending) setConfirmGuest(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게스트 상태로 로그아웃할까요?</AlertDialogTitle>
            <AlertDialogDescription>다시 초대받아도 같은 참여자로 돌아오지 못해 작성한 여행안과 자료의 수정 권한을 잃을 수 있어요. 먼저 계정을 연결하면 참여 기록을 이어갈 수 있어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setConfirmGuest(false)}>취소</Button>
            <Button variant="destructive" disabled={pending} onClick={() => void signOut()}>{pending ? "로그아웃 중…" : "게스트 로그아웃"}</Button>
            <Button disabled={pending} onClick={() => navigate(getLoginPath("/me", true))}>계정 연결하기</Button>
          </AlertDialogFooter>
          {failed && <p role="alert" className="text-sm text-destructive">로그아웃하지 못했어요. 다시 시도해 주세요.</p>}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
