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
# Required envs: GCP_PROJECT, DATABASE_URL, MONGODB_URI, EMERGENT_LLM_KEY
# Strongly recommended: ZOHO_EMAIL, ZOHO_APP_PASSWORD (super-admin 2FA email;
#   without them super-admin login is IMPOSSIBLE in prod — passed through if set).
# Optional:  REGION (default asia-south1); SECRET_KEY, SESSION_SECRET,
#   UPLOAD_SERVICE_TOKEN (each auto-generated if missing). SESSION_SECRET is what
#   the Node backend actually requires (it fail-fasts without it); SECRET_KEY is
#   the FastAPI/Python key. UPLOAD_SERVICE_TOKEN is set identically on BOTH Cloud
#   Run services so the upload proxy authenticates to FastAPI.

set -e

REGION="${REGION:-asia-south1}"
GCP_PROJECT="${GCP_PROJECT:?Set GCP_PROJECT to your Google Cloud project ID}"
DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL (Postgres URI for drizzle)}"
MONGODB_URI="${MONGODB_URI:?Set MONGODB_URI (Mongo URI)}"
EMERGENT_LLM_KEY="${EMERGENT_LLM_KEY:?Set EMERGENT_LLM_KEY}"
SECRET_KEY="${SECRET_KEY:-$(openssl rand -hex 32)}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
UPLOAD_SERVICE_TOKEN="${UPLOAD_SERVICE_TOKEN:-$(openssl rand -hex 32)}"
ZOHO_EMAIL="${ZOHO_EMAIL:-}"
ZOHO_APP_PASSWORD="${ZOHO_APP_PASSWORD:-}"

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
