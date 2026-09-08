import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { platform } from "@/platform/index.ts";
import { postAuthJson, safeReturnTo } from "@/platform/auth.ts";

export function LoginPage() {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const label = platform.name === "ait" ? "토스로 계속하기" : "카카오로 계속하기";
  const needsUpgrade = params.get("reason") === "upgrade";

  useEffect(() => {
    if (platform.name !== "web") return;
    const controller = new AbortController();
    void fetch("/api/auth/config", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const config: unknown = await response.json();
        if (!controller.signal.aborted) {
          setEmailEnabled(
            typeof config === "object" && config !== null &&
            "emailAndPassword" in config && config.emailAndPassword === true,
          );
        }
      })
      .catch(() => { /* 설정을 확인할 수 없으면 이메일 로그인을 노출하지 않아요. */ });
    return () => controller.abort();
  }, []);

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await postAuthJson(`/api/auth/${signUp ? "sign-up" : "sign-in"}/email`, {
        email: email.trim(),
        password,
        ...(signUp ? { name: name.trim() } : {}),
      });
      window.location.assign(safeReturnTo(params.get("returnTo")));
    } catch {
      setError(true);
      setPending(false);
    }
  };

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
          {emailEnabled ? (
            <form onSubmit={(event) => void submitEmail(event)} className="flex flex-col gap-4 rounded-2xl border border-border p-4" aria-label="Staging 이메일 로그인">
              <p className="text-base font-semibold">Staging 테스트 계정</p>
              <p className="text-sm text-muted-foreground">개발 테스트용 이메일과 비밀번호를 사용해 주세요. 인증 메일은 보내지 않아요.</p>
              {signUp ? (
                <Field>
                  <FieldLabel htmlFor="staging-name">이름</FieldLabel>
                  <Input id="staging-name" autoComplete="nickname" required pattern={".*\\S.*"} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="staging-email">이메일</FieldLabel>
                <Input id="staging-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
              </Field>
              <Field>
                <FieldLabel htmlFor="staging-password">비밀번호</FieldLabel>
                <Input id="staging-password" type="password" autoComplete={signUp ? "new-password" : "current-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} aria-describedby="staging-password-hint" />
                <p id="staging-password-hint" className="text-sm text-muted-foreground">8~128자</p>
              </Field>
              <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
                {pending ? "처리 중…" : signUp ? "계정 만들고 시작하기" : "이메일로 로그인"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => { setSignUp(!signUp); setError(false); }}>
                {signUp ? "기존 계정으로 로그인" : "테스트 계정 만들기"}
              </Button>
            </form>
          ) : null}
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
