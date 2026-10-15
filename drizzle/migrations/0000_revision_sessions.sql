CREATE TABLE public.revision_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'smart',
  problem_count integer NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.revision_sessions TO authenticated;
GRANT ALL ON public.revision_sessions TO service_role;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sessions" ON public.revision_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.revision_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX revision_sessions_user_idx ON public.revision_sessions(user_id, generated_at DESC);

CREATE TABLE public.revision_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  problem_id uuid REFERENCES public.problems(id) ON DELETE SET NULL,
  position integer NOT NULL,
  problem_name text NOT NULL,
  priority_score numeric NOT NULL,
  times_solved integer NOT NULL,
  status text NOT NULL,
  difficulty text NOT NULL,
  UNIQUE (session_id, position)
);
GRANT SELECT, INSERT ON public.revision_session_items TO authenticated;
GRANT ALL ON public.revision_session_items TO service_role;
ALTER TABLE public.revision_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own session items" ON public.revision_session_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own session items" ON public.revision_session_items FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.revision_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE INDEX revision_session_items_session_idx ON public.revision_session_items(session_id);