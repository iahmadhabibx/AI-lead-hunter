-- Runs once on first Postgres container init.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aijh_app') THEN
    CREATE ROLE aijh_app LOGIN PASSWORD 'aijh_app_dev_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE aijh TO aijh_app;
GRANT USAGE ON SCHEMA public TO aijh_app;
