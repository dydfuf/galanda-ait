import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { useTheme } from "@/app/theme-provider.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer.tsx";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Toggle } from "@/components/ui/toggle.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { ExternalLink } from "@/components/galanda/external-link.tsx";
import {
  MobileList,
  MobileListItem,
} from "@/components/galanda/mobile-list.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageHeader } from "@/components/galanda/page-header.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { GalandaSpot } from "@/components/galanda/galanda-spot.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { SectionHeader } from "@/components/galanda/section-header.tsx";
import { TripCreationProgress } from "@/components/galanda/trip-creation-progress.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * 개발 전용 디자인 카탈로그예요.
 *
 * - `import.meta.env.DEV`일 때만 `/dev` route로 등록돼요 (프로덕션에서는 404).
 * - 로그인이 필요 없어요. shadcn primitive + Galanda shell + semantic token을
 *   한 페이지에서 눈으로 확인할 때만 써요.
 */
export function DevDesignPage() {
  return (
    <div data-slot="dev-design-page" className="min-h-dvh bg-background">
      <PageHeader
        title="Design Catalog"
        sticky
        bordered
        action={
          <Button type="button" variant="ghost" size="sm" disabled>
            DEV
          </Button>
        }
      />
      <DevAnchorNav />
      <PageBody safeTop withBottomAction={false}>
        <PageTitle
          title="Galanda UI 카탈로그"
          description="shadcn primitive, Galanda shell, semantic token을 한눈에 확인하는 개발 전용 페이지예요. 프로덕션 빌드에는 포함되지 않아요."
        />
        <TokenSection />
        <TypographySection />
        <ButtonsSection />
        <BadgesSection />
        <FormsSection />
        <SelectionSection />
        <ListsSection />
        <FeedbackSection />
        <OverlaysSection />
        <ShellSection />
        <div className="px-(--app-inline-padding) py-10">
          <p className="text-sm text-muted-foreground">
            이 페이지는 개발 환경에서만 보여요. 실제 화면의 visual regression
            기준이 필요하면 캡처 도구로 각 섹션을 기록해 주세요.
          </p>
        </div>
      </PageBody>
      <DevBottomActionDemo />
    </div>
  );
}

const NAV_ITEMS: ReadonlyArray<{ readonly id: string; readonly label: string }> = [
  { id: "tokens", label: "토큰" },
  { id: "typography", label: "타이포" },
  { id: "buttons", label: "버튼" },
  { id: "badges", label: "배지" },
  { id: "forms", label: "폼" },
  { id: "selection", label: "선택" },
  { id: "lists", label: "목록" },
  { id: "feedback", label: "피드백" },
  { id: "overlays", label: "오버레이" },
  { id: "shell", label: "셸·패턴" },
];

function DevAnchorNav() {
  return (
    <nav
      aria-label="디자인 카탈로그 목차"
      className="sticky top-14 z-10 border-b border-border bg-background"
    >
      <ul className="mx-auto flex w-full max-w-(--content-max-width) flex-wrap gap-1 overflow-x-auto px-(--app-inline-padding) py-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex min-h-(--touch-target-min) items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DevSection({
  id,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32">
      <SectionHeader
        title={<span id={`${id}-title`}>{title}</span>}
        description={description}
      />
      <div className="flex flex-col gap-4 px-(--app-inline-padding) py-2">
        {children}
      </div>
    </section>
  );
}

function DevCard({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <p className="mb-3 text-sm font-semibold text-muted-foreground">{title}</p>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </div>
  );
}

/* ── Tokens ─────────────────────────────────────────────── */

interface TokenSwatch {
  readonly name: string;
  readonly usage: string;
  readonly previewClassName: string;
  readonly sampleClassName?: string;
}

