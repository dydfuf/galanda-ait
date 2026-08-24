CREATE TABLE "confirmed_itineraries" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"source_plan_id" text NOT NULL,
	"source_plan_revision" integer NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "confirmed_itineraries_trip_id_unique" UNIQUE("trip_id"),
	CONSTRAINT "confirmed_itineraries_source_revision_positive" CHECK ("confirmed_itineraries"."source_plan_revision" >= 1),
	CONSTRAINT "confirmed_itineraries_current_revision_positive" CHECK ("confirmed_itineraries"."current_revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "itinerary_revisions" (
	"itinerary_id" text NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_revisions_itinerary_id_revision_pk" PRIMARY KEY("itinerary_id","revision"),
	CONSTRAINT "itinerary_revisions_revision_positive" CHECK ("itinerary_revisions"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "confirmed_itineraries" ADD CONSTRAINT "confirmed_itineraries_trip_id_trip_rooms_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmed_itineraries" ADD CONSTRAINT "confirmed_itineraries_created_by_participant_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_revisions" ADD CONSTRAINT "itinerary_revisions_itinerary_id_confirmed_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."confirmed_itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_revisions" ADD CONSTRAINT "itinerary_revisions_changed_by_participant_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."participant"("id") ON DELETE no action ON UPDATE no action;