const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const OFFLINE_MUTATION_MESSAGE =
  "오프라인 상태에서는 저장할 수 없습니다. 입력 내용은 유지됩니다.";

export class OfflineMutationError extends Error {
  readonly code = "OFFLINE_MUTATION_BLOCKED" as const;

  constructor() {
    super(OFFLINE_MUTATION_MESSAGE);
    this.name = "OfflineMutationError";
  }
}

export function isUnsafeHttpMethod(method?: string): boolean {
  return !SAFE_HTTP_METHODS.has((method ?? "GET").toUpperCase());
}

export function assertOnlineForRequest(method?: string): void {
  if (
    typeof navigator !== "undefined" &&
    navigator.onLine === false &&
    isUnsafeHttpMethod(method)
  ) {
    throw new OfflineMutationError();
  }
}

export function isOfflineMutationError(
  error: unknown,
): error is OfflineMutationError {
  return (
    error instanceof OfflineMutationError ||
    (error instanceof Error &&
      "code" in error &&
      error.code === "OFFLINE_MUTATION_BLOCKED")
  );
}
