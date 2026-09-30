/** Never pass exception messages, causes, request bodies or credentials to log sinks. */
export function logServerFailure(
  event: "unhandled_error" | "effect_defect" | "effect_interrupted" | "nba_active_configuration_invalid" | "nba_shadow_schedule_failed",
  requestId: string,
): void {
  try {
    console.error(JSON.stringify({ event, requestId }));
  } catch {
    // A failed telemetry sink must not change application behavior.
  }
}

export const safeAuthLogger = {
  level: "warn" as const,
  log(level: "debug" | "info" | "warn" | "error", ..._diagnostics: unknown[]): void {
    try {
      const record = JSON.stringify({ event: "auth_diagnostic", level });
      if (level === "error") console.error(record);
      else if (level === "warn") console.warn(record);
    } catch {
      // Authentication must not depend on the logging sink.
    }
  },
};
