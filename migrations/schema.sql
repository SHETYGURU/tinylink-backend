CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  email TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  last_clicked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Safely add the code_format constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'code_format'
  ) THEN
    ALTER TABLE links
      ADD CONSTRAINT code_format CHECK (code ~ '^[A-Za-z0-9]{6,8}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);
CREATE INDEX IF NOT EXISTS idx_links_email ON links(email);
