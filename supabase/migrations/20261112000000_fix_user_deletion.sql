-- Deleting a user failed with "Database error deleting user" for anyone who had ever logged an
-- activity, follow-up or task: the earlier fix set those foreign keys to ON DELETE SET NULL, but the
-- columns were still NOT NULL, so Postgres refused to blank them. This makes the behaviour consistent:
--   * rows that belong to the user (profile, roles, notifications, API keys) are removed with them
--   * everything else keeps its history; the author/owner/assignee simply becomes empty
DO $$
DECLARE
  r record;
  is_pk boolean;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid, c.conrelid::regclass AS tbl, c.conkey, c.confdeltype, a.attname, a.attnotnull
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
  LOOP
    is_pk := EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = r.conrelid AND i.indisprimary AND r.conkey[1] = ANY (i.indkey)
    );

    IF r.tbl::text IN ('profiles', 'user_roles', 'notifications', 'api_keys') OR is_pk THEN
      IF r.confdeltype <> 'c' THEN
        EXECUTE format(
          'ALTER TABLE %s DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
          r.tbl, r.conname, r.conname, r.attname);
      END IF;
    ELSE
      IF r.attnotnull THEN
        EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.tbl, r.attname);
      END IF;
      IF r.confdeltype <> 'n' THEN
        EXECUTE format(
          'ALTER TABLE %s DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
          r.tbl, r.conname, r.conname, r.attname);
      END IF;
    END IF;
  END LOOP;
END $$;
