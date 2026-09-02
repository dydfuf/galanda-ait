import type { TestInfo } from "@playwright/test";

const DAY_MS = 24 * 60 * 60 * 1000;

export function futureDate(offsetDays: number): string {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(utcMidnight + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

export function futureTravelPeriod(): {
  startDate: string;
  endDate: string;
} {
  return { startDate: futureDate(30), endDate: futureDate(34) };
}

export function uniqueTestTitle(prefix: string, testInfo: TestInfo): string {
  return `${prefix.slice(0, 19)}-${Date.now().toString(36)}-${testInfo.retry}`;
}
