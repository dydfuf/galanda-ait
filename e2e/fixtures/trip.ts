import { expect, type Page } from "@playwright/test";
import { futureTravelPeriod } from "./dates.ts";

const travelPeriod = futureTravelPeriod();

export async function createTrip(
  page: Page,
  origin: string,
  title: string,
): Promise<string> {
  await page.goto(`${origin}/trips/new`);
  await page.getByLabel("여행 이름 *").fill(title);
  await page.getByRole("button", { name: "여행 만들고 계속" }).click();
  await page.waitForURL(
    (url) => /^\/trips\/[^/]+\/setup\/companions$/.test(url.pathname),
  );

  const tripId = /^\/trips\/([^/]+)\/setup\/companions$/.exec(
    new URL(page.url()).pathname,
  )?.[1];
  expect(tripId).toBeTruthy();
  expect(tripId).not.toBe("new");
  return tripId!;
}

export const publishablePlan = {
  baseHeadcount: 2,
  routes: [
    {
      city: "오사카",
      arrivalDate: travelPeriod.startDate,
      departureDate: travelPeriod.endDate,
    },
  ],
  accommodations: [
    {
      id: "stay-osaka",
      city: "오사카",
      period: `${travelPeriod.startDate} ~ ${travelPeriod.endDate}`,
      nights: 3,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
  transports: [
    {
      id: "outbound-osaka",
      fromCity: "인천",
      toCity: "오사카",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED" as const,
    },
    {
      id: "return-osaka",
      fromCity: "오사카",
      toCity: "인천",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED" as const,
    },
  ],
  places: [],
} as const;