const TOKEN_GROUPS: ReadonlyArray<{
  readonly title: string;
  readonly tokens: ReadonlyArray<TokenSwatch>;
}> = [
  {
    title: "Base",
    tokens: [
      { name: "--background", usage: "화면 기본 배경", previewClassName: "bg-background" },
      { name: "--foreground", usage: "기본 텍스트", previewClassName: "bg-foreground" },
      { name: "--card", usage: "카드 표면", previewClassName: "bg-card" },
      { name: "--muted", usage: "보조 배경", previewClassName: "bg-muted" },
      {
        name: "--muted-foreground",
        usage: "보조 텍스트",
        previewClassName: "bg-background",
        sampleClassName: "text-muted-foreground",
      },
      { name: "--secondary", usage: "보조 행동 배경", previewClassName: "bg-secondary" },
      { name: "--accent", usage: "강조 배경", previewClassName: "bg-accent" },
      { name: "--border", usage: "기본 경계선", previewClassName: "bg-border" },
      { name: "--border-strong", usage: "강조 경계선", previewClassName: "bg-border-strong" },
      { name: "--input", usage: "입력 경계선", previewClassName: "bg-input" },
      { name: "--ring", usage: "포커스 링", previewClassName: "bg-ring" },
    ],
  },
  {
    title: "Brand",
    tokens: [
      { name: "--primary", usage: "브랜드 / 주요 행동", previewClassName: "bg-primary" },
      {
        name: "--primary-foreground",
        usage: "primary 위 텍스트",
        previewClassName: "bg-primary",
        sampleClassName: "text-primary-foreground",
      },
      { name: "--primary-muted", usage: "primary tint 배경", previewClassName: "bg-primary-muted" },
      { name: "--primary-border", usage: "primary 경계", previewClassName: "bg-primary-border" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "--destructive", usage: "위험 / 삭제", previewClassName: "bg-destructive" },
      {
        name: "--destructive-strong",
        usage: "위험 텍스트",
        previewClassName: "bg-destructive-muted",
        sampleClassName: "text-destructive-strong",
      },
      { name: "--destructive-muted", usage: "위험 soft 배경", previewClassName: "bg-destructive-muted" },
      { name: "--destructive-border", usage: "위험 경계", previewClassName: "bg-destructive-border" },
      {
        name: "--success",
        usage: "성공 텍스트",
        previewClassName: "bg-success-muted",
        sampleClassName: "text-success",
      },
      { name: "--success-muted", usage: "성공 soft 배경", previewClassName: "bg-success-muted" },
      {
        name: "--warning",
        usage: "주의 텍스트",
        previewClassName: "bg-warning-muted",
        sampleClassName: "text-warning",
      },
      { name: "--warning-muted", usage: "주의 soft 배경", previewClassName: "bg-warning-muted" },
      { name: "--warning-border", usage: "주의 경계", previewClassName: "bg-warning-border" },
      {
        name: "--info",
        usage: "안내 텍스트",
        previewClassName: "bg-info-muted",
        sampleClassName: "text-info",
      },
      { name: "--info-muted", usage: "안내 soft 배경", previewClassName: "bg-info-muted" },
    ],
  },
  {
    title: "Surface",
    tokens: [
      { name: "--surface-content", usage: "본문 표면 (불투명)", previewClassName: "bg-surface-content" },
      { name: "--surface-subtle", usage: "미묘한 구분 표면", previewClassName: "bg-surface-subtle" },
      {
        name: "--foreground-muted",
        usage: "2단계 본문 텍스트",
        previewClassName: "bg-background",
        sampleClassName: "text-foreground-muted",
      },
      {
        name: "--foreground-subtle",
        usage: "3단계 보조 텍스트",
        previewClassName: "bg-background",
        sampleClassName: "text-foreground-subtle",
      },
    ],
  },
];

