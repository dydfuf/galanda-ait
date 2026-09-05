import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface PageStateAction {
  readonly actionText?: string;
  readonly onAction?: () => void;
}

export type PageStateProps =
  | {
      readonly status: "loading";
      readonly message: string;
    }
  | ({
      readonly title: string;
      readonly description?: string;
    } & PageStateAction & (
      | { readonly status: "empty"; readonly illustration?: ReactNode }
      | { readonly status: "error" }
    ));

/**
 * query 결과의 loading / empty / error 상태를 배타적으로 표현해요.
 * mutation, 권한, revision conflict 같은 feature-owned 의미는 호출자가 결정해요.
 */
export function PageState(props: PageStateProps) {
  if (props.status === "loading") {
    return (
      <div
        data-system-state="loading"
        className="flex min-h-[28vh] flex-col items-center justify-center gap-3 bg-surface-content px-(--app-inline-padding) py-12 text-center"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Spinner className="size-6 text-info" aria-hidden="true" />
        <p className="text-base leading-relaxed text-foreground-muted">
          {props.message}
        </p>
      </div>
    );
  }

  const isError = props.status === "error";

  return (
    <div
      data-system-state={props.status}
      className="flex min-h-[28vh] flex-col items-center justify-center gap-3 bg-surface-content px-(--app-inline-padding) py-12 text-center"
    >
      {props.status === "empty" && props.illustration}
      <div
        className="flex max-w-80 flex-col items-center gap-2"
        role={isError ? "alert" : "status"}
        aria-live={isError ? undefined : "polite"}
        aria-atomic="true"
      >
        <h2
          className={
            isError
              ? "text-[17px] font-bold leading-snug text-destructive-strong"
              : "text-[17px] font-bold leading-snug text-foreground"
          }
        >
          {props.title}
        </h2>
        {props.description && (
          <p className="text-base leading-relaxed text-foreground-muted">
            {props.description}
          </p>
        )}
      </div>
      {props.onAction && (
        <Button
          type="button"
          size="lg"
          className="text-base"
          onClick={props.onAction}
        >
          {props.actionText ?? (isError ? "다시 시도" : "시작하기")}
        </Button>
      )}
    </div>
  );
}
