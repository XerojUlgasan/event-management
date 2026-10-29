ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff', 'customer'));
-- Preserve pre-existing administrators without a staff title and restrict titled staff.
UPDATE users SET staff_role = 'System Administrator' WHERE role = 'admin' AND staff_role IS NULL;
UPDATE users SET role = 'staff' WHERE role = 'admin' AND staff_role <> 'System Administrator';
