CREATE TABLE "participant_alias" (
	"alias_participant_id" text PRIMARY KEY NOT NULL,
	"canonical_participant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_alias_not_self" CHECK ("participant_alias"."alias_participant_id" <> "participant_alias"."canonical_participant_id")
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "participant_alias" ADD CONSTRAINT "participant_alias_alias_participant_id_participant_id_fk" FOREIGN KEY ("alias_participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_alias" ADD CONSTRAINT "participant_alias_canonical_participant_id_participant_id_fk" FOREIGN KEY ("canonical_participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_alias_canonical_idx" ON "participant_alias" USING btree ("canonical_participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_auth_user_id_uidx" ON "participant" USING btree ("auth_user_id");
--> statement-breakpoint
INSERT INTO "participant" ("id", "auth_user_id")
SELECT "id", "id" FROM "user"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
	public.participant,
	public.participant_alias
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
	public.participant,
	public.participant_alias
TO galanda_worker;
