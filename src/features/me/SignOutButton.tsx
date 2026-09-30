import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { sessionKeys } from "@/hooks/useSession.ts";

/** End the server session before discarding the current account's query cache. */
export function SignOutButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    if (inFlight.current) return;
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
      <Button variant="outline" disabled={pending} aria-busy={pending} onClick={() => void signOut()}>
        {pending ? "로그아웃 중…" : "로그아웃"}
      </Button>
      {failed && <p role="alert" className="text-sm text-destructive">로그아웃하지 못했어요. 다시 시도해 주세요.</p>}
    </div>
  );
}
