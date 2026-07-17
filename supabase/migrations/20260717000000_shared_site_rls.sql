-- Fix RLS to allow shared view per site
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leurs propres opérations" ON public.operations;

CREATE POLICY "Voir les opérations de son site" ON public.operations
FOR SELECT TO authenticated
USING (
  site = (auth.jwt() -> 'app_metadata' ->> 'assignedSiteName') 
  OR site = (auth.jwt() -> 'user_metadata' ->> 'assignedSiteName')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Voir les items de ses opérations" ON public.operation_items;

CREATE POLICY "Voir les items des opérations de son site" ON public.operation_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.operations o 
  WHERE o.id = operation_items.operation_id 
  AND (
    o.site = (auth.jwt() -> 'app_metadata' ->> 'assignedSiteName') 
    OR o.site = (auth.jwt() -> 'user_metadata' ->> 'assignedSiteName')
    OR o.user_id = auth.uid()
  )
));
