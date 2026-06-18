#!/bin/bash
# /app/scripts/bulk-update-prices.sh
# Usage:
#   bash /app/scripts/bulk-update-prices.sh /path/to/your-pricing.csv
#
# CSV format (header required): see /app/scripts/pricing-template.csv
# Tip: leave 'id' column blank to insert new packages; populate 'id' to update existing ones.
# After import, the AI bot's knowledge base is refreshed automatically (live DB read in
# /api/chat/message), so no service restart is needed.

set -e

CSV_FILE="${1:-/app/scripts/pricing-template.csv}"
API_BASE="${API_BASE:-https://24b32699-be8c-4dc6-814e-6763eb4e8201.preview.emergentagent.com}"
ADMIN_USER="${ADMIN_USER:-superadmin@metryx.one}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"
COOKIE="$(mktemp)"

if [ ! -f "$CSV_FILE" ]; then
  echo "❌ CSV file not found: $CSV_FILE"
  echo "   Use template: /app/scripts/pricing-template.csv"
  exit 1
fi

echo "→ Logging in as $ADMIN_USER ..."
LOGIN=$(curl -s -c "$COOKIE" -X POST "$API_BASE/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
echo "$LOGIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print('   Logged in as', d.get('username'),'role',d.get('role'))" || { echo "❌ Login failed"; exit 1; }

echo "→ Importing $CSV_FILE ..."
RESP=$(curl -s -b "$COOKIE" -X POST "$API_BASE/api/admin/subscription-packages/import" \
  -F "file=@$CSV_FILE")
echo "   Server response: $RESP"

INSERTED=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('inserted',0))" 2>/dev/null || echo 0)
UPDATED=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('updated',0))" 2>/dev/null || echo 0)
ERRORS=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('errorCount',0))" 2>/dev/null || echo 0)

echo
echo "✅ Done — $INSERTED inserted, $UPDATED updated, $ERRORS errors."
echo "→ Verifying AI bot picked up new prices..."
sleep 1
TEST=$(curl -s -X POST "$API_BASE/api/chat/message" \
  -H "Content-Type: application/json" \
  -d '{"message":"What plans do you offer? List with prices.","sessionId":"price-verify","language":"en"}' \
  --max-time 30 | python3 -c "import sys,json;print(json.load(sys.stdin).get('response','(no response)'))")
echo
echo "🤖 AI bot reply:"
echo "─────────────────"
echo "$TEST"
echo "─────────────────"
echo
echo "📊 Public preview: $API_BASE/?screen=admin-pricing"

rm -f "$COOKIE"
