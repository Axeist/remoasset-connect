-- ============================================================
-- Agent Chat Sessions — persist vendor agent chat history
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_chat_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL DEFAULT 'New Session',
  messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Summary stats for the session
  leads_created   INTEGER NOT NULL DEFAULT 0,
  emails_sent     INTEGER NOT NULL DEFAULT 0,
  -- Lifecycle
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions; admins can see all
CREATE POLICY "Users can manage own chat sessions"
  ON public.agent_chat_sessions
  FOR ALL
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user
  ON public.agent_chat_sessions (user_id, last_message_at DESC);
