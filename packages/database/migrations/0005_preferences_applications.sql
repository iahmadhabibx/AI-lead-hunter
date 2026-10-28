CREATE TYPE "public"."learned_preference_status" AS ENUM('active', 'reset');
--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('drafting', 'ready_for_review', 'approved', 'applied', 'withdrawn', 'archived');
--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('tailored_cv', 'cover_letter', 'application_answers');
--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'pending_review', 'approved', 'superseded');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learned_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "status" "learned_preference_status" DEFAULT 'active' NOT NULL,
  "learning_version" varchar(32) NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reset_at" timestamp with time zone,
  CONSTRAINT "learned_preferences_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learned_preferences_user_version_uidx" ON "learned_preferences" USING btree ("user_id","version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learned_preferences_user_id_idx" ON "learned_preferences" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "canonical_job_id" uuid NOT NULL,
  "profile_version_id" uuid NOT NULL,
  "match_result_id" uuid,
  "status" "application_status" DEFAULT 'drafting' NOT NULL,
  "official_apply_url" text NOT NULL,
  "note" text,
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "applications_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "applications_job_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."canonical_jobs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "applications_profile_version_fk" FOREIGN KEY ("profile_version_id") REFERENCES "public"."candidate_profile_versions"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "applications_match_result_fk" FOREIGN KEY ("match_result_id") REFERENCES "public"."match_results"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "applications_user_job_uidx" ON "applications" USING btree ("user_id","canonical_job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_user_id_idx" ON "applications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generated_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "application_id" uuid NOT NULL,
  "type" "document_type" NOT NULL,
  "version_number" integer NOT NULL,
  "status" "document_status" DEFAULT 'draft' NOT NULL,
  "generation_version" varchar(32) NOT NULL,
  "title" text NOT NULL,
  "content_markdown" text NOT NULL,
  "payload" jsonb NOT NULL,
  "provenance" jsonb NOT NULL,
  "unsupported_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "generated_documents_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "generated_documents_application_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "generated_documents_app_type_version_uidx" ON "generated_documents" USING btree ("application_id","type","version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_documents_user_id_idx" ON "generated_documents" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_documents_application_id_idx" ON "generated_documents" USING btree ("application_id");
--> statement-breakpoint
ALTER TABLE "learned_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learned_preferences" FORCE ROW LEVEL SECURITY;
ALTER TABLE "applications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "generated_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learned_preferences_owner_all ON "learned_preferences"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
--> statement-breakpoint
CREATE POLICY applications_owner_all ON "applications"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
--> statement-breakpoint
CREATE POLICY generated_documents_owner_all ON "generated_documents"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "learned_preferences" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "applications" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "generated_documents" TO aijh_app;
