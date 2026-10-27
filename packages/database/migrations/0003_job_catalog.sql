CREATE TYPE "public"."job_listing_status" AS ENUM('active', 'stale', 'closed', 'unknown');
CREATE TYPE "public"."job_source_provider" AS ENUM('greenhouse', 'lever');

CREATE TABLE IF NOT EXISTS "job_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(120) NOT NULL,
  "provider" "public"."job_source_provider" NOT NULL,
  "display_name" varchar(200),
  "config" jsonb NOT NULL,
  "enabled" varchar(8) DEFAULT 'true' NOT NULL,
  "last_health_ok" varchar(8),
  "last_health_detail" text,
  "last_health_at" timestamp with time zone,
  "last_ingest_at" timestamp with time zone,
  "last_ingest_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_sources_key_uidx" ON "job_sources" USING btree ("key");

CREATE TABLE IF NOT EXISTS "canonical_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_hash" text NOT NULL,
  "normalization_version" varchar(32) NOT NULL,
  "title" text NOT NULL,
  "company_name" text,
  "location_text" text,
  "description_text" text,
  "description_html" text,
  "apply_url" text NOT NULL,
  "source_attribution" text NOT NULL,
  "departments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "offices" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "work_mode" varchar(32) DEFAULT 'unknown' NOT NULL,
  "status" "public"."job_listing_status" DEFAULT 'active' NOT NULL,
  "payload" jsonb NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_jobs_content_hash_uidx" ON "canonical_jobs" USING btree ("content_hash");
CREATE INDEX IF NOT EXISTS "canonical_jobs_status_idx" ON "canonical_jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "canonical_jobs_last_seen_idx" ON "canonical_jobs" USING btree ("last_seen_at");

CREATE TABLE IF NOT EXISTS "source_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL,
  "source_job_id" varchar(200) NOT NULL,
  "dedupe_key" varchar(320) NOT NULL,
  "canonical_job_id" uuid,
  "status" "public"."job_listing_status" DEFAULT 'active' NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "apply_url" text,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "source_jobs_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "source_jobs_canonical_job_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE set null ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "source_jobs_source_job_uidx" ON "source_jobs" USING btree ("source_id","source_job_id");
CREATE UNIQUE INDEX IF NOT EXISTS "source_jobs_dedupe_key_uidx" ON "source_jobs" USING btree ("dedupe_key");
CREATE INDEX IF NOT EXISTS "source_jobs_canonical_idx" ON "source_jobs" USING btree ("canonical_job_id");

CREATE TABLE IF NOT EXISTS "job_source_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_job_id" uuid NOT NULL,
  "source_job_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "job_source_links_canonical_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "job_source_links_source_job_fk" FOREIGN KEY ("source_job_id") REFERENCES "public"."source_jobs"("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_source_links_pair_uidx" ON "job_source_links" USING btree ("canonical_job_id","source_job_id");

-- Catalog tables are shared (not per-user). Grant app role full DML; no tenant RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "job_sources" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "canonical_jobs" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "source_jobs" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "job_source_links" TO aijh_app;
