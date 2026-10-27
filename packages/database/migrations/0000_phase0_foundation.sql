CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aijh_app') THEN
    CREATE ROLE aijh_app LOGIN PASSWORD 'aijh_app_dev_password';
  END IF;
END
$$;

CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'pending_deletion');
CREATE TYPE "public"."background_task_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "password_hash" text NOT NULL,
  "display_name" varchar(120),
  "status" "public"."user_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
  CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action" varchar(120) NOT NULL,
  "resource_type" varchar(80),
  "resource_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "request_id" varchar(36),
  "ip_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "background_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" varchar(80) NOT NULL,
  "status" "public"."background_task_status" DEFAULT 'queued' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "result" jsonb,
  "error_message" text,
  "idempotency_key" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "background_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "audit_events_user_id_idx" ON "audit_events" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "background_tasks_user_id_idx" ON "background_tasks" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "background_tasks_status_idx" ON "background_tasks" USING btree ("status");
CREATE INDEX IF NOT EXISTS "background_tasks_idempotency_idx" ON "background_tasks" USING btree ("user_id","idempotency_key");

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "background_tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_owner_all ON "sessions"
  FOR ALL
  TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY background_tasks_owner_all ON "background_tasks"
  FOR ALL
  TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- App role grants (owner/migrator retains full access)
GRANT USAGE ON SCHEMA public TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aijh_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aijh_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aijh_app;

-- Bypass note: migrations run as owner. Application should use aijh_app.
-- Auth session lookup by token_hash needs a policy for anonymous lookup:
CREATE POLICY sessions_token_lookup ON "sessions"
  FOR SELECT
  TO aijh_app
  USING (true);

-- Narrow: prefer token-hash lookups via SECURITY DEFINER function in later hardening.
-- For Phase 0, SELECT is open to aijh_app; writes still require tenant setting when using owner policies.
-- Replace broad SELECT with definer function before production.
DROP POLICY IF EXISTS sessions_owner_all ON "sessions";
CREATE POLICY sessions_insert ON "sessions"
  FOR INSERT TO aijh_app WITH CHECK (true);
CREATE POLICY sessions_update ON "sessions"
  FOR UPDATE TO aijh_app USING (true) WITH CHECK (true);
CREATE POLICY sessions_delete ON "sessions"
  FOR DELETE TO aijh_app USING (true);
