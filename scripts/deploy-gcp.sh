#!/bin/bash
# /app/scripts/deploy-gcp.sh
# ===========================================================================
# CANONICAL PRODUCTION DEPLOY (single source of truth: see replit.md).
# The .replit [deployment] autoscale target is DEV / WORKSPACE PREVIEW ONLY
# (Node backend only, no FastAPI) and must NOT be treated as production.
# ===========================================================================
# One-shot deploy of all 3 MetryxOne services to Google Cloud:
#   • Node API   → Cloud Run service: metryxone-api      (port 8080)
#   • FastAPI    → Cloud Run service: metryxone-bulk-upload (port 8080)
#   • Frontend   → Firebase Hosting (with /api/** rewrite to Node API)
#
# Usage:
#   GCP_PROJECT=your-project-id \
#   DATABASE_URL=postgresql://... \
#   MONGODB_URI=mongodb+srv://... \
#   EMERGENT_LLM_KEY=sk-emergent-... \
#   bash /app/scripts/deploy-gcp.sh
#
# Verify readiness WITHOUT deploying (recommended before every prod deploy):
#   GCP_PROJECT=... DATABASE_URL=... MONGODB_URI=... EMERGENT_LLM_KEY=... \
#     bash /app/scripts/deploy-gcp.sh --check
#   (or CHECK_ONLY=1 bash /app/scripts/deploy-gcp.sh)
#   --check validates every required input is present + well-formed and, when
#   gcloud is available, audits which secrets already exist in Secret Manager.
#   It creates/deploys NOTHING.
#
# Required envs: GCP_PROJECT, DATABASE_URL, MONGODB_URI, EMERGENT_LLM_KEY
# Strongly recommended: ZOHO_EMAIL, ZOHO_APP_PASSWORD (super-admin 2FA email;
#   without them super-admin login is IMPOSSIBLE in prod — passed through if set).
# Optional:  REGION (default asia-south1); SECRET_KEY, SESSION_SECRET,
#   UPLOAD_SERVICE_TOKEN (each auto-generated if missing). SESSION_SECRET is what
#   the Node backend actually requires (it fail-fasts without it); SECRET_KEY is
#   the FastAPI/Python key. UPLOAD_SERVICE_TOKEN is set identically on BOTH Cloud
#   Run services so the upload proxy authenticates to FastAPI.

set -e
set -o pipefail

# ── args: support `--check` / `--dry-run` (alias of CHECK_ONLY=1) ───────────────
CHECK_ONLY="${CHECK_ONLY:-}"
for arg in "$@"; do
  case "$arg" in
    --check|--dry-run) CHECK_ONLY=1 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg (use --check or --help)"; exit 2 ;;
  esac
done

REGION="${REGION:-asia-south1}"
GCP_PROJECT="${GCP_PROJECT:-}"
DATABASE_URL="${DATABASE_URL:-}"
MONGODB_URI="${MONGODB_URI:-}"
EMERGENT_LLM_KEY="${EMERGENT_LLM_KEY:-}"
SECRET_KEY="${SECRET_KEY:-$(openssl rand -hex 32)}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
UPLOAD_SERVICE_TOKEN="${UPLOAD_SERVICE_TOKEN:-$(openssl rand -hex 32)}"
ZOHO_EMAIL="${ZOHO_EMAIL:-}"
ZOHO_APP_PASSWORD="${ZOHO_APP_PASSWORD:-}"

