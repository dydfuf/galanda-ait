CREATE SEQUENCE "public"."trip_activity_sequence" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "trip_activity_events" (
	"sequence" bigint PRIMARY KEY DEFAULT nextval('trip_activity_sequence') NOT NULL,
	"trip_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_participant_id" text NOT NULL,
	"actor_display_name" text,
	"subject_plan_id" text,
	"subject_title" text,
	"room_revision" integer,
	"itinerary_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_activity_events_event_type_check" CHECK ("trip_activity_events"."event_type" IN (
        'PLAN_CREATED',
        'PLAN_UPDATED',
        'PLAN_DELETED',
        'OPINION_SUBMITTED',
        'OPINION_UPDATED',
        'PLAN_CONFIRMED',
        'ITINERARY_REVISED'
      ))
);
--> statement-breakpoint
CREATE TABLE "trip_activity_reads" (
	"trip_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"last_seen_sequence" bigint NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_activity_reads_trip_id_participant_id_pk" PRIMARY KEY("trip_id","participant_id")
);
--> statement-breakpoint
ALTER TABLE "trip_activity_events" ADD CONSTRAINT "trip_activity_events_trip_id_trip_rooms_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_activity_events" ADD CONSTRAINT "trip_activity_events_actor_participant_id_participant_id_fk" FOREIGN KEY ("actor_participant_id") REFERENCES "public"."participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_activity_reads" ADD CONSTRAINT "trip_activity_reads_trip_id_trip_rooms_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_activity_reads" ADD CONSTRAINT "trip_activity_reads_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_activity_events_trip_seq_idx" ON "trip_activity_events" USING btree ("trip_id","sequence");--> statement-breakpoint
CREATE INDEX "trip_activity_events_trip_actor_seq_idx" ON "trip_activity_events" USING btree ("trip_id","actor_participant_id","sequence");--> statement-breakpoint
CREATE INDEX "trip_activity_reads_participant_trip_idx" ON "trip_activity_reads" USING btree ("participant_id","trip_id");
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.trip_activity_events, public.trip_activity_reads
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_activity_events, public.trip_activity_reads
TO galanda_worker;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SEQUENCE public.trip_activity_sequence
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE public.trip_activity_sequence
TO galanda_worker;