function TokenSection() {
  const { theme, preference, setPreference } = useTheme();
  return (
    <DevSection
      id="tokens"
      title="Semantic tokens"
      description="신규 UI는 아래 토큰만 사용해요. raw 색상 값을 새로 추가하지 마세요."
    >
      <DevCard title={`Theme · 현재 ${theme} (preference: ${preference})`}>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              variant={preference === option ? "default" : "outline"}
              size="sm"
              aria-pressed={preference === option}
              onClick={() => setPreference(option)}
            >
              {option}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          토글이 실제 앱 테마를 바꿔요. 확인이 끝나면 원래 설정으로 되돌려
          주세요.
        </p>
      </DevCard>
      {TOKEN_GROUPS.map((group) => (
        <DevCard key={group.title} title={group.title}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.tokens.map((token) => (
              <li
                key={token.name}
                className="min-w-0 overflow-hidden rounded-lg border border-border"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "grid h-14 w-full place-items-center border-b border-border",
                    token.previewClassName,
                  )}
                >
                  {token.sampleClassName && (
                    <span className={cn("text-sm font-semibold", token.sampleClassName)}>
                      가나 Ag 12
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 bg-card p-2">
                  <p className="truncate font-mono text-xs text-foreground">
                    {token.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {token.usage}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </DevCard>
      ))}
    </DevSection>
  );
}

/* ── Typography ─────────────────────────────────────────── */

function TypographySection() {
  return (
    <DevSection
      id="typography"
      title="Typography & headings"
      description="화면 제목은 PageTitle(h1), 섹션 제목은 SectionHeader(h2)가 소유해요."
    >
      <DevCard title="PageTitle (h1)">
        <div className="overflow-hidden rounded-lg border border-border">
          <PageTitle
            title="8월 제주 여행"
            description="친구들과 함께 만드는 첫 여행안이에요."
            action={
              <Button type="button" variant="outline" size="sm">
                편집
              </Button>
            }
          />
        </div>
      </DevCard>
      <DevCard title="SectionHeader (h2)">
        <div className="overflow-hidden rounded-lg border border-border">
          <SectionHeader
            title="여행안 목록"
            description="확정된 안부터 순서대로 보여요."
            action={
              <Button type="button" variant="ghost" size="sm">
                전체 보기
              </Button>
            }
          />
        </div>
      </DevCard>
      <DevCard title="Text scale">
        <p className="text-[22px] font-bold leading-tight">22px Bold · 페이지 제목</p>
        <p className="text-lg font-bold leading-snug">18px Bold · 섹션 제목</p>
        <p className="text-[17px] font-bold leading-snug">17px Bold · 상태 제목</p>
        <p className="text-base leading-relaxed">16px Regular · 본문 텍스트예요. 줄 간격은 relaxed를 써요.</p>
        <p className="text-base text-foreground-muted">16px · 보조 본문 텍스트예요.</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          14px · 설명 텍스트예요.
        </p>
      </DevCard>
    </DevSection>
  );
}

/* ── Buttons ────────────────────────────────────────────── */

function ButtonsSection() {
  return (
    <DevSection
      id="buttons"
      title="Buttons"
      description="신규 공통 버튼은 shadcn Button만 사용해요."
    >
      <DevCard title="Variants">
        <div className="flex flex-wrap gap-2">
          <Button type="button">Default</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Button type="button" variant="ghost">
            Ghost
          </Button>
          <Button type="button" variant="destructive">
            Destructive
          </Button>
          <Button type="button" variant="link">
            Link
          </Button>
        </div>
      </DevCard>
      <DevCard title="Sizes">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="xs">
            XS
          </Button>
          <Button type="button" size="sm">
            SM
          </Button>
          <Button type="button" size="default">
            Default
          </Button>
          <Button type="button" size="lg">
            LG
          </Button>
          <Button type="button" size="xl">
            XL · 주요 CTA
          </Button>
          <Button type="button" size="icon" aria-label="일정 추가">
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </DevCard>
      <DevCard title="States">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled>
            Disabled
          </Button>
          <Button type="button" disabled aria-busy="true">
            <Spinner aria-hidden="true" />
            저장 중
          </Button>
          <Button type="button" variant="outline">
            <Trash2 className="size-4" aria-hidden="true" />
            아이콘 + 텍스트
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          저장 실패를 성공처럼 표시하지 마세요. 진행 중에는 스피너와 함께
          버튼을 비활성화해요.
        </p>
      </DevCard>
    </DevSection>
  );
}

/* ── Badges ─────────────────────────────────────────────── */

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
  "info",
  "success",
  "warning",
  "danger",
  "neutral",
  "info-solid",
  "success-solid",
  "neutral-solid",
] as const;

function BadgesSection() {
  return (
    <DevSection
      id="badges"
      title="Badges"
      description="같은 상태는 화면마다 같은 variant를 써요 (확정안 = success-solid)."
    >
      <DevCard title="All variants">
        <div className="flex flex-wrap gap-2">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </DevCard>
      <DevCard title="도메인 예시">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success-solid">확정안</Badge>
          <Badge variant="info">확인 필요</Badge>
          <Badge variant="warning">검토 중</Badge>
          <Badge variant="danger">마감 임박</Badge>
          <Badge variant="neutral">지난 여행</Badge>
        </div>
      </DevCard>
    </DevSection>
  );
}

/* ── Forms ──────────────────────────────────────────────── */

function FormsSection() {
  const [visibility, setVisibility] = useState("companions");
  return (
    <DevSection
      id="forms"
      title="Forms"
      description="라벨·설명·오류는 Field 세트로 묶어요. 오류는 가짜 성공 문구로 덮지 마세요."
    >
      <DevCard title="Label + Input + Textarea">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-trip-title">여행 제목</Label>
          <Input id="dev-trip-title" placeholder="예: 8월 제주 여행" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-trip-memo">메모</Label>
          <Textarea id="dev-trip-memo" placeholder="동행자에게 공유할 메모를 적어 주세요." />
        </div>
      </DevCard>
      <DevCard title="Field set (설명 + 오류)">
        <Field>
          <FieldLabel htmlFor="dev-nickname">닉네임</FieldLabel>
          <Input id="dev-nickname" placeholder="2자 이상 입력해 주세요." />
          <FieldDescription>
            여행방에서 다른 동행자에게 보이는 이름이에요.
          </FieldDescription>
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor="dev-nickname-error">닉네임 (오류 상태)</FieldLabel>
          <Input
            id="dev-nickname-error"
            defaultValue="김"
            aria-invalid
            aria-describedby="dev-nickname-error-message"
          />
          <FieldError id="dev-nickname-error-message">
            닉네임은 2자 이상 입력해 주세요.
          </FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="dev-disabled">비활성화 입력</FieldLabel>
          <Input id="dev-disabled" placeholder="수정할 수 없어요." disabled />
        </Field>
      </DevCard>
      <DevCard title="RadioGroup">
        <RadioGroup
          value={visibility}
          onValueChange={setVisibility}
          aria-label="여행 공개 범위"
        >
          {[
            { value: "companions", label: "동행자에게만 공개" },
            { value: "link", label: "링크가 있으면 누구나" },
            { value: "private", label: "나만 보기" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-(--touch-target-min) cursor-pointer items-center gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1 text-base text-foreground">
                {option.label}
              </span>
              <RadioGroupItem value={option.value} />
            </label>
          ))}
        </RadioGroup>
        <p className="text-sm text-muted-foreground">선택값: {visibility}</p>
      </DevCard>
    </DevSection>
  );
}

/* ── Selection ──────────────────────────────────────────── */

function SelectionSection() {
  const [tab, setTab] = useState("plans");
  return (
    <DevSection
      id="selection"
      title="Tabs · Toggle · Separator"
      description="목록 필터와 모드 전환에 쓰는 선택 컴포넌트예요."
    >
      <DevCard title="Tabs (default)">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="여행방 탭 미리보기" className="w-full">
            <TabsTrigger value="plans">여행안</TabsTrigger>
            <TabsTrigger value="itinerary">일정</TabsTrigger>
            <TabsTrigger value="chat" disabled>
              채팅(준비 중)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plans">
            <p className="text-sm text-muted-foreground">
              여행안 패널이에요. 선택값: {tab}
            </p>
          </TabsContent>
          <TabsContent value="itinerary">
            <p className="text-sm text-muted-foreground">일정 패널이에요.</p>
          </TabsContent>
        </Tabs>
      </DevCard>
      <DevCard title="Tabs (line)">
        <Tabs defaultValue="ongoing">
          <TabsList variant="line" aria-label="여행 목록 필터 미리보기">
            <TabsTrigger value="ongoing">진행 중</TabsTrigger>
            <TabsTrigger value="past">지난 여행</TabsTrigger>
          </TabsList>
        </Tabs>
      </DevCard>
      <DevCard title="Toggle">
        <div className="flex flex-wrap gap-2">
          <Toggle aria-label="지도 보기 전환">
            <MapPin className="size-4" aria-hidden="true" />
            <span className="sr-only">지도 보기 전환</span>
            지도
          </Toggle>
          <Toggle variant="outline" defaultPressed aria-label="달력 보기 전환">
            <CalendarDays className="size-4" aria-hidden="true" />
            <span className="sr-only">달력 보기 전환</span>
            달력
          </Toggle>
        </div>
        <ToggleGroup aria-label="일차 선택 미리보기">
          <ToggleGroupItem value="day1" defaultPressed>
            1일차
          </ToggleGroupItem>
          <ToggleGroupItem value="day2">2일차</ToggleGroupItem>
          <ToggleGroupItem value="day3">3일차</ToggleGroupItem>
        </ToggleGroup>
      </DevCard>
      <DevCard title="Separator">
        <p className="text-sm">위 콘텐츠</p>
        <Separator />
        <p className="text-sm">아래 콘텐츠</p>
        <div className="flex h-10 items-stretch gap-3">
          <span className="text-sm">왼쪽</span>
          <Separator orientation="vertical" />
          <span className="text-sm">오른쪽</span>
        </div>
      </DevCard>
    </DevSection>
  );
}

/* ── Lists ──────────────────────────────────────────────── */

function ListsSection() {
  return (
    <DevSection
      id="lists"
      title="Items & lists"
      description="목록 행은 Item, 모바일 탐색 행은 MobileListItem으로 구성해요."
    >
      <DevCard title="Item variants">
        <Item>
          <ItemMedia variant="icon">
            <MapPin className="size-4 text-info" aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>성산일출봉</ItemTitle>
            <ItemDescription>제주 서귀포시 · 2일차 오전</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="info">방문 예정</Badge>
          </ItemActions>
        </Item>
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>숙소 후보 3곳 비교</ItemTitle>
            <ItemDescription>가격대와 이동 시간을 함께 확인해요.</ItemDescription>
          </ItemContent>
        </Item>
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>지난 여행 기록</ItemTitle>
            <ItemDescription>2025년 8월 · 3박 4일</ItemDescription>
          </ItemContent>
        </Item>
      </DevCard>
      <DevCard title="MobileListItem">
        <MobileList>
          <MobileListItem
            leading={
              <span className="grid size-10 place-items-center rounded-full bg-primary-muted text-primary">
                <Users className="size-5" aria-hidden="true" />
              </span>
            }
            trailing={<Badge variant="success">3명 참여</Badge>}
            chevron
            onClick={() => {}}
            aria-label="동행자 목록 보기"
          >
            <ItemTitle>동행자</ItemTitle>
            <ItemDescription>초대 현황과 역할을 확인해요.</ItemDescription>
          </MobileListItem>
          <MobileListItem
            trailing={<span className="text-sm text-muted-foreground">D-12</span>}
            chevron
            to="/dev"
          >
            <ItemTitle>다가오는 여행</ItemTitle>
            <ItemDescription>제주 · 8월 14일 출발</ItemDescription>
          </MobileListItem>
          <MobileListItem disabled aria-label="준비 중인 메뉴">
            <ItemTitle>정산하기 (준비 중)</ItemTitle>
            <ItemDescription>아직 사용할 수 없어요.</ItemDescription>
          </MobileListItem>
        </MobileList>
      </DevCard>
    </DevSection>
  );
}

/* ── Feedback ───────────────────────────────────────────── */

function FeedbackSection() {
  return (
    <DevSection
      id="feedback"
      title="Spinner · PageState · Toast"
      description="로딩/빈 상태/오류는 PageState로 배타적으로 표현해요."
    >
      <DevCard title="Spinner">
        <div className="flex items-center gap-4">
          <Spinner aria-hidden="true" />
          <Spinner className="size-6" aria-hidden="true" />
          <Spinner className="size-8 text-primary" aria-hidden="true" />
        </div>
      </DevCard>
      <DevCard title="PageState">
        <div className="overflow-hidden rounded-lg border border-border">
          <PageState
            status="empty"
            title="진행 중인 여행이 없어요"
            description="새 여행을 시작하려면 아래 버튼을 이용해주세요."
            illustration={<GalandaSpot name="empty-trips" />}
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <PageState
            status="empty"
            title="아직 저장한 여행 일정이 없어요"
            description="탐색에서 마음에 드는 여행 일정을 저장하면 이곳에 모여요."
            illustration={<GalandaSpot name="empty-saved" />}
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <PageState status="loading" message="여행 정보를 불러오는 중이에요." />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <PageState
            status="empty"
            title="아직 여행안이 없어요"
            description="첫 여행안을 만들면 동행자와 비교할 수 있어요."
            actionText="여행안 만들기"
            onAction={() => {}}
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <PageState
            status="error"
            title="여행 정보를 불러오지 못했어요"
            description="네트워크 연결을 확인한 뒤 다시 시도해 주세요."
            actionText="다시 시도"
            onAction={() => {}}
          />
        </div>
      </DevCard>
      <DevCard title="Toast (sonner)">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => toast.success("저장했어요.")}>
            success
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast.info("새 여행안이 도착했어요.")}>
            info
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast.warning("마감 하루 전이에요.")}>
            warning
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast.error("저장에 실패했어요.")}>
            error
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.loading("여행 정보를 저장하는 중이에요.")}
          >
            loading
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          토스트는 앱 전역 Toaster로 렌더돼요. loading 토스트는 직접 닫아
          주세요.
        </p>
      </DevCard>
    </DevSection>
  );
}

