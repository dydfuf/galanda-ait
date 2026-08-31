CREATE TABLE "explore_listing_cities" (
	"listing_id" text NOT NULL,
	"city_id" text NOT NULL,
	CONSTRAINT "explore_listing_cities_pk" PRIMARY KEY("listing_id","city_id")
);
--> statement-breakpoint
ALTER TABLE "explore_listing_cities" ADD CONSTRAINT "explore_listing_cities_listing_id_explore_plan_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."explore_plan_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "explore_listing_cities_city_idx" ON "explore_listing_cities" USING btree ("city_id","listing_id");
--> statement-breakpoint
-- Backfill both LISTED and UNLISTED immutable snapshots. The expression normalizes
-- whitespace/case and full-width ASCII equivalents needed by the v1 aliases; unknown
-- route text is intentionally omitted. Snapshot/lifecycle columns are not updated.
INSERT INTO public.explore_listing_cities (listing_id, city_id)
SELECT DISTINCT
	l.id,
	CASE normalized.city
		WHEN '서울' THEN 'seoul'
		WHEN '서울시' THEN 'seoul'
		WHEN 'seoul' THEN 'seoul'
		WHEN '부산' THEN 'busan'
		WHEN '부산시' THEN 'busan'
		WHEN 'busan' THEN 'busan'
		WHEN '제주' THEN 'jeju'
		WHEN '제주도' THEN 'jeju'
		WHEN '제주시' THEN 'jeju'
		WHEN 'jeju' THEN 'jeju'
		WHEN '도쿄' THEN 'tokyo'
		WHEN '동경' THEN 'tokyo'
		WHEN 'tokyo' THEN 'tokyo'
		WHEN '오사카' THEN 'osaka'
		WHEN 'osaka' THEN 'osaka'
		WHEN '교토' THEN 'kyoto'
		WHEN 'kyoto' THEN 'kyoto'
		WHEN '나고야' THEN 'nagoya'
		WHEN 'nagoya' THEN 'nagoya'
		WHEN '하코네' THEN 'hakone'
		WHEN 'hakone' THEN 'hakone'
		WHEN '요코하마' THEN 'yokohama'
		WHEN 'yokohama' THEN 'yokohama'
	END
FROM public.explore_plan_listings AS l
CROSS JOIN LATERAL jsonb_array_elements(
	COALESCE(l.snapshot -> 'routes', '[]'::jsonb)
) AS route
CROSS JOIN LATERAL (
	SELECT lower(
		btrim(
			regexp_replace(
				translate(
					route ->> 'city',
					'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９　',
					'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '
				),
				'\s+', ' ', 'g'
			)
		)
	) AS city
) AS normalized
WHERE normalized.city IN (
	'서울', '서울시', 'seoul', '부산', '부산시', 'busan',
	'제주', '제주도', '제주시', 'jeju', '도쿄', '동경', 'tokyo',
	'오사카', 'osaka', '교토', 'kyoto', '나고야', 'nagoya',
	'하코네', 'hakone', '요코하마', 'yokohama'
)
ON CONFLICT (listing_id, city_id) DO NOTHING;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.explore_listing_cities
FROM anon, authenticated, service_role;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.explore_listing_cities
TO galanda_worker;
