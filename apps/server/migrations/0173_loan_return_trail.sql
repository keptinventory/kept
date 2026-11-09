-- Custom SQL migration file, put your code below! --
-- A lending custody trail (#374): loans.damaged and loans.taken_back_by (0172) say how a loan came
-- back and which member took it back.
--
--   1. kept_app writes both on a return, and clears them on the return's undo.
--   2. An open loan neither came back damaged nor was taken back by anyone: reopening one clears
--      both, whoever reopens it. The release before this one undoes a return without knowing
--      these columns.
-- Additive: the release before reads neither column, and its writes leave them at their defaults.

GRANT UPDATE (damaged, taken_back_by) ON public.loans TO kept_app;
--> statement-breakpoint
CREATE FUNCTION kept.loan_reopen_clears_return() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.returned_at IS NULL THEN
    NEW.damaged := false;
    NEW.taken_back_by := NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.loan_reopen_clears_return() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER loans_reopen_clears_return
  BEFORE INSERT OR UPDATE OF returned_at, damaged, taken_back_by ON public.loans
  FOR EACH ROW EXECUTE FUNCTION kept.loan_reopen_clears_return();