# ── Preflight: validate ALL required inputs up front and report the COMPLETE ────
# list at once (instead of aborting one var at a time), plus format/placeholder
# sanity. This is the deploy-time mirror of backend/lib/env-preflight.ts.
validate_inputs() {
  local missing=() badfmt=()

  [ -n "$GCP_PROJECT" ]      || missing+=("GCP_PROJECT (Google Cloud project ID)")
  [ -n "$DATABASE_URL" ]     || missing+=("DATABASE_URL (Postgres URI)")
  [ -n "$MONGODB_URI" ]      || missing+=("MONGODB_URI (Mongo URI)")
  [ -n "$EMERGENT_LLM_KEY" ] || missing+=("EMERGENT_LLM_KEY (LLM key)")

  if [ -n "$DATABASE_URL" ] && ! printf '%s' "$DATABASE_URL" | grep -qiE '^postgres(ql)?://'; then
    badfmt+=("DATABASE_URL must start with postgres:// or postgresql://")
  fi
  if [ -n "$MONGODB_URI" ] && ! printf '%s' "$MONGODB_URI" | grep -qiE '^mongodb(\+srv)?://'; then
    badfmt+=("MONGODB_URI must start with mongodb:// or mongodb+srv://")
  fi
  for pair in "DATABASE_URL=$DATABASE_URL" "MONGODB_URI=$MONGODB_URI" "EMERGENT_LLM_KEY=$EMERGENT_LLM_KEY"; do
    local k="${pair%%=*}" v="${pair#*=}"
    # Anchored template/placeholder tokens that never occur in real credentials.
    # (Deliberately NOT matching loose substrings like "your-", which can legitimately
    # appear inside a real password and would wrongly block a valid deploy.)
    if [ -n "$v" ] && printf '%s' "$v" | grep -qiE '(<[^>]+>|changeme|change_me|change-me|replace_me|replace-me|placeholder|xxxxx)'; then
      badfmt+=("$k looks like a placeholder, not a real value")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ] || [ "${#badfmt[@]}" -gt 0 ]; then
    echo "✗ Production secret preflight FAILED — nothing was deployed:"
    for m in "${missing[@]}"; do echo "   • MISSING:  $m"; done
    for b in "${badfmt[@]}"; do echo "   • INVALID:  $b"; done
    echo
    echo "Set the variables above and re-run. To verify WITHOUT deploying:"
    echo "   CHECK_ONLY=1 bash scripts/deploy-gcp.sh"
    exit 1
  fi

  echo "✓ Required inputs present & well-formed: GCP_PROJECT, DATABASE_URL, MONGODB_URI, EMERGENT_LLM_KEY"
  echo "✓ Auto-generated where unset: SESSION_SECRET, UPLOAD_SERVICE_TOKEN, SECRET_KEY"
  if [ -n "$ZOHO_EMAIL" ] && [ -n "$ZOHO_APP_PASSWORD" ]; then
    echo "✓ ZOHO_EMAIL/ZOHO_APP_PASSWORD provided — super-admin 2FA email will work"
  else
    echo "⚠ ZOHO_EMAIL/ZOHO_APP_PASSWORD NOT provided — super-admin 2FA email will NOT"
    echo "  work (super-admin login impossible until set)."
  fi
}

validate_inputs

# ── CHECK_ONLY: verify readiness and exit WITHOUT creating/deploying anything ──
if [ -n "$CHECK_ONLY" ]; then
  echo
  echo "CHECK_ONLY mode — no resources were created or deployed."
  if command -v gcloud >/dev/null 2>&1; then
    echo "→ Auditing existing secrets in Secret Manager (project: $GCP_PROJECT)..."
    for KEY in DATABASE_URL MONGODB_URI SECRET_KEY SESSION_SECRET \
               UPLOAD_SERVICE_TOKEN EMERGENT_LLM_KEY ZOHO_EMAIL ZOHO_APP_PASSWORD; do
      if gcloud secrets describe "$KEY" --project "$GCP_PROJECT" >/dev/null 2>&1; then
        echo "   ✓ exists in Secret Manager: $KEY"
      else
        echo "   ✗ absent in Secret Manager: $KEY (will be created on real deploy if provided)"
      fi
    done
  else
    echo "(gcloud not on PATH here — input validation only. Run on a machine with"
    echo " gcloud + auth to audit Secret Manager contents.)"
  fi
  echo
  echo "✓ Readiness check complete. Re-run without --check to deploy."
  exit 0
fi

echo "==========================================================="
echo "  MetryxOne GCP Deploy"
echo "==========================================================="
echo "Project: $GCP_PROJECT"
echo "Region:  $REGION"
echo

echo "→ [1/8] Selecting project & enabling APIs..."
gcloud config set project "$GCP_PROJECT" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com 2>&1 | tail -5

echo "→ [2/8] Creating Dockerfiles (if missing)..."
# Node API Dockerfile
if [ ! -f /app/backend/Dockerfile ] || ! grep -q "tsx" /app/backend/Dockerfile; then
  cat > /app/backend/Dockerfile <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm install -g tsx
COPY . .
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["npx","tsx","index.ts"]
EOF
  echo "   ✓ Wrote /app/backend/Dockerfile"
fi

# FastAPI Dockerfile
if [ ! -f /app/backend-main/Dockerfile ]; then
  cat > /app/backend-main/Dockerfile <<'EOF'
FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn sqlalchemy psycopg2-binary \
    python-dotenv python-multipart pandas openpyxl pydantic email-validator \
    emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080"]
EOF
  echo "   ✓ Wrote /app/backend-main/Dockerfile"
fi

# .dockerignore
for d in /app/backend /app/backend-main; do
  if [ ! -f "$d/.dockerignore" ]; then
    cat > "$d/.dockerignore" <<EOF
node_modules
__pycache__
*.pyc
.env
.env.*
dist
.git
EOF
  fi
done

