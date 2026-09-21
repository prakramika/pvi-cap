-- One-time: create the local app database on native PostgreSQL 18.
-- Connect as the postgres superuser to the `postgres` database first.
--
-- pgAdmin: run block A, then disconnect and connect to pvi_cap, then run block B.
-- SQL Shell (psql): same, using \c pvi_cap between blocks.
--
-- App login after this: npm run db:migrate && npm run db:seed

-- A. Role + database (run against `postgres`)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvi') THEN
    CREATE ROLE pvi LOGIN PASSWORD 'pvi';
  END IF;
END
$$;

SELECT 'Database pvi_cap already exists — skip CREATE DATABASE'
WHERE EXISTS (SELECT FROM pg_database WHERE datname = 'pvi_cap');

-- If the SELECT above returned no row, run:
-- CREATE DATABASE pvi_cap OWNER pvi;

-- B. Privileges (run after connecting to `pvi_cap`)
GRANT ALL ON SCHEMA public TO pvi;
ALTER SCHEMA public OWNER TO pvi;