/* ── Overlays ───────────────────────────────────────────── */

function OverlaysSection() {
  return (
    <DevSection
      id="overlays"
      title="AlertDialog · Drawer"
      description="파괴적 확인은 AlertDialog, 하단 시트는 Drawer를 써요."
    >
      <DevCard title="AlertDialog">
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="destructive">여행안 삭제 열기</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>여행안을 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  삭제하면 이 여행안을 다시 복구할 수 없어요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DevCard>
      <DevCard title="Drawer">
        <div className="flex flex-wrap gap-2">
          <Drawer>
            <DrawerTrigger render={<Button type="button" variant="outline">Bottom sheet 열기</Button>} />
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>여행안 선택</DrawerTitle>
                <DrawerDescription>
                  비교할 여행안을 선택해 주세요.
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex flex-col gap-2 px-4 pb-2">
                <Input placeholder="여행안 검색" aria-label="여행안 검색" />
              </div>
              <DrawerFooter>
                <DrawerClose render={<Button type="button" variant="outline">닫기</Button>} />
                <Button type="button">선택 완료</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <Drawer showSwipeHandle keyboardAware>
            <DrawerTrigger render={<Button type="button" variant="ghost">입력 시트 열기</Button>} />
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>의견 남기기</DrawerTitle>
                <DrawerDescription>
                  입력 필드가 있는 키보드 대응 시트예요.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-2">
                <Textarea placeholder="의견을 입력해 주세요." aria-label="의견 입력" />
              </div>
              <DrawerFooter>
                <Button type="button">저장</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </DevCard>
    </DevSection>
  );
}

