import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
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
    <main className="flex min-h-dvh w-full flex-1 bg-surface-content">
      <PageBody
        safeTop
        className="flex min-h-dvh flex-col justify-center gap-8"
      >
        <div className="min-w-0">
          <p className="px-(--app-inline-padding) text-base font-semibold text-primary">
            갈란다
          </p>
          <PageTitle
            className="pt-2"
            title={
              needsUpgrade
                ? "계정을 연결해 여행을 만들어 보세요"
                : "함께 갈 여행을 결정해요"
            }
            description={`이메일 없이 소셜 계정으로 간편하게 ${needsUpgrade ? "연결" : "로그인"}할 수 있어요.`}
          />
        </div>

        <ol aria-label="갈란다에서 여행을 결정하는 방법" className="mx-(--app-inline-padding) flex flex-col gap-3 rounded-2xl bg-muted p-5 text-base">
          <li><strong>비교</strong> · 여행안의 일정과 비용을 나란히 살펴봐요.</li>
          <li><strong>의견</strong> · 친구들과 좋은 점, 어려운 점을 나눠요.</li>
          <li><strong>확정</strong> · 모인 의견으로 예약할 여행안을 정해요.</li>
        </ol>

        <div className="flex min-w-0 flex-col gap-3 px-(--app-inline-padding)">
          <Button
            type="button"
            size="xl"
            className="w-full"
            disabled={pending}
            aria-busy={pending}
            aria-live="polite"
            onClick={() => void signIn()}
          >
            {pending ? "연결 중…" : label}
          </Button>
          {error ? (
            <p
              role="alert"
              aria-atomic="true"
              className="text-base leading-relaxed text-destructive"
            >
              로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
        </div>
      </PageBody>
    </main>
  );
}
