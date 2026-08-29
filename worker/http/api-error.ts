import type { Context as HonoContext } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Cause } from "effect";
import type { AppEnv } from "../app.ts";

export interface ApiErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: unknown;
}

export interface ApiErrorResponse {
  readonly error: ApiErrorDetail;
}

export function formatApiError(detail: ApiErrorDetail): ApiErrorResponse {
  return {
    error: {
      code: detail.code,
      message: detail.message,
      requestId: detail.requestId,
      ...(detail.details !== undefined ? { details: detail.details } : {}),
    },
  };
}

export function mapDomainError(
  error: unknown,
  requestId: string
): { status: ContentfulStatusCode; body: ApiErrorResponse } {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagged = error as { _tag: string; [key: string]: unknown };

    switch (tagged._tag) {
      case "UnauthorizedError":
        return {
          status: 401,
          body: formatApiError({
            code: "UNAUTHORIZED",
            message:
              typeof tagged.reason === "string" && tagged.reason.length > 0
                ? tagged.reason
                : "인증이 필요합니다.",
            requestId,
          }),
        };

      case "ForbiddenError":
        return {
          status: 403,
          body: formatApiError({
            code: "FORBIDDEN",
            message:
              typeof tagged.reason === "string" && tagged.reason.length > 0
                ? tagged.reason
                : "해당 작업을 수행할 권한이 없습니다.",
            requestId,
          }),
        };

      case "AccountUpgradeRequiredError":
        return {
          status: 403,
          body: formatApiError({
            code: "ACCOUNT_UPGRADE_REQUIRED",
            message:
              typeof tagged.reason === "string" && tagged.reason.length > 0
                ? tagged.reason
                : "계정 연결이 필요합니다.",
            requestId,
          }),
        };

      case "ExploreListingUnavailableError":
        return {
          status: 410,
          body: formatApiError({
            code: "LISTING_UNAVAILABLE",
            message: "게시가 중단되었거나 더 이상 볼 수 없는 여행 일정입니다.",
            requestId,
          }),
        };

      case "InvalidInviteError":
        return {
          status: 404,
          body: formatApiError({
            code: "INVITE_INVALID",
            message: "초대 링크가 만료되었거나 유효하지 않습니다.",
            requestId,
          }),
        };

      case "NotFoundError":
        return {
          status: 404,
          body: formatApiError({
            code: "NOT_FOUND",
            message: "요청한 리소스를 찾을 수 없습니다.",
            requestId,
            details:
              typeof tagged.entity === "string" && typeof tagged.id === "string"
                ? { entity: tagged.entity, id: tagged.id }
                : undefined,
          }),
        };

      case "RevisionConflictError":
        return {
          status: 409,
          body: formatApiError({
            code: "REVISION_CONFLICT",
            message:
              typeof tagged.message === "string" && tagged.message.length > 0
                ? tagged.message
                : "다른 사용자에 의해 리소스가 수정되었습니다.",
            requestId,
            details: {
              expectedRevision: tagged.expectedRevision,
              actualRevision: tagged.actualRevision,
            },
          }),
        };

      case "StateConflictError":
        return {
          status: 409,
          body: formatApiError({
            code: "STATE_CONFLICT",
            message:
              typeof tagged.message === "string" && tagged.message.length > 0
                ? tagged.message
                : "현재 상태에서는 요청한 작업을 수행할 수 없습니다.",
            requestId,
          }),
        };

      case "ValidationError":
        return {
          status: 422,
          body: formatApiError({
            code: "VALIDATION_FAILED",
            message:
              typeof tagged.message === "string" && tagged.message.length > 0
                ? tagged.message
                : "입력값이 유효하지 않습니다.",
            requestId,
          }),
        };

      case "SessionUnavailableError":
        return {
          status: 503,
          body: formatApiError({
            code: "AUTH_SERVICE_UNAVAILABLE",
            message: "인증 서비스를 일시적으로 사용할 수 없습니다.",
            requestId,
          }),
        };

      case "RepositoryError":
        return {
          status: 503,
          body: formatApiError({
            code: "SERVICE_UNAVAILABLE",
            message: "데이터베이스 서비스를 일시적으로 사용할 수 없습니다.",
            requestId,
          }),
        };
    }
  }

  return {
    status: 500,
    body: formatApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 내부 오류가 발생했습니다.",
      requestId,
    }),
  };
}

export function mapErrorToResponse(
  c: HonoContext<AppEnv>,
  cause: Cause.Cause<unknown>,
  requestId: string
): Response {
  const failReason = cause.reasons.find(Cause.isFailReason);

  if (failReason) {
    const { status, body } = mapDomainError(failReason.error, requestId);
    return c.json(body, status);
  }

  const dieReason = cause.reasons.find(Cause.isDieReason);
  if (dieReason) {
    console.error(`[Defect] requestId=${requestId}:`, dieReason.defect);
  } else {
    console.error(`[Cause] requestId=${requestId}:`, cause);
  }

  return c.json(
    formatApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 내부 오류가 발생했습니다.",
      requestId,
    }),
    500
  );
}
