CREATE TABLE "itinerary_acknowledgements" (
	"itinerary_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"acknowledged_revision" integer NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_acknowledgements_itinerary_id_participant_id_pk" PRIMARY KEY("itinerary_id","participant_id"),
	CONSTRAINT "itinerary_acknowledgements_revision_positive" CHECK ("itinerary_acknowledgements"."acknowledged_revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "itinerary_revisions" ADD COLUMN "changes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "itinerary_acknowledgements" ADD CONSTRAINT "itinerary_acknowledgements_itinerary_id_confirmed_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."confirmed_itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_acknowledgements" ADD CONSTRAINT "itinerary_acknowledgements_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;