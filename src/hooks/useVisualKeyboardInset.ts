import { useEffect } from "react";

export const KEYBOARD_INSET_PROPERTY = "--app-keyboard-inset";
const KEYBOARD_OPEN_THRESHOLD_PX = 40;
const FOCUS_SCROLL_DELAY_MS = 150;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * layout viewport와 visual viewport 차이로 가상 키보드 높이를 구해요.
 * `interactive-widget=resizes-content` 환경(Android Chrome)에서는 layout 자체가
 * 줄어들어 inset이 0에 수렴하고, iOS처럼 layout이 줄지 않는 환경에서는
 * visual viewport가 줄어든 만큼 inset이 생겨요. 두 경우 모두 CTA를 키보드 위로
 * 올리는 데 같은 CSS 변수(`--app-keyboard-inset`)를 쓸 수 있어요.
 */
export function resolveKeyboardInset(
  windowInnerHeight: number,
  visualViewportHeight: number | undefined,
): number {
  if (
    !Number.isFinite(windowInnerHeight) ||
    !Number.isFinite(visualViewportHeight ?? Number.NaN)
  ) {
    return 0;
  }
  return Math.max(0, Math.round(windowInnerHeight - (visualViewportHeight as number)));
}

function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function scrollEditableIntoView(target: HTMLElement): void {
  // 키보드 애니메이션(≈100-300ms) 뒤에 가시성을 확인하고 보정해요.
  // scroll-padding/scroll-margin이 있으면 브라우저 기본 스크롤이 먼저 동작하고,
  // 여기서는 CTA에 가려진 경우만 추가로 끌어올려요.
  window.setTimeout(() => {
    if (!target.isConnected) return;
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const rect = target.getBoundingClientRect();
    const viewportTop = viewport?.offsetTop ?? 0;
    const visibleBottom = viewportTop + viewportHeight;
    const ctaReserve = 96;
    const isCovered = rect.bottom > visibleBottom - ctaReserve;
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
  }, FOCUS_SCROLL_DELAY_MS);
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
        ? resolveKeyboardInset(window.innerHeight, viewport.height)
        : 0;
      publish(inset);
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableTarget(event.target)) {
        // 포커스 직후에는 키보드가 아직 닫혀 있어 inset이 0일 수 있어요.
        // resize 이벤트가 뒤따라 오면서 CTA를 올리고, 아래 scroll이 본문을 맞춰줘요.
        scheduleUpdate();
        scrollEditableIntoView(event.target);
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
