#!/bin/bash
# ===========================================
# Manus Deployment Script
# نشر التطبيق على منصة Manus
# ===========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Manus Deployment Script - Symbol AI ERP   ${NC}"
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
echo "  API URL: $MANUS_API_URL"
echo ""

# Create deployment task
echo -e "${BLUE}Creating deployment task...${NC}"

RESPONSE=$(curl -s -X POST "$MANUS_API_URL/tasks" \
  -H "Authorization: Bearer $MANUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"Deploy ERP system from GitHub $GITHUB_REPO branch $BRANCH to $DOMAIN. Build command: pnpm install && pnpm build. Start command: pnpm start. Port: 3000. Environment: NODE_ENV=production. Generate secure JWT_SECRET. Use managed database for DATABASE_URL.\",
    \"type\": \"deploy\",
    \"config\": {
      \"github_url\": \"$GITHUB_REPO\",
      \"branch\": \"$BRANCH\",
      \"domain\": \"$DOMAIN\",
      \"build_command\": \"pnpm install && pnpm build\",
      \"start_command\": \"pnpm start\",
      \"port\": 3000
    }
  }")

# Check response
if echo "$RESPONSE" | grep -q "id"; then
    TASK_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Deployment task created!${NC}"
    echo -e "  Task ID: ${YELLOW}$TASK_ID${NC}"
    echo ""
    echo -e "${BLUE}Check status:${NC}"
    echo "  curl -H \"Authorization: Bearer \$MANUS_API_KEY\" $MANUS_API_URL/tasks/$TASK_ID"
    echo ""
    echo -e "${BLUE}Or visit:${NC}"
    echo "  https://manus.im/tasks/$TASK_ID"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    echo "Response: $RESPONSE"
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
echo -e "  ${BLUE}https://$DOMAIN/api/debug${NC}"
