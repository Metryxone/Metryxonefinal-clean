#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# MetryxOne Server — One-Click Deploy to Google Cloud Run
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites:
#   - Google Cloud CLI installed (brew install google-cloud-sdk)
#   - Logged in (gcloud auth login)
#   - Project set (gcloud config set project YOUR_PROJECT_ID)
# ═══════════════════════════════════════════════════════════════

# ── Configuration ──────────────────────────────────────────────
SERVICE_NAME="metryxone-server"
REGION="asia-south1"
MEMORY="512Mi"
CPU="1"
MIN_INSTANCES="0"
MAX_INSTANCES="10"
CONCURRENCY="80"
TIMEOUT="300"
PORT="8080"

# ── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"; }
print_ok()   { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✗ $1${NC}"; }

# ── Step 0: Pre-flight checks ─────────────────────────────────
print_step "Step 0: Pre-flight Checks"

if ! command -v gcloud &> /dev/null; then
  print_err "gcloud CLI not found. Install: brew install google-cloud-sdk"
  exit 1
fi
print_ok "gcloud CLI found"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  print_err "No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi
print_ok "Project: $PROJECT_ID"

ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [ -z "$ACCOUNT" ] || [ "$ACCOUNT" = "(unset)" ]; then
  print_err "Not logged in. Run: gcloud auth login"
  exit 1
fi
print_ok "Account: $ACCOUNT"

# Check we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "Dockerfile" ]; then
  print_err "Run this script from client/server/ directory"
  exit 1
fi
print_ok "In correct directory"

# ── Step 1: Enable APIs ───────────────────────────────────────
print_step "Step 1: Enabling Required APIs"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  2>/dev/null

print_ok "APIs enabled"

# ── Step 2: Setup Secrets ─────────────────────────────────────
print_step "Step 2: Setting Up Secrets"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

create_secret() {
  local name=$1
  local value=$2

  if gcloud secrets describe "$name" &>/dev/null; then
    echo "$value" | gcloud secrets versions add "$name" --data-file=- 2>/dev/null
    print_ok "Updated secret: $name"
  else
    echo "$value" | gcloud secrets create "$name" --data-file=- 2>/dev/null
    print_ok "Created secret: $name"
  fi

  # Grant Cloud Run access
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null
}

# Read values from .env
if [ -f ".env" ]; then
  print_ok "Reading from .env file"

  # Extract values (handles quotes and special chars)
  get_env() {
    local key=$1
    grep "^${key}=" .env | head -1 | sed "s/^${key}=//" | sed 's/^"//' | sed 's/"$//' | sed "s/^'//" | sed "s/'$//"
  }

  # ── Prompt for DATABASE_URL (Cloud SQL) ──
  EXISTING_DB_URL=$(get_env "DATABASE_URL")
  if [ -z "$EXISTING_DB_URL" ]; then
    echo ""
    print_warn "DATABASE_URL not found in .env"
    echo -e "${YELLOW}Enter your Cloud SQL connection string:${NC}"
    echo "  Format: postgresql://postgres:PASSWORD@/metryxone?host=/cloudsql/CONNECTION_NAME"
    echo "  Or Public IP: postgresql://postgres:PASSWORD@35.244.6.85:5432/metryxone"
    read -p "  DATABASE_URL: " EXISTING_DB_URL
  fi

  # ── Prompt for MONGODB_URI ──
  EXISTING_MONGO=$(get_env "MONGODB_URI")
  if [ -z "$EXISTING_MONGO" ]; then
    EXISTING_MONGO=$(get_env "DATABASE_URI" | sed 's/^ //' | sed 's/^"//' | sed 's/"$//')
  fi
  if [ -z "$EXISTING_MONGO" ]; then
    echo ""
    print_warn "MONGODB_URI not found in .env"
    echo -e "${YELLOW}Enter your MongoDB Atlas connection string:${NC}"
    echo "  Format: mongodb+srv://user:pass@cluster.mongodb.net/metryxone"
    read -p "  MONGODB_URI: " EXISTING_MONGO
  fi

  # Create secrets for sensitive values
  [ -n "$EXISTING_DB_URL" ]            && create_secret "DATABASE_URL" "$EXISTING_DB_URL"
  [ -n "$EXISTING_MONGO" ]             && create_secret "MONGODB_URI" "$EXISTING_MONGO"

  SECRET_KEY_VAL=$(get_env "SECRET_KEY")
  [ -n "$SECRET_KEY_VAL" ]             && create_secret "JWT_SECRET" "$SECRET_KEY_VAL"

  OPENAI_VAL=$(get_env "OPENAI_API_KEY")
  [ -n "$OPENAI_VAL" ]                 && create_secret "OPENAI_API_KEY" "$OPENAI_VAL"

  SMTP_PASS_VAL=$(get_env "SMTP_PASS")
  [ -n "$SMTP_PASS_VAL" ]              && create_secret "SMTP_PASS" "$SMTP_PASS_VAL"

else
  print_err ".env file not found — you'll need to set secrets manually"
fi

# ── Step 3: Build & Deploy ────────────────────────────────────
print_step "Step 3: Building & Deploying to Cloud Run"

echo "This will take 3-5 minutes..."
echo ""

# Build secret references
SECRET_REFS="DATABASE_URL=DATABASE_URL:latest"
SECRET_REFS="${SECRET_REFS},MONGODB_URI=MONGODB_URI:latest"
SECRET_REFS="${SECRET_REFS},JWT_SECRET=JWT_SECRET:latest"

# Add optional secrets only if they exist
gcloud secrets describe OPENAI_API_KEY &>/dev/null && \
  SECRET_REFS="${SECRET_REFS},OPENAI_API_KEY=OPENAI_API_KEY:latest"
gcloud secrets describe SMTP_PASS &>/dev/null && \
  SECRET_REFS="${SECRET_REFS},SMTP_PASS=SMTP_PASS:latest"

# Read non-sensitive env vars
SMTP_USER_VAL=$(grep "^SMTP_USER=" .env 2>/dev/null | head -1 | sed 's/^SMTP_USER=//' | sed 's/"//g')
ALLOWED_VAL=$(grep "^ALLOWED_ORIGINS=" .env 2>/dev/null | head -1 | sed 's/^ALLOWED_ORIGINS=//' | sed 's/"//g')

# Plain env vars
ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS},PORT=${PORT}"
ENV_VARS="${ENV_VARS},MONGODB_DB=metryxone"
ENV_VARS="${ENV_VARS},MONGO_REQUIRED=true"
ENV_VARS="${ENV_VARS},EMAIL_FROM_NAME=MetryxOne"
[ -n "$SMTP_USER_VAL" ] && ENV_VARS="${ENV_VARS},SMTP_USER=${SMTP_USER_VAL}"
[ -n "$ALLOWED_VAL" ]   && ENV_VARS="${ENV_VARS},ALLOWED_ORIGINS=${ALLOWED_VAL}"

