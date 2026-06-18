# MetryxOne — GCP Deployment Guide (Multi-Service)

> Updated for the current `/app` structure (Node API + FastAPI bulk-upload + Vite frontend).

## Architecture (current)

```
                    ┌──────────────────────────────────┐
                    │   Firebase Hosting / GCS+CDN     │
                    │   /app/frontend (Vite/React SPA) │
                    └──────────┬───────────────────────┘
                               │  /api/*    /api/v1/upload/*
                               ▼
                    ┌──────────────────────────────────┐
                    │   Cloud Run — service: api       │
                    │   /app/backend (Express/Node ESM)│
                    │   Port 8001 → 8080 in prod       │
                    │   Region: asia-south1 (Mumbai)   │
                    └──────┬─────────┬─────────────────┘
                           │         │ proxy /api/v1/upload/*
                ┌──────────▼─┐  ┌────▼─────────────────────┐
                │ Cloud SQL  │  │ Cloud Run — service:     │
                │ Postgres   │  │   bulk-upload            │
                │ (drizzle)  │  │   /app/backend-main      │
                └────────────┘  │   (FastAPI on port 8080) │
                ┌────────────┐  └──────┬───────────────────┘
                │ MongoDB    │         │
                │ Atlas M0/  │   ┌─────▼──────┐
                │ M10        │   │ Cloud SQL  │
                └────────────┘   │ Postgres   │
                                 │ (SQLAlchemy)│
                                 └────────────┘
```

Two databases: drizzle-managed `metryxone_node` and SQLAlchemy-managed `metryxone` (or share one DB by switching FastAPI to use a different schema).

---

## Repo paths in this codebase

| Service | Path | Tech | Dev port | Prod port |
|---|---|---|---|---|
| Frontend | `/app/frontend` | Vite + React 18 + Tailwind | 3000 | static (CDN) |
| Node API | `/app/backend` | Express + TypeScript (ESM, `tsx`) | 8001 | 8080 |
| Python API | `/app/backend-main` | FastAPI + uvicorn | 8002 | 8080 |

The Node API exposes a built-in reverse-proxy at `/api/v1/upload/*` → Python service, so only one public Cloud Run URL is technically required for the API. The Python service can be a separate Cloud Run instance or co-deployed.

---

## Database options (pick one each)

### PostgreSQL
| Option | Cost | Notes |
|---|---|---|
| **Neon** | Free 0.5GB | Best for dev/MVP. Serverless, branching. |
| **Cloud SQL Postgres** | ~$7-25/mo | Best for prod in `asia-south1`. Auto-backups. |
| **Supabase** | Free 500MB | Generous free tier, comes with Auth. |

### MongoDB
| Option | Cost | Notes |
|---|---|---|
| **MongoDB Atlas M0** | Free 512MB | Dev/MVP. |
| **MongoDB Atlas M10** | ~$57/mo | Prod with backups. |

**Recommended starting stack:** Neon (free) + Atlas M0 (free) + Cloud Run (free tier covers MVP).

---

## Step-by-step deployment

### Prerequisites
```bash
brew install google-cloud-sdk firebase-tools
gcloud auth login
gcloud projects create metryxone-prod --name="MetryxOne"
gcloud config set project metryxone-prod
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com firebase.googleapis.com
```

### Step 1 — Dockerfiles

Create `/app/backend/Dockerfile` (Node API):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm install -g tsx
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["npx","tsx","index.ts"]
```

Create `/app/backend-main/Dockerfile` (FastAPI):
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt* ./
RUN pip install --no-cache-dir fastapi uvicorn sqlalchemy psycopg2-binary \
    python-dotenv python-multipart pandas openpyxl pydantic email-validator \
    emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080"]
```

Create `.dockerignore` in each:
```
node_modules
__pycache__
.env
.env.*
dist
.git
*.md
```

---

### Step 2 — Secrets in Secret Manager
```bash
for K in DATABASE_URL MONGODB_URI SECRET_KEY OPENAI_API_KEY EMERGENT_LLM_KEY \
         AI_INTEGRATIONS_OPENAI_API_KEY AI_INTEGRATIONS_OPENAI_BASE_URL; do
  gcloud secrets create $K --replication-policy=automatic 2>/dev/null || true
done

# Then add a version per secret:
echo -n "postgresql://user:pass@/metryxone_node?host=/cloudsql/PROJECT:REGION:INSTANCE" \
  | gcloud secrets versions add DATABASE_URL --data-file=-
echo -n "mongodb+srv://user:pass@cluster.mongodb.net/metryxone" \
  | gcloud secrets versions add MONGODB_URI --data-file=-
echo -n "$(openssl rand -hex 32)" \
  | gcloud secrets versions add SECRET_KEY --data-file=-
echo -n "sk-emergent-..." \
  | gcloud secrets versions add EMERGENT_LLM_KEY --data-file=-
```

---

