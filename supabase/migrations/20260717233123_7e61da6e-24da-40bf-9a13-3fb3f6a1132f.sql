CREATE OR REPLACE FUNCTION public.norm_problem_name(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT lower(regexp_replace(coalesce($1,''), '\s+', ' ', 'g')) $$;
