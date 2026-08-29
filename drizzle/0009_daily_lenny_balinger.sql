CREATE TABLE "explore_plan_saves" (
	"participant_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explore_plan_saves_participant_listing_pk" PRIMARY KEY("participant_id","listing_id")
);
--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD CONSTRAINT "explore_plan_saves_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD CONSTRAINT "explore_plan_saves_listing_id_explore_plan_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."explore_plan_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "explore_plan_saves_participant_saved_idx" ON "explore_plan_saves" USING btree ("participant_id","saved_at" DESC NULLS LAST,"listing_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "explore_plan_saves_listing_idx" ON "explore_plan_saves" USING btree ("listing_id");

--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.explore_plan_saves
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.explore_plan_saves
TO galanda_worker;