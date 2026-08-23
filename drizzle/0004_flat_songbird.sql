CREATE TABLE "trip_invite" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"issued_by_participant_id" text NOT NULL,
	"inviter_name" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_invite" ADD CONSTRAINT "trip_invite_trip_id_trip_rooms_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_invite" ADD CONSTRAINT "trip_invite_issued_by_participant_id_participant_id_fk" FOREIGN KEY ("issued_by_participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_invite_token_hash_uidx" ON "trip_invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "trip_invite_expires_at_idx" ON "trip_invite" USING btree ("expires_at");
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.trip_invite FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_invite TO galanda_worker;