# Check if Cloud SQL instance connection name is needed
CLOUD_SQL_FLAG=""
if echo "$EXISTING_DB_URL" | grep -q "/cloudsql/"; then
  CONN_NAME=$(echo "$EXISTING_DB_URL" | grep -oP '(?<=/cloudsql/)[^?&]+' || true)
  if [ -n "$CONN_NAME" ]; then
    CLOUD_SQL_FLAG="--add-cloudsql-instances=${CONN_NAME}"
    print_ok "Cloud SQL connector: $CONN_NAME"
  fi
fi

# Deploy!
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port "$PORT" \
  --memory "$MEMORY" \
  --cpu "$CPU" \
  --min-instances "$MIN_INSTANCES" \
  --max-instances "$MAX_INSTANCES" \
  --concurrency "$CONCURRENCY" \
  --timeout "$TIMEOUT" \
  --set-env-vars "$ENV_VARS" \
  --set-secrets "$SECRET_REFS" \
  $CLOUD_SQL_FLAG

# ── Step 4: Verify ────────────────────────────────────────────
print_step "Step 4: Verifying Deployment"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format="value(status.url)" 2>/dev/null)

if [ -n "$SERVICE_URL" ]; then
  print_ok "Deployed at: $SERVICE_URL"

  echo ""
  echo "Testing health endpoint..."
  sleep 5

  HEALTH=$(curl -s --max-time 15 "$SERVICE_URL/api/health" 2>/dev/null || echo "timeout")

  if echo "$HEALTH" | grep -q '"ok"'; then
    print_ok "Health check passed!"
    echo "  Response: $HEALTH"
  else
    print_warn "Health check returned: $HEALTH"
    echo "  (May need a moment to cold-start. Try: curl $SERVICE_URL/api/health)"
  fi
else
  print_err "Could not get service URL"
fi

# ── Done ──────────────────────────────────────────────────────
print_step "Deployment Complete!"

echo -e "
${GREEN}╔═══════════════════════════════════════════════════════╗
║              MetryxOne Server Deployed!                ║
╚═══════════════════════════════════════════════════════╝${NC}

  ${BLUE}Service:${NC}  $SERVICE_NAME
  ${BLUE}Region:${NC}   $REGION
  ${BLUE}URL:${NC}      $SERVICE_URL
  ${BLUE}Memory:${NC}   $MEMORY  |  CPU: $CPU
  ${BLUE}Scaling:${NC}  $MIN_INSTANCES → $MAX_INSTANCES instances

  ${YELLOW}Useful Commands:${NC}
    View logs:     gcloud run services logs read $SERVICE_NAME --region $REGION
    Update env:    gcloud run services update $SERVICE_NAME --region $REGION --set-env-vars KEY=VALUE
    Update secret: gcloud secrets versions add SECRET_NAME --data-file=-
    Redeploy:      ./deploy.sh
    Delete:        gcloud run services delete $SERVICE_NAME --region $REGION
"
