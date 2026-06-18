# Test Credentials

## Node Backend (server-main → /app/backend)
- **Super Admin**
  - URL: `POST /api/login`
  - Username: `superadmin@metryx.one`
  - Password: `admin123`
  - Role: `super_admin`

## After container reset (DB wipe)
Run: `bash /app/scripts/bootstrap.sh`
This will:
- Reinstall/start Postgres 15
- Push Drizzle schema
- Auto-seed Super Admin user via `storage.ts`
- Seed LBI Behavioural Framework: **19 domains + 97 subdomains + 6 age bands** (`/app/scripts/seed-lbi-data.sql`)
- Seed Competency Library (flat 317-row): `/app/scripts/seed-competency-library.sql`
- Seed Professional Competency Framework — full DDL + data:
  - **12 domains, 101 competencies, 5 career stages, 505 stage norms, 7 hiring roles, 707 role weights**
  - File: `/app/scripts/seed-competency-framework.sql`
  - Re-builder: `python3 /app/scripts/build-competency-framework.py`

⚠️ **NOT auto-restored** (re-create as needed via Super Admin UI / CSV import):
- AI-drafted assessment items (questions + options) — `competency_assessment_items` starts empty
- Competency clusters (custom groupings) — `competency_clusters` starts empty
- Learning recommendations — `learning_mappings` starts empty
- Custom adjustments to default role weights / stage norms (defaults are reasonable starting points)

## Databases
### MongoDB (Node backend chat / mongoose models)
- URL: `mongodb://localhost:27017/metryxone`
- DB: `metryxone`
- Auth: none (local)

### PostgreSQL — Node backend (drizzle ORM)
- URL: `postgresql://postgres:root123@localhost:5432/metryxone_node`
- User: `postgres` / Password: `root123`

### PostgreSQL — Python FastAPI backend (SQLAlchemy)
- URL: `postgresql://postgres:root123@localhost:5432/metryxone`
- User: `postgres` / Password: `root123`

## OpenAI Key (in /app/backend/.env)
- **Using Emergent Universal LLM key** (`sk-emergent-07f58751bB91f78043`)
- Routed through local FastAPI proxy at `http://localhost:8002/llm/v1` (implemented in `/app/backend-main/app/routers/llm_proxy.py`)
- The Node backend's OpenAI SDK points its `baseURL` at that proxy, which uses the `emergentintegrations` Python library to forward calls to OpenAI/Anthropic/Gemini
- To switch to a real OpenAI key: update `OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, and remove `OPENAI_BASE_URL` / set `AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1` in `/app/backend/.env`, then `supervisorctl restart backend`
