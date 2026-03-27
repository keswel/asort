CREATE TABLE articles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  source TEXT,
  published_at TIMESTAMPTZ,
  importance_score INTEGER,
  summary TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
