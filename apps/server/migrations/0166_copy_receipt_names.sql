-- 1.14.4 (#183): attachments have a name (0165). The app may change it, as it changes the role
-- and the sort (0020's column grant); who may is the route's rule (own, or anyone's for owners
-- and admins), under 0020's policies.
GRANT UPDATE (name) ON public.attachments TO kept_app;
--> statement-breakpoint
-- A thing moved to another account takes its purchase's receipts and invoices with it (D161,
-- kept.copy_purchase_line): their names go too. As 0024's, with `name` in the copy.
CREATE OR REPLACE FUNCTION kept.copy_purchase_line(p_line uuid, p_location uuid, p_account uuid)
RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  l public.purchase_lines%ROWTYPE;
  p public.purchases%ROWTYPE;
  whole boolean;
  new_purchase uuid := uuidv7();
  new_line uuid := uuidv7();
BEGIN
  SELECT * INTO l FROM public.purchase_lines WHERE id = p_line;
  SELECT * INTO p FROM public.purchases WHERE id = l.purchase_id;
  whole := coalesce(p.location_id IN (SELECT kept.visible_location_ids()), false);
  INSERT INTO public.purchases (id, location_id, vendor_id, purchased_on, currency, total, tax,
                                notes, review_state, created_via, created_by)
  VALUES (new_purchase, p_location, kept.map_registry('vendor', p.vendor_id, p_account),
          p.purchased_on, p.currency, CASE WHEN whole THEN p.total END,
          CASE WHEN whole THEN p.tax END, CASE WHEN whole THEN p.notes END, p.review_state,
          p.created_via, p.created_by);
  INSERT INTO public.purchase_lines (id, location_id, purchase_id, description, quantity,
                                     unit_price, sort)
  VALUES (new_line, p_location, new_purchase, l.description, l.quantity, l.unit_price, l.sort);
  INSERT INTO public.attachments (location_id, file_id, purchase_id, role, name, sort, created_by)
  SELECT p_location, kept.copy_file(a.file_id, p_location), new_purchase, a.role, a.name, a.sort,
         a.created_by
    FROM public.attachments a
   WHERE a.purchase_id = p.id AND a.location_id = p.location_id
     AND a.role IN ('receipt', 'invoice') AND a.file_id IS NOT NULL;
  RETURN new_line;
END $$;
