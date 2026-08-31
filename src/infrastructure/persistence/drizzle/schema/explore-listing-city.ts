import { index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { explorePlanListings } from "./explore-plan.ts";

/** Canonical route-city sidecar for public Explore listing aggregation/filtering. */
export const exploreListingCities = pgTable(
  "explore_listing_cities",
  {
    listingId: text("listing_id")
      .notNull()
      .references(() => explorePlanListings.id, { onDelete: "cascade" }),
    cityId: text("city_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "explore_listing_cities_pk",
      columns: [table.listingId, table.cityId],
    }),
    index("explore_listing_cities_city_idx").on(table.cityId, table.listingId),
  ]
);

export type ExploreListingCityRow = typeof exploreListingCities.$inferSelect;
export type NewExploreListingCityRow = typeof exploreListingCities.$inferInsert;
