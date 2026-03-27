# ASORT - Article Sort

Scrapes today's Hacker News, scores articles by relevance to your profession using Claude AI, stores in PostgreSQL.
https://github.com/user-attachments/assets/8d1d79a5-e01b-433f-9104-6702eff0c5ce

## Setup

1. `npm install`
2. Create `.env`:
```
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_anon_key
ANTHROPIC_API_KEY=your_claude_key
```
3. Run the table SQL from `schema.sql` in Supabase
4. `npm start`
