CREATE TABLE "explore_plan_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"source_trip_id" text NOT NULL,
	"source_plan_id" text NOT NULL,
	"source_author_participant_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text NOT NULL,
	"listing_revision" integer DEFAULT 1 NOT NULL,
	"source_plan_revision" integer NOT NULL,
	"listed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlisted_at" timestamp with time zone,
	CONSTRAINT "explore_plan_listings_status_check" CHECK ("explore_plan_listings"."status" in ('LISTED', 'UNLISTED')),
	CONSTRAINT "explore_plan_listings_listing_revision_positive" CHECK ("explore_plan_listings"."listing_revision" >= 1),
	CONSTRAINT "explore_plan_listings_source_revision_positive" CHECK ("explore_plan_listings"."source_plan_revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "explore_plan_listings" ADD CONSTRAINT "explore_plan_listings_source_author_participant_id_participant_id_fk" FOREIGN KEY ("source_author_participant_id") REFERENCES "public"."participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "explore_plan_listings_source_uidx" ON "explore_plan_listings" USING btree ("source_trip_id","source_plan_id");--> statement-breakpoint
CREATE INDEX "explore_plan_listings_feed_idx" ON "explore_plan_listings" USING btree ("status","listed_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.explore_plan_listings
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.explore_plan_listings
TO galanda_worker;
