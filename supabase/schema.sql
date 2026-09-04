-- ============================================================
-- Stock Portfolio Management - Supabase Schema (PRD Specification)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. app_users table
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,   -- bcrypt hashed
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);

-- 2. items table
-- Simple demo table used by backend/app/routers/items.py
CREATE TABLE IF NOT EXISTS items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);

-- 3. holdings table
-- Tracks user stock portfolio holdings (NSE/BSE listed equities)
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,          -- e.g., RELIANCE, TCS, INFY, HDFCBANK
  company_name TEXT NOT NULL,          -- e.g., Reliance Industries Ltd
  exchange     TEXT NOT NULL DEFAULT 'NSE', -- NSE or BSE
  quantity     NUMERIC,                -- Optional position size (v2 P&L awareness)
  buy_price    NUMERIC,                -- Optional avg purchase price
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings (user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings (symbol);

-- 3. news_items table
-- Ingested & AI-classified corporate filings and news
CREATE TABLE IF NOT EXISTS news_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       TEXT NOT NULL,
  title        TEXT NOT NULL,
  source       TEXT NOT NULL,
  url          TEXT NOT NULL,
  content      TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category     TEXT NOT NULL DEFAULT 'General News', -- Quarterly Results, Dividend, Regulatory/Legal, Guidance Change, M&A, Credit Rating, Management Change, Board Meeting, General News
  materiality  TEXT NOT NULL DEFAULT 'medium',       -- high, medium, low
  sentiment    TEXT NOT NULL DEFAULT 'neutral',      -- positive, negative, neutral, unclear
  summary      TEXT NOT NULL,                        -- 2-4 sentence plain language explanation of price materiality
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dedup_hash   TEXT UNIQUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_items_symbol ON news_items (symbol);
CREATE INDEX IF NOT EXISTS idx_news_items_materiality ON news_items (materiality);
CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items (published_at DESC);

-- 4. user_alert_settings table
-- User notification channel & materiality threshold preferences
CREATE TABLE IF NOT EXISTS user_alert_settings (
  user_id               UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  channel               TEXT NOT NULL DEFAULT 'browser', -- telegram, email, browser
  materiality_threshold TEXT NOT NULL DEFAULT 'high',    -- high, medium
  telegram_chat_id      TEXT,
  email_destination     TEXT,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. user_alerts_sent table
-- Log of sent alert notifications
CREATE TABLE IF NOT EXISTS user_alerts_sent (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  news_item_id UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'delivered',
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_sent_user ON user_alerts_sent (user_id);

-- RLS note: for production, prefer enabling RLS and creating policies per table.
-- The service_role key bypasses RLS automatically, so it does not require disabling RLS here.
-- (Intentionally leaving out ALTER TABLE ... DISABLE ROW LEVEL SECURITY statements.)
