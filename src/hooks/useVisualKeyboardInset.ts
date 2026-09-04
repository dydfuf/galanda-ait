import { useEffect } from "react";

export const KEYBOARD_INSET_PROPERTY = "--app-keyboard-inset";
const KEYBOARD_OPEN_THRESHOLD_PX = 40;
const FOCUS_SCROLL_DELAY_MS = 150;
/** 가려짐 판단에 쓰는 시각적 여백이에요. CSS의 scroll-margin-bottom과 맞췄어요. */
const OBSTRUCTION_BREATHING_PX = 16;

/** 키보드 inset을 게시하는 fixed obstruction들의 마커예요. */
const OBSTRUCTION_SELECTORS = [
  '[data-slot="bottom-action"]',
  '[data-slot="trip-mode-switcher"]',
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * layout viewport 하단에서 가려진 영역 높이를 구해요.
 * visual viewport의 실제 하단 좌표는 `offsetTop + height`이므로 pan된 만큼
 * 빼줘야 해요. Safari가 포커스된 입력을 보이게 하려고 visual viewport를
 * pan하면 `offsetTop`이 0보다 커져요.
 *
 * `interactive-widget=resizes-content` 환경(Android Chrome)에서는 layout 자체가
 * 줄어들어 inset이 0에 수렴해요. 두 경우 모두 CTA를 키보드 위로 올리는 데
 * 같은 CSS 변수(`--app-keyboard-inset`)를 쓸 수 있어요.
 */
export function resolveKeyboardInset(
  layoutHeight: number,
  visualHeight: number | undefined,
  offsetTop = 0,
): number {
  if (
    !Number.isFinite(layoutHeight) ||
    !Number.isFinite(visualHeight ?? Number.NaN) ||
    !Number.isFinite(offsetTop)
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.round(layoutHeight - offsetTop - (visualHeight as number)),
  );
}

/** 가상 키보드를 여는 텍스트 입력 타입만 골라요. */
const TEXT_ENTRY_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "tel",
  "url",
  "password",
  "number",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
]);

function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // type 미지정(type="")은 기본 text로 취급해요.
    const inputType = (target as HTMLInputElement).type.toLowerCase();
    return inputType === "" || TEXT_ENTRY_INPUT_TYPES.has(inputType);
  }
  return false;
}

/**
 * 현재 화면에서 입력을 가리는 가장 위의 fixed obstruction 상단 좌표예요.
 * BottomAction 높이를 상수로 가정하지 않고 실제 DOM geometry를 읽어요.
 * (accessory 줄바꿈, 글자 확대, Global nav offset이 달라도 맞아요.)
 * 가리는 요소가 없으면 visual viewport 하단을 그대로 써요.
 */
function getObstructionTop(visualBottom: number): number {
  const tops: number[] = [];
  for (const selector of OBSTRUCTION_SELECTORS) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    try {
      tops.push(element.getBoundingClientRect().top);
    } catch {
      // 구형 WebView 방어: geometry 실패 시 해당 요소는 무시해요.
    }
  }
  return tops.length > 0 ? Math.min(visualBottom, ...tops) : visualBottom;
}

function scrollIfCovered(target: HTMLElement): void {
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportTop = viewport?.offsetTop ?? 0;
  const visualBottom = viewportTop + viewportHeight;
  const rect = target.getBoundingClientRect();
  const obstructionTop = getObstructionTop(visualBottom);
  const isCovered = rect.bottom > obstructionTop - OBSTRUCTION_BREATHING_PX;
  const isAbove = rect.top < viewportTop;
  if (!isCovered && !isAbove) return;
  try {
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  } catch {
    // 구형 WebView에서는 scrollIntoView option이 throw할 수 있어요. 무시해요.
    try {
      target.scrollIntoView();
    } catch {
      // no-op
    }
  }
}

/**
 * 가상 키보드에 따라 `--app-keyboard-inset`을 root에 게시해요.
 * AppRootLayout에서 한 번만 마운트해요. 포커스된 입력이 CTA에 가려지면
 * 부드럽게 끌어올려 앱처럼 따라오게 해요.
 */
export function useVisualKeyboardInset(): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const root = document.documentElement;
    let frame = 0;
    let disposed = false;
    // 대기 중인 포커스 스크롤은 논리적으로 하나만 유지해요. 새 포커스가 오면
    // 토큰을 갱신해 이전 timer를 무효화해요(빠른 필드 이동에서 화면 왕복 방지).
    let focusScrollToken = 0;

    const publish = (inset: number) => {
      root.style.setProperty(KEYBOARD_INSET_PROPERTY, `${Math.max(0, Math.round(inset))}px`);
      if (inset > KEYBOARD_OPEN_THRESHOLD_PX) {
        root.dataset.keyboardOpen = "true";
      } else {
        delete root.dataset.keyboardOpen;
      }
    };

    const update = () => {
      if (disposed) return;
      frame = 0;
      const viewport = window.visualViewport;
      const inset = viewport
        ? resolveKeyboardInset(
            window.innerHeight,
            viewport.height,
            viewport.offsetTop,
          )
        : 0;
      publish(inset);
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const scheduleFocusedElementScroll = (target: HTMLElement) => {
      // 이전 필드의 timer가 남아 있으면 무효화해요. 빠른 필드 이동에서
      // 오래된 입력 기준으로 화면이 왕복하는 것을 막아요.
      const token = ++focusScrollToken;
      window.setTimeout(() => {
        if (token !== focusScrollToken) return;
        // 이미 blur됐거나 다른 필드로 넘어갔으면 스크롤하지 않아요.
        if (!target.isConnected || document.activeElement !== target) return;
        scrollIfCovered(target);
      }, FOCUS_SCROLL_DELAY_MS);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) {
        // 포커스 직후에는 키보드가 아직 닫혀 있어 inset이 0일 수 있어요.
        // resize/scroll 이벤트가 뒤따라 오면서 CTA를 올리고, 아래 scroll이 본문을 맞춰줘요.
        scheduleUpdate();
        scheduleFocusedElementScroll(event.target);
      }
    };

    const handleFocusOut = () => {
      scheduleUpdate();
    };

    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      disposed = true;
      focusScrollToken++;
      if (frame) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      root.style.removeProperty(KEYBOARD_INSET_PROPERTY);
      delete root.dataset.keyboardOpen;
    };
  }, []);
}
