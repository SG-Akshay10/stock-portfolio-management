-- ============================================================
-- Stock Portfolio Management - Supabase Schema
-- Run this in the Supabase SQL Editor to bootstrap the database
-- ============================================================

-- ------------------------------------
-- 1. app_users table
--    Stores application users with hashed passwords.
--    Used by NextAuth Credentials provider for login.
-- ------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,   -- bcrypt hashed
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);

-- ------------------------------------
-- 2. items table
--    Sample application data table.
--    Each row belongs to a user (foreign key to app_users).
-- ------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);

-- ------------------------------------
-- 3. Row-Level Security (RLS)
--    Disabled here since we use the service_role key in the backend.
--    Enable + configure if you want client-side Supabase access.
-- ------------------------------------
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
