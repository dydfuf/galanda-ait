\set ON_ERROR_STOP on

DO $$
DECLARE
	public_role name;
	app_table name;
	app_privilege text;
BEGIN
	FOREACH public_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']::name[] LOOP
		FOREACH app_table IN ARRAY ARRAY['user', 'session', 'account', 'verification', 'participant', 'participant_alias', 'trip_rooms', 'trip_invite', 'confirmed_itineraries', 'itinerary_revisions', 'itinerary_acknowledgements']::name[] LOOP
			FOREACH app_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
				IF has_table_privilege(public_role, format('public.%I', app_table), app_privilege) THEN
					RAISE EXCEPTION '% still has % on public.%', public_role, app_privilege, app_table;
				END IF;
			END LOOP;
		END LOOP;

		IF EXISTS (
			SELECT 1
			FROM pg_default_acl AS defaults
			CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
			WHERE defaults.defaclrole = 'postgres'::regrole
				AND defaults.defaclnamespace = 'public'::regnamespace
				AND privilege.grantee = public_role::text::regrole
				AND defaults.defaclobjtype IN ('r', 'S', 'f')
		) THEN
			RAISE EXCEPTION '% still has public schema default privileges', public_role;
		END IF;
	END LOOP;

	IF EXISTS (
		SELECT 1
		FROM pg_default_acl AS defaults
		CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
		WHERE defaults.defaclrole = 'postgres'::regrole
			AND defaults.defaclobjtype = 'f'
			AND privilege.grantee = 0
			AND privilege.privilege_type = 'EXECUTE'
	) THEN
		RAISE EXCEPTION 'PUBLIC still has default EXECUTE on postgres functions';
	END IF;

	FOREACH app_table IN ARRAY ARRAY['user', 'session', 'account', 'verification', 'participant', 'participant_alias', 'trip_rooms', 'trip_invite', 'confirmed_itineraries', 'itinerary_revisions', 'itinerary_acknowledgements']::name[] LOOP
		FOREACH app_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
			IF NOT has_table_privilege('galanda_worker', format('public.%I', app_table), app_privilege) THEN
				RAISE EXCEPTION 'galanda_worker lacks % on public.%', app_privilege, app_table;
			END IF;
		END LOOP;
	END LOOP;

	IF has_schema_privilege('galanda_worker', 'public', 'CREATE') THEN
		RAISE EXCEPTION 'galanda_worker can create objects in public';
	END IF;

	IF has_database_privilege('galanda_worker', current_database(), 'CREATE') THEN
		RAISE EXCEPTION 'galanda_worker can create schemas in the application database';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_namespace
		WHERE nspname <> 'public'
			AND nspname <> 'information_schema'
			AND nspname NOT LIKE 'pg\_%' ESCAPE '\'
			AND has_schema_privilege('galanda_worker', oid, 'USAGE')
	) THEN
		RAISE EXCEPTION 'galanda_worker can use a non-application schema';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_roles
		WHERE rolname = 'galanda_worker'
			AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
	) THEN
		RAISE EXCEPTION 'galanda_worker has an administrative role attribute';
	END IF;
END
$$;

BEGIN;

CREATE TABLE public.raon_204_default_privilege_probe (id integer);

DO $$
DECLARE
	public_role name;
BEGIN
	FOREACH public_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']::name[] LOOP
		IF has_table_privilege(public_role, 'public.raon_204_default_privilege_probe', 'SELECT, INSERT, UPDATE, DELETE') THEN
			RAISE EXCEPTION '% received default privileges on the probe table', public_role;
		END IF;
	END LOOP;

	IF has_table_privilege('galanda_worker', 'public.raon_204_default_privilege_probe', 'SELECT, INSERT, UPDATE, DELETE') THEN
		RAISE EXCEPTION 'galanda_worker can access a table outside its allowlist';
	END IF;
END
$$;

ROLLBACK;

SELECT 'database privileges verified' AS result;
