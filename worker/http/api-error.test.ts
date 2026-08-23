import { describe, expect, it } from "vitest";
import {
  AccountUpgradeRequiredError,
  ConflictError,
  NotFoundError,
  RepositoryError,
  SessionUnavailableError,
  UnauthorizedError,
  ValidationError,
} from "../../src/core/domain/errors.ts";
import { formatApiError, mapDomainError } from "./api-error.ts";

describe("api-error", () => {
  const reqId = "test-req-id-123";

  it("formats API errors with optional details", () => {
    const errorWithoutDetails = formatApiError({
      code: "TEST_CODE",
      message: "Test message",
      requestId: reqId,
    });
    expect(errorWithoutDetails).toEqual({
      error: {
        code: "TEST_CODE",
        message: "Test message",
        requestId: reqId,
      },
    });

    const errorWithDetails = formatApiError({
      code: "TEST_CODE",
      message: "Test message",
      requestId: reqId,
      details: { extra: 1 },
    });
    expect(errorWithDetails).toEqual({
      error: {
        code: "TEST_CODE",
        message: "Test message",
        requestId: reqId,
        details: { extra: 1 },
      },
    });
  });

  it("maps UnauthorizedError", () => {
    const err = new UnauthorizedError({ reason: "Custom reason" });
    const result = mapDomainError(err, reqId);
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(result.body.error.message).toBe("Custom reason");
  });

  it("maps AccountUpgradeRequiredError", () => {
    const result = mapDomainError(
      new AccountUpgradeRequiredError({ reason: "소셜 계정을 연결해 주세요." }),
      reqId
    );
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("ACCOUNT_UPGRADE_REQUIRED");
  });

  it("maps NotFoundError", () => {
    const err = new NotFoundError({ entity: "Trip", id: "trip-1" });
    const result = mapDomainError(err, reqId);
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
    expect(result.body.error.details).toEqual({ entity: "Trip", id: "trip-1" });
  });

  it("maps ConflictError", () => {
    const err = new ConflictError({
      message: "Conflict detected",
      expectedRevision: 1,
      actualRevision: 2,
    });
    const result = mapDomainError(err, reqId);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("REVISION_CONFLICT");
    expect(result.body.error.message).toBe("Conflict detected");
    expect(result.body.error.details).toEqual({
      expectedRevision: 1,
      actualRevision: 2,
    });
  });

  it("maps ValidationError", () => {
    const err = new ValidationError({ message: "Invalid field" });
    const result = mapDomainError(err, reqId);
    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe("VALIDATION_FAILED");
    expect(result.body.error.message).toBe("Invalid field");
  });

  it("maps SessionUnavailableError", () => {
    const err = new SessionUnavailableError({ reason: "DB timeout" });
    const result = mapDomainError(err, reqId);
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("AUTH_SERVICE_UNAVAILABLE");
    expect(result.body.error.message).toBe("인증 서비스를 일시적으로 사용할 수 없습니다.");
  });

  it("maps RepositoryError without leaking internal details", () => {
    const err = new RepositoryError({
      operation: "findUserByInternalKey",
      message: "secret_table deadlock",
    });
    const result = mapDomainError(err, reqId);
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(result.body.error.message).toBe("데이터베이스 서비스를 일시적으로 사용할 수 없습니다.");
    expect(result.body.error.details).toBeUndefined();
  });

  it("maps unknown non-tagged errors to 500 INTERNAL_SERVER_ERROR", () => {
    const result = mapDomainError(new Error("unknown error"), reqId);
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.body.error.message).toBe("서버 내부 오류가 발생했습니다.");
  });
});
