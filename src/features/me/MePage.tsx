import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";

import { useTheme } from "@/app/theme-provider.tsx";
import { MobileList, MobileListItem } from "@/components/galanda/mobile-list.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { ItemTitle } from "@/components/ui/item.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { toUserMessage } from "@/features/common/error-message.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";

const THEME_LABELS = {
  system: "시스템",
  light: "라이트",
  dark: "다크",
} as const;

const THEME_OPTIONS = [
  { value: "system", label: "시스템", Icon: Monitor },
  { value: "light", label: "라이트", Icon: Sun },
  { value: "dark", label: "다크", Icon: Moon },
] as const;

/**
 * My(마이) destination (RAON-248 / Goal 13).
 *
 * Global 탐색의 마이 목적지. 지금은 로그인한 사용자의 표시 이름만 정직하게 보여주는
 * minimal surface다. Goal 14 UI가 확장할 자리를 남겨두되, 존재하지 않는 통계·배지·
 * 활동 내역 같은 fake data를 만들지 않는다.
 */
export function MePage() {
  const { preference, setPreference } = useTheme();
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);
  const { data: session, isPending, isError, error, refetch } =
    useSessionQuery();

  if (isPending) {
    return (
      <PageBody safeTop>
        <PageState status="loading" message="내 정보를 불러오는 중이에요." />
      </PageBody>
    );
  }

  if (isError) {
    return (
      <PageBody safeTop>
        <PageState
          status="error"
          title="내 정보를 확인할 수 없어요"
          description={toUserMessage(error, "잠시 후 다시 시도해주세요.")}
          actionText="다시 시도"
          onAction={() => void refetch()}
        />
      </PageBody>
    );
  }

  return (
    <PageBody safeTop>
      <PageTitle
        title="마이"
        description={
          session?.name
            ? `${session.name}님으로 이용 중이에요.`
            : "내 계정 정보를 여기에서 관리해요."
        }
      />
      <nav className="flex flex-col gap-2 px-(--app-inline-padding)" aria-label="마이 메뉴">
        <Link
          to="/me/saved"
          className="flex min-h-(--touch-target-min) min-w-0 items-center rounded-xl border border-border bg-card px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          저장한 여행 일정
        </Link>
      </nav>

      <section className="mt-6 px-(--app-inline-padding)" aria-label="화면 설정">
        <MobileList
          aria-label="화면 설정 메뉴"
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <MobileListItem
            chevron
            onClick={() => setIsThemeSheetOpen(true)}
            trailing={
              <span className="text-sm font-medium text-foreground-muted">
                {THEME_LABELS[preference]}
              </span>
            }
          >
            <ItemTitle className="text-base font-medium text-foreground">
              화면 설정
            </ItemTitle>
          </MobileListItem>
        </MobileList>
      </section>

      <Drawer
        open={isThemeSheetOpen}
        onOpenChange={setIsThemeSheetOpen}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>화면 설정</DrawerTitle>
            <DrawerDescription>
              앱 화면에 사용할 색상을 선택하세요.
            </DrawerDescription>
          </DrawerHeader>
          <RadioGroup
            value={preference}
            onValueChange={(value) => {
              if (value === "system" || value === "light" || value === "dark") {
                setPreference(value);
                setIsThemeSheetOpen(false);
              }
            }}
            aria-label="색상 선택"
            className="gap-0 px-4 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))]"
          >
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <label
                key={value}
                className="flex min-h-(--touch-target-min) cursor-pointer items-center gap-3 border-b border-border py-3.5 last:border-b-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-muted text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-base font-medium text-foreground">
                  {label}
                </span>
                <RadioGroupItem value={value} />
              </label>
            ))}
          </RadioGroup>
        </DrawerContent>
      </Drawer>
    </PageBody>
  );
}