### Step 3 — Deploy each Cloud Run service
```bash
REGION=asia-south1

# A) Python (FastAPI) — deploy first, get its URL
cd /app/backend-main
gcloud run deploy metryxone-bulk-upload \
  --source . --region $REGION --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
  --allow-unauthenticated \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest"

# Capture the URL
PY_URL=$(gcloud run services describe metryxone-bulk-upload --region $REGION --format='value(status.url)')

# B) Node (Express) — point its FASTAPI_URL at the Python service
cd /app/backend
gcloud run deploy metryxone-api \
  --source . --region $REGION --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 5 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,FASTAPI_URL=$PY_URL,OPENAI_BASE_URL=$PY_URL/llm/v1" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,MONGODB_URI=MONGODB_URI:latest,SECRET_KEY=SECRET_KEY:latest,OPENAI_API_KEY=EMERGENT_LLM_KEY:latest,AI_INTEGRATIONS_OPENAI_API_KEY=EMERGENT_LLM_KEY:latest,EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest"

API_URL=$(gcloud run services describe metryxone-api --region $REGION --format='value(status.url)')
echo "Public API: $API_URL"
```

---

### Step 4 — Run database setup (one-time)

**Drizzle schema push (Node side):**
```bash
cd /app/backend
DATABASE_URL="postgresql://user:pass@PROD_HOST/metryxone_node" \
  npx drizzle-kit push --force
```

**Seed super admin + assessment templates** — done automatically on Node service startup (`storage.ts` `seedSuperAdmin`, `seedAssessmentTemplates`).

**Seed pricing packages** — log into the deployed app as super admin → `/?screen=admin-pricing` → click "Seed defaults" → set prices in the UI. (Or POST `/api/admin/subscription-packages/seed` with your auth cookie.)

---

### Step 5 — Frontend deploy

Build with prod env:
```bash
cd /app/frontend
echo "VITE_API_URL=$API_URL" > .env.production
npm run build
```

**Option A — Firebase Hosting (recommended for simplicity):**

Edit `/app/frontend/firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "metryxone-api", "region": "asia-south1" } },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```
Then:
```bash
firebase use metryxone-prod
firebase deploy --only hosting
```

**Option B — GCS + Cloud CDN** for purely static hosting (slightly more setup).

---

### Step 6 — Custom domain
```bash
gcloud run domain-mappings create --service=metryxone-api \
  --domain=api.metryxone.com --region=asia-south1
# In Firebase Console: Hosting → Add custom domain → metryxone.com
```

---

## Environment-variable reference (prod)

| Variable | Service | Source |
|---|---|---|
| `DATABASE_URL` | Node API + FastAPI | Secret Manager |
| `MONGODB_URI` | Node API | Secret Manager |
| `SECRET_KEY` | Node API | Secret Manager |
| `OPENAI_API_KEY` | Node API | Secret Manager (use Emergent key) |
| `OPENAI_BASE_URL` | Node API | Env var → Python service URL `/llm/v1` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Node API | Secret Manager (same as OPENAI_API_KEY) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Node API | Env var → Python service URL `/llm/v1` |
| `FASTAPI_URL` | Node API | Env var → Python Cloud Run URL |
| `EMERGENT_LLM_KEY` | FastAPI | Secret Manager |
| `PORT` | both APIs | Env var (`8080`) |
| `NODE_ENV` | Node API | `production` |

---

## CI/CD with Cloud Build

Create `/app/cloudbuild.yaml` (multi-service build):
```yaml
steps:
  # Build & deploy Node API
  - name: gcr.io/cloud-builders/gcloud
    args: [run, deploy, metryxone-api, --source=backend, --region=asia-south1,
           --port=8080, --allow-unauthenticated]

  # Build & deploy FastAPI
  - name: gcr.io/cloud-builders/gcloud
    args: [run, deploy, metryxone-bulk-upload, --source=backend-main, --region=asia-south1,
           --port=8080, --allow-unauthenticated]

options: { logging: CLOUD_LOGGING_ONLY }
```

Set up a GitHub trigger:
```bash
gcloud builds triggers create github \
  --repo-name=client --repo-owner=Metryxone --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Cost estimate (monthly)

| Service | Free tier | Est. cost (low traffic) |
|---|---|---|
| Cloud Run × 2 | 2M requests / 360K GB-s combined | **$0** |
| Cloud SQL Postgres | None | **$7–25/mo** |
| Neon free | 0.5GB | **$0** |
| MongoDB Atlas M0 | 512MB | **$0** |
| Firebase Hosting | 10GB / 360MB-day transfer | **$0** |
| Secret Manager | 6 active versions | **$0** |
| **Total MVP** | | **$0/mo** |
| **Total Prod** | | **~$10–35/mo** |

---

## Quick reference

```bash
# Deploy both APIs in one go
cd /app
gcloud builds submit --config cloudbuild.yaml

# Logs
gcloud run services logs read metryxone-api --region asia-south1 --limit 100
gcloud run services logs read metryxone-bulk-upload --region asia-south1 --limit 100

# Health checks
curl $API_URL/api/v1/upload/health   # FastAPI via Node proxy
curl $API_URL/api/login -d ...       # Node auth
```

---

## Health checks for Cloud Run

Both services already expose `/health`:

| Service | Endpoint | Expected |
|---|---|---|
| Node API | `GET /api/login` (returns 400 if no body — proves alive) | HTTP 400 |
| FastAPI | `GET /health` | `{"status":"ok"}` |
| LLM proxy | `GET /llm/v1/health` | `{"status":"ok","has_key":true}` |

Configure Cloud Run startup probe:
```bash
gcloud run services update metryxone-bulk-upload --region asia-south1 \
  --update-startup-probe-initial-delay=5s \
  --update-startup-probe-period=5s \
  --update-startup-probe-timeout=3s \
  --update-startup-probe-failure-threshold=3 \
  --update-startup-probe-http-path=/health
```
