
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- enums
CREATE TYPE public.difficulty_level AS ENUM ('easy','medium','hard');
CREATE TYPE public.problem_status AS ENUM ('solved','need_revision','mastered','forgotten');
CREATE TYPE public.platform_type AS ENUM ('leetcode','codeforces','other');

-- problems
CREATE TABLE public.problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform public.platform_type NOT NULL DEFAULT 'other',
  problem_id TEXT,
  link TEXT,
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  topics TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  hints TEXT,
  solution_link TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  confidence SMALLINT NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  time_taken_minutes INTEGER,
  status public.problem_status NOT NULL DEFAULT 'solved',
  date_first_solved DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  last_revised_at TIMESTAMPTZ,
  revision_count INTEGER NOT NULL DEFAULT 0,
  times_solved INTEGER NOT NULL DEFAULT 1,
  interval_index SMALLINT NOT NULL DEFAULT 0,
  next_revision_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date + 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problems TO authenticated;
GRANT ALL ON public.problems TO service_role;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own problems" ON public.problems FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX problems_user_next_rev_idx ON public.problems (user_id, next_revision_date);
CREATE INDEX problems_user_created_idx ON public.problems (user_id, created_at DESC);

-- revisions
CREATE TYPE public.revision_outcome AS ENUM ('solved_again','forgot','too_easy','need_more_practice');

CREATE TABLE public.revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems ON DELETE CASCADE,
  outcome public.revision_outcome NOT NULL,
  confidence_before SMALLINT,
  confidence_after SMALLINT,
  revised_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisions TO authenticated;
GRANT ALL ON public.revisions TO service_role;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own revisions" ON public.revisions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX revisions_user_time_idx ON public.revisions (user_id, revised_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_problems_updated BEFORE UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
