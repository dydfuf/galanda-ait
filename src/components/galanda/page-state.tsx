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
      readonly status: "empty" | "error";
      readonly title: string;
      readonly description?: string;
    } & PageStateAction);

/**
 * 화면 공통 loading / empty / error 상태예요.
 * 기존 PageState(features/common)의 계약을 그대로 유지한 shadcn 구현이에요.
 */
export function PageState(props: PageStateProps) {
  if (props.status === "loading") {
    return (
      <div
        className="flex min-h-[28vh] flex-col items-center justify-center gap-3 px-(--app-inline-padding) py-12 text-center"
        aria-live="polite"
      >
        <Spinner className="size-6 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{props.message}</p>
      </div>
    );
  }

  const isError = props.status === "error";

  return (
    <div
      className="flex min-h-[28vh] flex-col items-center justify-center gap-2 px-(--app-inline-padding) py-12 text-center"
      role={isError ? "alert" : undefined}
    >
      <h2 className="text-[17px] font-bold text-foreground">{props.title}</h2>
      {props.description && (
        <p className="max-w-80 text-sm leading-normal text-muted-foreground">
          {props.description}
        </p>
      )}
      {props.onAction && (
        <Button type="button" size="lg" className="mt-2" onClick={props.onAction}>
          {props.actionText ?? (isError ? "다시 시도" : "시작하기")}
        </Button>
      )}
    </div>
  );
}
