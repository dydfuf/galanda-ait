CREATE TABLE "trip_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"destination" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_plan_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
