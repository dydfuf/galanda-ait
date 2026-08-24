import { ApiClientError } from "../../app/api-client.ts";

/**
 * 사용자에게 보여줄 오류 문구를 결정한다.
 *
 * 도메인 오류(Schema.TaggedError)는 `reason` 필드에 사유를 담고 `message`는 빈 문자열이므로,
 * `error.message`만 읽으면 화면에 빈 문구가 노출된다. 아래 순서로 해석한다.
 *   1. 도메인 오류의 `reason`
 *   2. 일반 Error의 `message`
 *   3. 문자열로 던져진 오류
 *   4. 호출자가 지정한 기본 문구
 */
export const toUserMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const { reason, message } = error as {
      reason?: unknown;
      message?: unknown;
    };

    if (typeof reason === "string" && reason.trim()) {
      return reason;
    }

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
};

export const isRevisionConflict = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError && error.code === "REVISION_CONFLICT";

export const isStateConflict = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError && error.code === "STATE_CONFLICT";

export const toRevisionConflictMessage = (error: ApiClientError): string => {
  const details = error.details as {
    readonly expectedRevision?: unknown;
    readonly actualRevision?: unknown;
  } | undefined;
  const expected = details?.expectedRevision;
  const actual = details?.actualRevision;

  return typeof expected === "number" && typeof actual === "number"
    ? `다른 사용자가 먼저 변경했습니다 (v${expected} → v${actual}). 최신 내용을 확인한 뒤 다시 적용해주세요.`
    : "다른 사용자가 먼저 변경했습니다. 최신 내용을 확인한 뒤 다시 적용해주세요.";
};