echo "→ [3/8] Storing secrets in Secret Manager..."
for entry in \
  "DATABASE_URL=$DATABASE_URL" \
  "MONGODB_URI=$MONGODB_URI" \
  "SECRET_KEY=$SECRET_KEY" \
  "SESSION_SECRET=$SESSION_SECRET" \
  "UPLOAD_SERVICE_TOKEN=$UPLOAD_SERVICE_TOKEN" \
  "EMERGENT_LLM_KEY=$EMERGENT_LLM_KEY"; do
  KEY="${entry%%=*}"; VAL="${entry#*=}"
  gcloud secrets create "$KEY" --replication-policy=automatic 2>/dev/null || true
  echo -n "$VAL" | gcloud secrets versions add "$KEY" --data-file=- >/dev/null
  echo "   ✓ $KEY"
done

# Zoho super-admin 2FA email — pass through ONLY when provided. Without it,
# super-admin login is impossible in prod, so warn loudly rather than silently skip.
if [ -n "$ZOHO_EMAIL" ] && [ -n "$ZOHO_APP_PASSWORD" ]; then
  for entry in "ZOHO_EMAIL=$ZOHO_EMAIL" "ZOHO_APP_PASSWORD=$ZOHO_APP_PASSWORD"; do
    KEY="${entry%%=*}"; VAL="${entry#*=}"
    gcloud secrets create "$KEY" --replication-policy=automatic 2>/dev/null || true
    echo -n "$VAL" | gcloud secrets versions add "$KEY" --data-file=- >/dev/null
    echo "   ✓ $KEY"
  done
  ZOHO_SECRETS=",ZOHO_EMAIL=ZOHO_EMAIL:latest,ZOHO_APP_PASSWORD=ZOHO_APP_PASSWORD:latest"
else
  ZOHO_SECRETS=""
  echo "   ⚠ ZOHO_EMAIL/ZOHO_APP_PASSWORD not provided — super-admin 2FA email will NOT work in prod (super-admin login impossible until set)."
fi

echo "→ [4/8] Deploying FastAPI bulk-upload service..."
cd /app/backend-main
gcloud run deploy metryxone-bulk-upload \
  --source . --region "$REGION" --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
  --allow-unauthenticated --quiet \
  --set-env-vars "ENV=production,NODE_ENV=production" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest,UPLOAD_SERVICE_TOKEN=UPLOAD_SERVICE_TOKEN:latest"

PY_URL=$(gcloud run services describe metryxone-bulk-upload --region "$REGION" --format='value(status.url)')
echo "   ✓ FastAPI URL: $PY_URL"

echo "→ [5/8] Deploying Node API..."
cd /app/backend
gcloud run deploy metryxone-api \
  --source . --region "$REGION" --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 5 \
  --allow-unauthenticated --quiet \
  --set-env-vars "NODE_ENV=production,FASTAPI_URL=$PY_URL,OPENAI_BASE_URL=$PY_URL/llm/v1,AI_INTEGRATIONS_OPENAI_BASE_URL=$PY_URL/llm/v1" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,MONGODB_URI=MONGODB_URI:latest,SECRET_KEY=SECRET_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,UPLOAD_SERVICE_TOKEN=UPLOAD_SERVICE_TOKEN:latest,OPENAI_API_KEY=EMERGENT_LLM_KEY:latest,AI_INTEGRATIONS_OPENAI_API_KEY=EMERGENT_LLM_KEY:latest,EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest${ZOHO_SECRETS}"

API_URL=$(gcloud run services describe metryxone-api --region "$REGION" --format='value(status.url)')
echo "   ✓ Node API URL: $API_URL"

echo "→ [6/8] Pushing Drizzle schema to Postgres..."
cd /app/backend
DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --force 2>&1 | tail -3 || true

echo "→ [7/8] Building frontend..."
cd /app/frontend
[ -f package-lock.json ] || npm install --legacy-peer-deps --silent
echo "VITE_API_URL=$API_URL" > .env.production
npm run build

# Update firebase.json with rewrite
cat > /app/frontend/firebase.json <<EOF
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "metryxone-api", "region": "$REGION" } },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
EOF

echo "→ [8/8] Deploying frontend to Firebase Hosting..."
cd /app/frontend
firebase use "$GCP_PROJECT" --add 2>/dev/null || firebase projects:addfirebase "$GCP_PROJECT" 2>/dev/null || true
firebase deploy --only hosting --project "$GCP_PROJECT"

HOSTING_URL="https://${GCP_PROJECT}.web.app"

echo
echo "==========================================================="
echo "  ✅ Deploy complete"
echo "==========================================================="
echo "  Frontend:    $HOSTING_URL"
echo "  Node API:    $API_URL"
echo "  FastAPI:     $PY_URL"
echo
echo "Smoke tests:"
echo "  curl $API_URL/api/v1/upload/health"
echo "  curl $API_URL/api/subscription-packages | head"
echo "==========================================================="
