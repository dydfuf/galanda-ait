CREATE TABLE "trip_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"places" jsonb,
	"processed_at" timestamp with time zone,
	"link_status" text DEFAULT 'NOT_READ' NOT NULL,
	CONSTRAINT "trip_resources_revision_check" CHECK ("trip_resources"."revision" >= 1),
	CONSTRAINT "trip_resources_link_status_check" CHECK ("trip_resources"."link_status" in ('NOT_READ', 'READ', 'UNAVAILABLE')),
	CONSTRAINT "trip_resources_source_check" CHECK (length(btrim("trip_resources"."url")) > 0 or length(btrim("trip_resources"."note")) > 0),
	CONSTRAINT "trip_resources_source_length_check" CHECK (length("trip_resources"."url") <= 2048 and length("trip_resources"."note") <= 20000),
	CONSTRAINT "trip_resources_places_check" CHECK ("trip_resources"."places" is null or (jsonb_typeof("trip_resources"."places") = 'array' and jsonb_array_length("trip_resources"."places") <= 20))
);
--> statement-breakpoint
ALTER TABLE "trip_resources" ADD CONSTRAINT "trip_resources_trip_id_trip_rooms_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_resources" ADD CONSTRAINT "trip_resources_created_by_participant_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_resources_trip_created_idx" ON "trip_resources" USING btree ("trip_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.trip_resources FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_resources TO galanda_worker;
