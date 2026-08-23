DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'galanda_worker') THEN
		CREATE ROLE galanda_worker
			NOLOGIN
			NOSUPERUSER
			NOCREATEDB
			NOCREATEROLE
			NOREPLICATION
			NOBYPASSRLS;
	ELSIF EXISTS (
		SELECT 1
		FROM pg_roles
		WHERE rolname = 'galanda_worker'
			AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
	) THEN
		RAISE EXCEPTION 'galanda_worker has an administrative role attribute';
	END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
	public."user",
	public."session",
	public.account,
	public.verification,
	public.trip_rooms
FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
	REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
	REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
	REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
	REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO galanda_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
	public."user",
	public."session",
	public.account,
	public.verification,
	public.trip_rooms
TO galanda_worker;
