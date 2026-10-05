#!/usr/bin/env sh
# Usage: EI_API_KEY=ei_… scripts/check-presentations-api-doc.sh
# Sends the createPresentation example from docs/presentations-api.md to the dev
# API and fails unless it is accepted. Deletes the deck afterwards.
set -eu
API="${API_URL:-http://localhost:4050/graphql}"
INPUT=$(awk '/^```json$/{f=1;next} /^```$/{if(f){exit}} f' docs/presentations-api.md | sed 's#/uploads/<file>.png#https://engenhariainversa.com.br/images/live-studio.png#; s#https://…/print.png#https://engenhariainversa.com.br/images/ep-01.png#')
BODY=$(printf '{"query":"mutation($input: CreatePresentationInput!){ createPresentation(input:$input){ id slideCount } }","variables":%s}' "$INPUT")
RES=$(curl -s -X POST "$API" -H "Content-Type: application/json" -H "Authorization: Bearer $EI_API_KEY" -d "$BODY")
echo "$RES"
echo "$RES" | grep -q '"slideCount":11' || { echo "doc example rejected"; exit 1; }
ID=$(echo "$RES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -s -X POST "$API" -H "Content-Type: application/json" -H "Authorization: Bearer $EI_API_KEY" \
  -d "{\"query\":\"mutation{ deletePresentation(id:\\\"$ID\\\") }\"}" > /dev/null
echo "ok"
