import { css } from "@emotion/react";
import { Button, Loader } from "@toss/tds-mobile";

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

const containerStyle = css`
  min-height: 28vh;
  padding: 48px var(--app-inline-padding);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
`;

const titleStyle = css`
  color: var(--adaptiveGrey900, #191f28);
  font-size: 17px;
  font-weight: 700;
`;

const descriptionStyle = css`
  max-width: 320px;
  color: var(--adaptiveGrey600, #6b7684);
  font-size: 14px;
  line-height: 1.5;
`;

export function PageState(props: PageStateProps) {
  if (props.status === "loading") {
    return (
      <div css={containerStyle} aria-live="polite">
        <Loader size="medium" label={props.message} />
      </div>
    );
  }

  const isError = props.status === "error";

  return (
    <div css={containerStyle} role={isError ? "alert" : undefined}>
      <h2 css={titleStyle}>{props.title}</h2>
      {props.description && <p css={descriptionStyle}>{props.description}</p>}
      {props.onAction && (
        <Button size="medium" type="button" onClick={props.onAction}>
          {props.actionText ?? (isError ? "다시 시도" : "시작하기")}
        </Button>
      )}
    </div>
  );
}
