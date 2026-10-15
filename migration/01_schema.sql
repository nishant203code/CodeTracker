-- 1. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
    CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'problem_status') THEN
    CREATE TYPE public.problem_status AS ENUM ('solved', 'need_revision', 'mastered', 'forgotten', 'learning', 'practicing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_type') THEN
    CREATE TYPE public.platform_type AS ENUM ('leetcode', 'codeforces', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revision_outcome') THEN
    CREATE TYPE public.revision_outcome AS ENUM ('solved_again', 'forgot', 'too_easy', 'need_more_practice');
  END IF;
END $$;

-- 2. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.norm_problem_name(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT lower(regexp_replace(coalesce($1,''), '\s+', ' ', 'g')) $$;

-- 3. TABLES

-- 3.1 Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile trigger on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3.2 Problems
CREATE TABLE IF NOT EXISTS public.problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform public.platform_type NOT NULL DEFAULT 'other',
  problem_id TEXT,
  link TEXT,
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  topics TEXT[] NOT NULL DEFAULT '{}',
  pattern TEXT,
  notes TEXT,
  hints TEXT,
  solution_link TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  time_taken_minutes INTEGER,
  status public.problem_status NOT NULL DEFAULT 'solved',
  date_first_solved DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  last_solved_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  last_revised_at TIMESTAMPTZ,
  times_solved INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problems TO authenticated;
GRANT ALL ON public.problems TO service_role;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own problems" ON public.problems;
CREATE POLICY "Users manage own problems" ON public.problems
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS problems_user_created_idx ON public.problems (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS problems_pattern_idx ON public.problems (user_id, pattern);

CREATE UNIQUE INDEX IF NOT EXISTS problems_user_platform_pid_uidx
  ON public.problems (user_id, platform, problem_id)
  WHERE problem_id IS NOT NULL AND problem_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS problems_user_platform_normname_uidx
  ON public.problems (user_id, platform, public.norm_problem_name(name))
  WHERE problem_id IS NULL OR problem_id = '';

DROP TRIGGER IF EXISTS trg_problems_updated ON public.problems;
CREATE TRIGGER trg_problems_updated BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3.3 Revisions
CREATE TABLE IF NOT EXISTS public.revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems ON DELETE CASCADE,
  outcome public.revision_outcome NOT NULL,
  revised_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisions TO authenticated;
GRANT ALL ON public.revisions TO service_role;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own revisions" ON public.revisions;
CREATE POLICY "Users manage own revisions" ON public.revisions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS revisions_user_time_idx ON public.revisions (user_id, revised_at DESC);

-- 3.4 Revision Sessions
CREATE TABLE IF NOT EXISTS public.revision_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  mode TEXT NOT NULL DEFAULT 'smart',
  problem_count INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.revision_sessions TO authenticated;
GRANT ALL ON public.revision_sessions TO service_role;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own sessions" ON public.revision_sessions;
CREATE POLICY "Users read own sessions" ON public.revision_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own sessions" ON public.revision_sessions;
CREATE POLICY "Users insert own sessions" ON public.revision_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS revision_sessions_user_idx ON public.revision_sessions(user_id, generated_at DESC);

-- 3.5 Revision Session Items
CREATE TABLE IF NOT EXISTS public.revision_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  problem_name TEXT NOT NULL,
  priority_score NUMERIC NOT NULL,
  times_solved INTEGER NOT NULL,
  status TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  UNIQUE (session_id, position)
);
GRANT SELECT, INSERT ON public.revision_session_items TO authenticated;
GRANT ALL ON public.revision_session_items TO service_role;
ALTER TABLE public.revision_session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own session items" ON public.revision_session_items;
CREATE POLICY "Users read own session items" ON public.revision_session_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own session items" ON public.revision_session_items;
CREATE POLICY "Users insert own session items" ON public.revision_session_items
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.revision_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS revision_session_items_session_idx ON public.revision_session_items(session_id);

-- 3.6 App User Connections (GitHub OAuth tokens)
CREATE TABLE IF NOT EXISTS public.app_user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  connector_id TEXT NOT NULL,
  connection_key_ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- 3.7 Extension Tokens
CREATE TABLE IF NOT EXISTS public.extension_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extension_tokens TO service_role;
ALTER TABLE public.extension_tokens ENABLE ROW LEVEL SECURITY;

-- 3.8 GitHub Settings
CREATE TABLE IF NOT EXISTS public.github_settings (
  user_id UUID PRIMARY KEY,
  github_login TEXT,
  repo_owner TEXT,
  repo_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_settings TO authenticated;
GRANT ALL ON public.github_settings TO service_role;
ALTER TABLE public.github_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own github settings" ON public.github_settings;
CREATE POLICY "Users manage own github settings" ON public.github_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);