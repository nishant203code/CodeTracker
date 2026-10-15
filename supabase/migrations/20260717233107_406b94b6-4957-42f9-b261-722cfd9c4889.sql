-- Add last_solved_date and enforce per-user problem uniqueness
ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS last_solved_date date;

UPDATE public.problems
  SET last_solved_date = date_first_solved
  WHERE last_solved_date IS NULL;

ALTER TABLE public.problems
  ALTER COLUMN last_solved_date SET NOT NULL,
  ALTER COLUMN last_solved_date SET DEFAULT ((now() AT TIME ZONE 'utc')::date);

-- Normalized-name helper (immutable so it's index-safe)
CREATE OR REPLACE FUNCTION public.norm_problem_name(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT lower(regexp_replace(coalesce($1,''), '\s+', ' ', 'g')) $$;

-- Deduplicate any pre-existing rows before enforcing unique indexes.
-- Keep the earliest row per (user, platform, problem_id) and merge stats into it.
WITH ranked AS (
  SELECT id, user_id, platform, problem_id, times_solved, date_first_solved, last_solved_date,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, platform, problem_id
           ORDER BY created_at ASC
         ) AS rn
  FROM public.problems
  WHERE problem_id IS NOT NULL AND problem_id <> ''
),
keeper AS (
  SELECT user_id, platform, problem_id,
         MIN(date_first_solved) AS first_d,
         MAX(last_solved_date)  AS last_d,
         SUM(times_solved)      AS total
  FROM ranked
  GROUP BY user_id, platform, problem_id
  HAVING COUNT(*) > 1
)
UPDATE public.problems p
SET times_solved = k.total,
    date_first_solved = k.first_d,
    last_solved_date = k.last_d
FROM keeper k, ranked r
WHERE p.id = r.id AND r.rn = 1
  AND r.user_id = k.user_id AND r.platform = k.platform AND r.problem_id = k.problem_id;

DELETE FROM public.problems p
USING (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, platform, problem_id
             ORDER BY created_at ASC
           ) AS rn
    FROM public.problems
    WHERE problem_id IS NOT NULL AND problem_id <> ''
  ) x WHERE x.rn > 1
) d
WHERE p.id = d.id;

-- Same dedup for rows without problem_id (matched by normalized name)
WITH ranked AS (
  SELECT id, user_id, platform, times_solved, date_first_solved, last_solved_date,
         public.norm_problem_name(name) AS nname,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, platform, public.norm_problem_name(name)
           ORDER BY created_at ASC
         ) AS rn
  FROM public.problems
  WHERE problem_id IS NULL OR problem_id = ''
),
keeper AS (
  SELECT user_id, platform, nname,
         MIN(date_first_solved) AS first_d,
         MAX(last_solved_date)  AS last_d,
         SUM(times_solved)      AS total
  FROM ranked
  GROUP BY user_id, platform, nname
  HAVING COUNT(*) > 1
)
UPDATE public.problems p
SET times_solved = k.total,
    date_first_solved = k.first_d,
    last_solved_date = k.last_d
FROM keeper k, ranked r
WHERE p.id = r.id AND r.rn = 1
  AND r.user_id = k.user_id AND r.platform = k.platform AND r.nname = k.nname;

DELETE FROM public.problems p
USING (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, platform, public.norm_problem_name(name)
             ORDER BY created_at ASC
           ) AS rn
    FROM public.problems
    WHERE problem_id IS NULL OR problem_id = ''
  ) x WHERE x.rn > 1
) d
WHERE p.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS problems_user_platform_pid_uidx
  ON public.problems (user_id, platform, problem_id)
  WHERE problem_id IS NOT NULL AND problem_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS problems_user_platform_normname_uidx
  ON public.problems (user_id, platform, public.norm_problem_name(name))
  WHERE problem_id IS NULL OR problem_id = '';
