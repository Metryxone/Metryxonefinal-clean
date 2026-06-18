# MetryxOne Server — Cloud Run Deployment Guide

## One-Click Deploy

```bash
cd client/server
./deploy.sh
```

That's it. The script handles everything below automatically.

---

## What the Script Does (Step by Step)

### Step 0: Pre-flight Checks
- Verifies `gcloud` CLI is installed
- Checks you're logged in and project is set
- Confirms you're in the right directory

### Step 1: Enables GCP APIs
- Cloud Run
- Cloud Build
- Secret Manager
- Cloud SQL Admin

### Step 2: Creates Secrets
Reads your `.env` file and stores sensitive values in **Secret Manager**:

| Secret | Source in .env |
|--------|---------------|
| `DATABASE_URL` | Prompts if missing (your Cloud SQL string) |
| `MONGODB_URI` | `DATABASE_URI` or prompts |
| `JWT_SECRET` | `SECRET_KEY` |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` |
| `SMTP_PASS` | `SMTP_PASS` |

### Step 3: Builds & Deploys
- Builds Docker image via Cloud Build
- Deploys to Cloud Run with:
  - Region: `asia-south1` (Mumbai)
  - Memory: 512Mi, CPU: 1
  - Auto-scaling: 0 → 10 instances
  - Secrets mounted as env vars
  - Cloud SQL connector (if using Cloud SQL)

### Step 4: Verifies
- Gets the deployed URL
- Runs health check (`/api/health`)

---

## Prerequisites (First Time Only)

### 1. Install Google Cloud CLI

```bash
brew install google-cloud-sdk
```

### 2. Login & Set Project

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Ensure DATABASE_URL is Set

Add to your `.env` file:

**If using Cloud SQL:**
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@/metryxone?host=/cloudsql/PROJECT:asia-south1:metryxone
```

**If using Neon or external PostgreSQL:**
```
DATABASE_URL=postgresql://user:pass@host:5432/metryxone?sslmode=require
```

**If using Cloud SQL Public IP:**
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@35.244.6.85:5432/metryxone
```

### 4. Ensure MONGODB_URI is Set

Add to your `.env` file:
```
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/metryxone?retryWrites=true&w=majority
```

---

## Cloud Run Settings

| Setting | Value | Why |
|---------|-------|-----|
| Region | `asia-south1` | Mumbai — lowest latency for India |
| Memory | `512 Mi` | Express + DB connection pools |
| CPU | `1` | Sufficient for API server |
| Min instances | `0` | Scales to zero (saves cost) |
| Max instances | `10` | Handles traffic spikes |
| Concurrency | `80` | Requests per instance |
| Timeout | `300s` | For AI API calls |
| Port | `8080` | Standard Cloud Run port |

---

## Cost Estimate

| Traffic | Monthly Cost |
|---------|-------------|
| Low (< 100 req/day) | ~$0 (free tier) |
| Medium (1k req/day) | ~$5-10 |
| High (10k req/day) | ~$15-25 |

Cloud Run charges only when handling requests. Scales to zero = no cost when idle.

---

## Common Commands After Deploy

```bash
# View logs
gcloud run services logs read metryxone-server --region asia-south1

# Live tail logs
gcloud run services logs tail metryxone-server --region asia-south1

# Update an env var
gcloud run services update metryxone-server --region asia-south1 \
  --set-env-vars "KEY=VALUE"

# Update a secret
echo "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Redeploy (after code changes)
./deploy.sh

# Get URL
gcloud run services describe metryxone-server --region asia-south1 \
  --format="value(status.url)"

# Delete service
gcloud run services delete metryxone-server --region asia-south1
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `DATABASE_URL is required` | Add DATABASE_URL to .env or Secret Manager |
| `MONGODB_URI missing` | Add MONGODB_URI or set MONGO_REQUIRED=false |
| Health check fails | Check logs: `gcloud run services logs read metryxone-server --region asia-south1` |
| Permission denied on secrets | Script auto-grants; if manual: grant `secretmanager.secretAccessor` to compute service account |
| Build fails | Check `client/server/Dockerfile` and ensure `npm run build` works locally first |
| Cold start slow (>10s) | Set `--min-instances 1` to keep one instance warm |
