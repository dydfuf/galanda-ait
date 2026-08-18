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
