-- Allow admins to view all operations
DROP POLICY IF EXISTS "Admins can view all operations" ON operations;
CREATE POLICY "Admins can view all operations" 
ON operations FOR SELECT 
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Allow admins to view all operation items
DROP POLICY IF EXISTS "Admins can view all operation items" ON operation_items;
CREATE POLICY "Admins can view all operation items" 
ON operation_items FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM operations 
    WHERE operations.id = operation_items.operation_id
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
);
