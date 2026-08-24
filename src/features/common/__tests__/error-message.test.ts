import { describe, expect, it } from "vitest";
import { ApiClientError } from "../../../app/api-client.ts";
import {
  isRevisionConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../error-message.ts";
import {
  SessionUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "../../../core/domain/errors.ts";

describe("toUserMessage (RAON-149)", (): void => {
  const FALLBACK = "잠시 후 다시 시도해주세요.";

  it("도메인 오류는 message가 비어 있어도 reason을 사용한다", (): void => {
    const error = new UnauthorizedError({
      reason: "여행안을 작성하려면 로그인이 필요합니다.",
    });

    // Schema.TaggedError의 message는 빈 문자열이므로 reason을 읽어야 한다
    expect(error.message).toBe("");
    expect(toUserMessage(error, FALLBACK)).toBe(
      "여행안을 작성하려면 로그인이 필요합니다."
    );
  });

  it("세션 조회 실패 오류의 사유를 그대로 노출한다", (): void => {
    const error = new SessionUnavailableError({
      reason: "로그인 정보를 확인하지 못했습니다: network error",
    });

    expect(toUserMessage(error, FALLBACK)).toBe(
      "로그인 정보를 확인하지 못했습니다: network error"
    );
  });

  it("ValidationError의 message 필드도 노출한다", (): void => {
    const error = new ValidationError({ message: "여행 제목을 입력해주세요." });

    expect(toUserMessage(error, FALLBACK)).toBe("여행 제목을 입력해주세요.");
  });

  it("일반 Error는 message를 사용한다", (): void => {
    expect(toUserMessage(new Error("네트워크 오류"), FALLBACK)).toBe("네트워크 오류");
  });

  it("문자열로 던져진 오류는 그대로 사용한다", (): void => {
    expect(toUserMessage("무언가 잘못되었습니다", FALLBACK)).toBe(
      "무언가 잘못되었습니다"
    );
  });

  it("사유를 알 수 없는 값은 기본 문구로 대체한다", (): void => {
    expect(toUserMessage(new Error(""), FALLBACK)).toBe(FALLBACK);
    expect(toUserMessage({ reason: "   " }, FALLBACK)).toBe(FALLBACK);
    expect(toUserMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(toUserMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(toUserMessage({}, FALLBACK)).toBe(FALLBACK);
  });
});

describe("revision conflict recovery (RAON-210)", (): void => {
  const conflict = new ApiClientError({
    status: 409,
    code: "REVISION_CONFLICT",
    message: "conflict",
    details: { expectedRevision: 3, actualRevision: 4 },
  });

  it("revision conflict만 복구 대상으로 분류하고 revision 변화를 안내한다", (): void => {
    expect(isRevisionConflict(conflict)).toBe(true);
    expect(isRevisionConflict(new ApiClientError({ status: 409, code: "STATE_CONFLICT", message: "conflict" }))).toBe(false);
    expect(toRevisionConflictMessage(conflict)).toContain("v3 → v4");
  });
});
