-- Fix empty-string session GUC breaking boolean cast in app.is_platform() (RLS policies).
CREATE OR REPLACE FUNCTION app.is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(trim(current_setting('app.is_platform', true)), ''), 'false')::boolean
$$;