/* ── Shell & patterns ───────────────────────────────────── */

function ShellSection() {
  return (
    <DevSection
      id="shell"
      title="Galanda shell & patterns"
      description="화면 골격(PageHeader/Title/Body)과 반복 패턴을 확인해요."
    >
      <DevCard title="PageHeader">
        <div className="overflow-hidden rounded-lg border border-border">
          <PageHeader title="제목만 있는 헤더" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <PageHeader
            title="뒤로가기 + 액션"
            back={{ onClick: () => {} }}
            action={
              <Button type="button" variant="ghost" size="sm">
                <Pencil className="size-4" aria-hidden="true" />
                편집
              </Button>
            }
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <PageHeader title="Sticky + bordered" sticky bordered />
        </div>
      </DevCard>
      <DevCard title="TripCreationProgress">
        <TripCreationProgress currentStep="trip-info" />
        <TripCreationProgress
          currentStep="plan-route"
          subStepLabel="경로 정하기"
          subStepProgress={{ current: 2, total: 4 }}
        />
        <TripCreationProgress currentStep="plan-review" />
      </DevCard>
      <DevCard title="ExternalLink & offline">
        <ExternalLink href="https://example.com">
          바깥 링크 열기 (플랫폼 어댑터 경유)
        </ExternalLink>
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-lg border border-warning-border bg-warning-muted px-4 py-2 text-xs font-medium text-warning"
        >
          <span aria-hidden="true">●</span>
          <span>
            오프라인 상태 미리보기예요. 실제 OfflineStatusBanner는 오프라인일
            때만 렌더돼요.
          </span>
        </div>
      </DevCard>
    </DevSection>
  );
}

function DevBottomActionDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <div className="mx-auto w-full max-w-(--content-max-width) px-(--app-inline-padding) pb-10">
        <DevCard title="BottomAction (고정 CTA)">
          <p className="text-sm text-muted-foreground">
            BottomAction은 뷰포트 하단에 고정돼요. 켜면 이 페이지 어디에서든
            실제 고정 동작을 확인할 수 있어요. 쓰는 화면은 PageBody의
            withBottomAction 여백 계약을 지켜야 해요.
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={visible}
              onClick={() => setVisible((prev) => !prev)}
            >
              {visible ? "고정 CTA 숨기기" : "고정 CTA 미리보기 켜기"}
            </Button>
          </div>
        </DevCard>
      </div>
      {visible && (
        <BottomAction
          accessory={
            <p className="rounded-lg bg-warning-muted px-3 py-2 text-center text-sm text-warning">
              accessory 영역이에요. validation 안내를 여기에 둬요.
            </p>
          }
        >
          <Button type="button" variant="outline" size="xl" onClick={() => setVisible(false)}>
            취소
          </Button>
          <Button type="button" size="xl">
            저장
          </Button>
        </BottomAction>
      )}
    </>
  );
}
