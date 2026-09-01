DROP INDEX "explore_plan_saves_participant_saved_idx";--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD COLUMN "save_cycle" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD COLUMN "unsaved_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "explore_plan_saves_active_uidx" ON "explore_plan_saves" USING btree ("participant_id","listing_id") WHERE "explore_plan_saves"."unsaved_at" is null;--> statement-breakpoint
CREATE INDEX "explore_plan_saves_listing_history_idx" ON "explore_plan_saves" USING btree ("listing_id","participant_id","saved_at","unsaved_at");--> statement-breakpoint
CREATE INDEX "explore_plan_saves_participant_saved_idx" ON "explore_plan_saves" USING btree ("participant_id","saved_at" DESC NULLS LAST,"listing_id" DESC NULLS LAST) WHERE "explore_plan_saves"."unsaved_at" is null;--> statement-breakpoint
ALTER TABLE "explore_plan_saves" DROP CONSTRAINT "explore_plan_saves_participant_listing_pk";
--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD CONSTRAINT "explore_plan_saves_participant_listing_pk" PRIMARY KEY("participant_id","listing_id","save_cycle");--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD CONSTRAINT "explore_plan_saves_save_cycle_check" CHECK ("explore_plan_saves"."save_cycle" >= 1);--> statement-breakpoint
ALTER TABLE "explore_plan_saves" ADD CONSTRAINT "explore_plan_saves_interval_check" CHECK ("explore_plan_saves"."unsaved_at" is null or "explore_plan_saves"."unsaved_at" >= "explore_plan_saves"."saved_at");
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.explore_plan_saves
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.explore_plan_saves
TO galanda_worker;
