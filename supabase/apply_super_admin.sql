-- Run this in your Supabase SQL Editor to grant Super Admin permissions

-- Allow users to read their own roles
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own roles (so they can become CUSTOMER or SUPER_ADMIN on sign up)
DROP POLICY IF EXISTS "Users can insert own roles" ON user_roles;
CREATE POLICY "Users can insert own roles" ON user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and Super Admins can manage all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

-- Admins and Super Admins can manage user roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage user roles" ON user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'approved')
  );

-- Fix profile insert on signup
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
