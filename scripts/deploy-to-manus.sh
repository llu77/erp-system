#!/bin/bash
# ===========================================
# Manus Deployment Script - Node.js Server
# نشر التطبيق على منصة Manus (Node.js وليس Cloudflare Workers)
# ===========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Manus Deployment Script - Symbol AI ERP   ${NC}"
echo -e "${BLUE}   Node.js Server Deployment (NOT Workers)   ${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
    echo -e "${GREEN}✓ Loaded .env file${NC}"
else
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

# Check required variables
if [ -z "$MANUS_API_KEY" ]; then
    echo -e "${RED}✗ MANUS_API_KEY not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✓ MANUS_API_KEY found${NC}"

# API Configuration
MANUS_API_URL="${MANUS_API_URL:-https://api.manus.ai/v1}"
GITHUB_REPO="https://github.com/llu77/erp-system"
BRANCH="claude/api-key-security-VbnVn"
DOMAIN="sym.manus.space"

echo ""
echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  Repository: $GITHUB_REPO"
echo "  Branch: $BRANCH"
echo "  Domain: $DOMAIN"
echo "  Runtime: Node.js (NOT Cloudflare Workers)"
echo "  API URL: $MANUS_API_URL"
echo ""

# Create deployment task with explicit Node.js configuration
echo -e "${BLUE}Creating Node.js server deployment task...${NC}"

DEPLOY_PROMPT="Deploy the ERP system from GitHub repository $GITHUB_REPO branch $BRANCH to $DOMAIN.

CRITICAL: This is a Node.js Express server with MySQL database.
DO NOT use Cloudflare Workers or wrangler deploy.
This application requires:
- Persistent Node.js runtime (NOT serverless/edge)
- MySQL database connection (DATABASE_URL)
- Express.js HTTP server on port 3000

Build Configuration:
- Install: pnpm install
- Build: pnpm build (outputs to dist/)
- Start: NODE_ENV=production node dist/index.js
- Port: 3000

Static Assets: dist/public (served by Express)
Server Entry: dist/index.js

Environment Variables Required:
- DATABASE_URL: Use Manus managed MySQL database
- JWT_SECRET: Generate a secure 64-character random string
- NODE_ENV: production

Health Check Endpoints:
- /health (for load balancer)
- /api/health (detailed status)

Please deploy this as a Node.js server application with database support."

RESPONSE=$(curl -s -X POST "$MANUS_API_URL/tasks" \
  -H "Authorization: Bearer $MANUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": $(echo "$DEPLOY_PROMPT" | jq -Rs .),
    \"taskMode\": \"agent\",
    \"agentProfile\": \"manus-1.6\"
  }")

# Check response
if echo "$RESPONSE" | grep -q "task_id\|id"; then
    TASK_ID=$(echo "$RESPONSE" | jq -r '.task_id // .id // "unknown"')
    TASK_URL=$(echo "$RESPONSE" | jq -r '.task_url // "unknown"')
    echo -e "${GREEN}✓ Deployment task created!${NC}"
    echo -e "  Task ID: ${YELLOW}$TASK_ID${NC}"
    if [ "$TASK_URL" != "unknown" ] && [ "$TASK_URL" != "null" ]; then
        echo -e "  Task URL: ${BLUE}$TASK_URL${NC}"
    fi
    echo ""
    echo -e "${BLUE}Check status:${NC}"
    echo "  curl -H \"Authorization: Bearer \$MANUS_API_KEY\" $MANUS_API_URL/tasks/$TASK_ID"
    echo ""
    echo -e "${BLUE}Or visit Manus dashboard:${NC}"
    echo "  https://manus.im"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo -e "${YELLOW}Alternative: Deploy via Manus Chat${NC}"
    echo "1. Open https://manus.im"
    echo "2. Start a new conversation"
    echo "3. Paste this prompt:"
    echo ""
    echo "---"
    echo "$DEPLOY_PROMPT"
    echo "---"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Deployment initiated successfully!        ${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "After deployment completes, your app will be at:"
echo -e "  ${BLUE}https://$DOMAIN${NC}"
echo ""
echo -e "Health check endpoints:"
echo -e "  ${BLUE}https://$DOMAIN/health${NC}"
echo -e "  ${BLUE}https://$DOMAIN/api/health${NC}"
echo ""
