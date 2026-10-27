CREATE TYPE "public"."cv_document_status" AS ENUM('uploaded', 'processing', 'extracted', 'failed');
CREATE TYPE "public"."profile_version_status" AS ENUM('pending_review', 'approved', 'superseded');

CREATE TABLE IF NOT EXISTS "cv_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "detected_format" varchar(16) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "content_hash" text NOT NULL,
  "storage_path" text NOT NULL,
  "status" "public"."cv_document_status" DEFAULT 'uploaded' NOT NULL,
  "error_message" text,
  "extracted_text_chars" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cv_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "candidate_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "active_version_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "candidate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "candidate_profile_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "status" "public"."profile_version_status" DEFAULT 'pending_review' NOT NULL,
  "schema_version" varchar(32) NOT NULL,
  "payload" jsonb NOT NULL,
  "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_document_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "approved_at" timestamp with time zone,
  "error_message" text,
  CONSTRAINT "candidate_profile_versions_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."candidate_profiles"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "candidate_profile_versions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "candidate_profile_versions_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."cv_documents"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "cv_documents_user_id_idx" ON "cv_documents" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "cv_documents_status_idx" ON "cv_documents" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_user_id_uidx" ON "candidate_profiles" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "candidate_profile_versions_user_id_idx" ON "candidate_profile_versions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "candidate_profile_versions_profile_id_idx" ON "candidate_profile_versions" USING btree ("profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profile_versions_profile_version_uidx" ON "candidate_profile_versions" USING btree ("profile_id","version_number");

ALTER TABLE "candidate_profiles"
  ADD CONSTRAINT "candidate_profiles_active_version_id_fk"
  FOREIGN KEY ("active_version_id") REFERENCES "public"."candidate_profile_versions"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "cv_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_profile_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cv_documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "candidate_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "candidate_profile_versions" FORCE ROW LEVEL SECURITY;

CREATE POLICY cv_documents_owner_all ON "cv_documents"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY candidate_profiles_owner_all ON "candidate_profiles"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY candidate_profile_versions_owner_all ON "candidate_profile_versions"
  FOR ALL TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cv_documents" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "candidate_profiles" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "candidate_profile_versions" TO aijh_app;
