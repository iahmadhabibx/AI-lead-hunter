-- Tighten Phase 0 tenant isolation for aijh_app.
-- Session bootstrap uses SECURITY DEFINER helpers (no tenant context at login).
-- background_tasks remain owner-scoped via app.current_user_id.

DROP POLICY IF EXISTS sessions_token_lookup ON "sessions";
DROP POLICY IF EXISTS sessions_insert ON "sessions";
DROP POLICY IF EXISTS sessions_update ON "sessions";
DROP POLICY IF EXISTS sessions_delete ON "sessions";
DROP POLICY IF EXISTS sessions_owner_all ON "sessions";

CREATE OR REPLACE FUNCTION auth_create_session(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  INSERT INTO sessions (user_id, token_hash, expires_at)
  VALUES (p_user_id, p_token_hash, p_expires_at)
  RETURNING id INTO sid;
  RETURN sid;
END;
$$;

CREATE OR REPLACE FUNCTION auth_find_valid_session(p_token_hash text)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  email varchar(320),
  display_name varchar(120),
  user_status user_status,
  user_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    u.id,
    u.email,
    u.display_name,
    u.status,
    u.created_at
  FROM sessions s
  INNER JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND u.status = 'active'
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION auth_revoke_session(p_token_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sessions
  SET revoked_at = now()
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION auth_create_session(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_find_valid_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_revoke_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_create_session(uuid, text, timestamptz) TO aijh_app;
GRANT EXECUTE ON FUNCTION auth_find_valid_session(text) TO aijh_app;
GRANT EXECUTE ON FUNCTION auth_revoke_session(text) TO aijh_app;

-- Direct session row access only for the authenticated tenant (e.g. future session list).
CREATE POLICY sessions_select_own ON "sessions"
  FOR SELECT TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true));

REVOKE INSERT, UPDATE, DELETE ON TABLE "sessions" FROM aijh_app;
GRANT SELECT ON TABLE "sessions" TO aijh_app;

-- Ensure background task policies exist and force RLS for non-owner roles.
DROP POLICY IF EXISTS background_tasks_owner_all ON "background_tasks";
CREATE POLICY background_tasks_owner_all ON "background_tasks"
  FOR ALL
  TO aijh_app
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

ALTER TABLE "background_tasks" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

-- App role should own runtime DML; owner role reserved for migrations.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "audit_events" TO aijh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "background_tasks" TO aijh_app;
