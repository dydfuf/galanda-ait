import { useState } from "react";
import { useTheme } from "@/app/theme-provider.tsx";
import { GalandaIcon, type GalandaIconSelection, type GalandaIconSize } from "@/components/galanda/galanda-icon.tsx";
import { ICON_CATALOG } from "@/components/galanda/icons/catalog.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

const categories = {
  navigation: "내비게이션", planning: "여행 준비", actions: "시작·동행",
  decision: "비교·보관", interface: "탐색·편집", status: "상태·알림",
  travel: "장소·교통·지출", collaboration: "의견·협업", preferences: "설정",
};

/** DEV-only catalogue; never adds unfinished actions to the product UI. */
export function DevIconsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [size, setSize] = useState<GalandaIconSize>(24);
  const { preference, setPreference } = useTheme();
  const normalized = query.trim().toLowerCase();
  const items = Object.entries(ICON_CATALOG).filter(([name, entry]) =>
    (category === "all" || entry.category === category) &&
    `${name} ${entry.label} ${categories[entry.category]}`.toLowerCase().includes(normalized),
  );
  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 space-y-6 px-5 py-8 text-foreground">
      <header className="space-y-2">
        <a href="/dev" className="text-primary underline">디자인 카탈로그</a>
        <h1 className="text-2xl font-bold">갈라고 아이콘 카탈로그</h1>
        <p className="text-sm text-muted-foreground">24×24 · 2px · currentColor · 기능 의미는 텍스트가 소유합니다.</p>
      </header>
      <div className="flex min-w-0 flex-wrap gap-4">
        <label className="min-w-0 flex-1 space-y-1">
          <span>아이콘 검색</span>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 기능: search, 숙소…" />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span>분류</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 max-w-full rounded-lg border border-input bg-background px-3 text-foreground">
            <option value="all">전체</option>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        <fieldset className="flex flex-wrap gap-2">
          <legend>표시 크기</legend>
          {([16, 20, 24] as const).map((value) => <Button key={value} variant="outline" aria-pressed={size === value} onClick={() => setSize(value)}>{value}px</Button>)}
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend>앱 테마</legend>
          {([['system', '시스템'], ['light', '라이트'], ['dark', '다크']] as const).map(([value, label]) => <Button key={value} variant="outline" aria-pressed={preference === value} onClick={() => setPreference(value)}>{label}</Button>)}
        </fieldset>
      </div>
      <output aria-live="polite" className="block text-sm text-muted-foreground">{items.length} / {Object.keys(ICON_CATALOG).length}종</output>
      {items.length === 0 && <p>조건에 맞는 아이콘이 없습니다.</p>}
      <ul aria-label="아이콘 목록" className="grid min-w-0 list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([name, entry]) => (
          <li key={name} className="min-w-0 space-y-3 rounded-xl border border-border bg-surface-content p-4">
            <h2 className="font-semibold">{entry.label}</h2>
            <code className="block text-sm [overflow-wrap:anywhere]">{name}</code>
            <div className="flex flex-wrap items-end gap-5">
              {Object.entries(entry.variants).map(([variant, path]) => (
                <div key={variant} className="space-y-2">
                  <div className="flex h-10 items-center gap-4">
                    <GalandaIcon {...({ name, variant } as GalandaIconSelection)} size={size} />
                    <GalandaIcon {...({ name, variant } as GalandaIconSelection)} size={size} className="text-primary" />
                  </div>
                  <a href={path} download className="text-sm text-primary underline" aria-label={`${entry.label} ${variant} SVG`}>{variant} SVG</a>
                </div>
              ))}
            </div>
            <code className="block whitespace-normal text-xs text-muted-foreground [overflow-wrap:anywhere]">{`<GalandaIcon name="${name}" size={${size}} />`}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
