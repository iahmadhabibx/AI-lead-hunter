CREATE TYPE "public"."match_band" AS ENUM('eligible', 'needs_verification', 'ineligible');
--> statement-breakpoint
CREATE TYPE "public"."feedback_event_type" AS ENUM('interested', 'saved', 'unsaved', 'rejected', 'applied', 'interview_received', 'offer_received', 'marked_expired', 'marked_irrelevant');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "profile_version_id" uuid NOT NULL,
  "canonical_job_id" uuid NOT NULL,
  "scoring_version" varchar(32) NOT NULL,
  "job_content_hash" text NOT NULL,
  "band" "match_band" NOT NULL,
  "suitability_percent" real,
  "breakdown" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "match_results_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "match_results_profile_version_fk" FOREIGN KEY ("profile_version_id") REFERENCES "public"."candidate_profile_versions"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "match_results_canonical_job_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_results_unique_uidx" ON "match_results" USING btree ("user_id","profile_version_id","canonical_job_id","scoring_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_results_user_id_idx" ON "match_results" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_results_band_idx" ON "match_results" USING btree ("band");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "canonical_job_id" uuid NOT NULL,
  "match_result_id" uuid,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "saved_jobs_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "saved_jobs_canonical_job_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "saved_jobs_match_result_fk" FOREIGN KEY ("match_result_id") REFERENCES "public"."match_results"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saved_jobs_user_job_uidx" ON "saved_jobs" USING btree ("user_id","canonical_job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_jobs_user_id_idx" ON "saved_jobs" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "canonical_job_id" uuid NOT NULL,
  "match_result_id" uuid,
  "type" "feedback_event_type" NOT NULL,
  "rejection_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feedback_events_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "feedback_events_canonical_job_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "feedback_events_match_result_fk" FOREIGN KEY ("match_result_id") REFERENCES "public"."match_results"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_events_user_id_idx" ON "feedback_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_events_job_idx" ON "feedback_events" USING btree ("canonical_job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_events_created_at_idx" ON "feedback_events" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE "match_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_results" FORCE ROW LEVEL SECURITY;
ALTER TABLE "saved_jobs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "feedback_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY match_results_owner_all ON "match_results"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
--> statement-breakpoint
CREATE POLICY saved_jobs_owner_all ON "saved_jobs"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
--> statement-breakpoint
CREATE POLICY feedback_events_owner_all ON "feedback_events"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "match_results" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "saved_jobs" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "feedback_events" TO aijh_app;
