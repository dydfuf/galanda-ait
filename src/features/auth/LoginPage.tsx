import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { platform } from "@/platform/index.ts";
import { safeReturnTo } from "@/platform/auth.ts";

export function LoginPage() {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const label = platform.name === "ait" ? "토스로 계속하기" : "카카오로 계속하기";
  const needsUpgrade = params.get("reason") === "upgrade";

  const signIn = async () => {
    setPending(true);
    setError(false);
    try {
      await platform.signIn(safeReturnTo(params.get("returnTo")));
    } catch {
      setError(true);
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">갈란다</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {needsUpgrade ? "계정을 연결해 여행을 만들어 보세요" : "함께 갈 여행을 시작해요"}
        </h1>
        <p className="text-muted-foreground">
          이메일 없이 소셜 계정으로 간편하게 {needsUpgrade ? "연결" : "로그인"}할 수 있어요.
        </p>
      </div>
      <Button type="button" size="xl" disabled={pending} onClick={() => void signIn()}>
        {pending ? "연결 중…" : label}
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : null}
    </main>
  );
}
