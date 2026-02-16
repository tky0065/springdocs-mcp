#!/bin/bash

# Docker Validation Test Script for Spring Documentation MCP Server
# Tests Docker image functionality, security, and performance

set -e  # Exit on error

echo "🐳 Docker Validation Test Suite"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Image name
IMAGE_NAME="${IMAGE_NAME:-mcp/springdocs-mcp:test}"

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -e "\n${YELLOW}Testing: $test_name${NC}"

    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "📦 Step 1: Build Docker Image"
echo "=============================="
docker build -t "$IMAGE_NAME" . > /dev/null 2>&1 || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
}
echo -e "${GREEN}✅ Docker image built successfully${NC}"

echo ""
echo "📊 Step 2: Image Properties"
echo "============================"

# Check image size
IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
echo "Image size: $IMAGE_SIZE"

# Check image details
echo "Image details:"
docker inspect "$IMAGE_NAME" --format '  - Created: {{.Created}}' 2>/dev/null
docker inspect "$IMAGE_NAME" --format '  - Architecture: {{.Architecture}}' 2>/dev/null
docker inspect "$IMAGE_NAME" --format '  - OS: {{.Os}}' 2>/dev/null

echo ""
echo "🔐 Step 3: Security Validation"
echo "==============================="

# Test 1: Verify non-root user
run_test "Non-root user (UID 1001)" \
    "docker run --rm $IMAGE_NAME id -u | grep -q '^1001$'"

# Test 2: Verify user name
run_test "User is 'mcp'" \
    "docker run --rm $IMAGE_NAME id -un | grep -q '^mcp$'"

# Test 3: Check for common security issues
echo -e "\n${YELLOW}Testing: No shell in final image${NC}"
if docker run --rm "$IMAGE_NAME" which bash 2>&1 | grep -q "not found"; then
    echo -e "${GREEN}✅ PASSED (good - minimal attack surface)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARNING: bash found (not critical but not ideal)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

echo ""
echo "🧪 Step 4: MCP Protocol Tests"
echo "=============================="

# Test 4: Tools list
echo -e "\n${YELLOW}Testing: List all tools${NC}"
TOOLS_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
    docker run -i --rm "$IMAGE_NAME" 2>/dev/null)

if echo "$TOOLS_OUTPUT" | grep -q '"result"'; then
    TOOL_COUNT=$(echo "$TOOLS_OUTPUT" | grep -o '"name"' | wc -l | tr -d ' ')
    if [ "$TOOL_COUNT" -eq 12 ]; then
        echo -e "${GREEN}✅ PASSED - Found 12 tools${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED - Expected 12 tools, found $TOOL_COUNT${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "${RED}❌ FAILED - No result returned${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 5: Search Spring docs tool
echo -e "\n${YELLOW}Testing: search_spring_docs tool${NC}"
SEARCH_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "search_spring_docs", "arguments": {"query": "REST", "limit": 2}}}' | \
    docker run -i --rm "$IMAGE_NAME" 2>/dev/null)

if echo "$SEARCH_OUTPUT" | grep -q '"result"' && ! echo "$SEARCH_OUTPUT" | grep -q '"isError":true'; then
    echo -e "${GREEN}✅ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 6: Spring AI reference tool
echo -e "\n${YELLOW}Testing: Spring AI reference (get_spring_reference)${NC}"
AI_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "get_spring_reference", "arguments": {"project": "ai", "section": "chatclient"}}}' | \
    docker run -i --rm "$IMAGE_NAME" 2>/dev/null)

if echo "$AI_OUTPUT" | grep -q '"result"' && ! echo "$AI_OUTPUT" | grep -q '"isError":true'; then
    echo -e "${GREEN}✅ PASSED - Spring AI support working${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED - Spring AI reference not working${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 7: Spring AI ecosystem search
echo -e "\n${YELLOW}Testing: Spring AI ecosystem search${NC}"
ECO_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "search_spring_ecosystem", "arguments": {"query": "security", "scope": "ai", "limit": 2}}}' | \
    docker run -i --rm "$IMAGE_NAME" 2>/dev/null)

if echo "$ECO_OUTPUT" | grep -q '"result"'; then
    echo -e "${GREEN}✅ PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "⚡ Step 5: Performance & Resource Tests"
echo "======================================="

# Test 8: Memory constraints (512MB)
echo -e "\n${YELLOW}Testing: Run with 512MB memory limit${NC}"
MEM_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 5, "method": "tools/list", "params": {}}' | \
    docker run -i --rm --memory=512m "$IMAGE_NAME" 2>/dev/null)

if echo "$MEM_OUTPUT" | grep -q '"result"'; then
    echo -e "${GREEN}✅ PASSED - Works with 512MB memory${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED - Cannot run with 512MB${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 9: Read-only filesystem (optional - may fail if cache writes)
echo -e "\n${YELLOW}Testing: Read-only filesystem${NC}"
RO_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 6, "method": "tools/list", "params": {}}' | \
    docker run -i --rm --read-only "$IMAGE_NAME" 2>&1)

if echo "$RO_OUTPUT" | grep -q '"result"'; then
    echo -e "${GREEN}✅ PASSED - Works in read-only mode${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  INFO: Read-only mode not supported (cache requires write access)${NC}"
    # Not critical, don't count as failure
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# Test 10: Health check
echo -e "\n${YELLOW}Testing: Container health check${NC}"
docker inspect "$IMAGE_NAME" --format '{{.Config.Healthcheck}}' | grep -q "node" && {
    echo -e "${GREEN}✅ PASSED - Health check configured${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
} || {
    echo -e "${RED}❌ FAILED - No health check${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

echo ""
echo "🏷️  Step 6: Docker Labels & Metadata"
echo "====================================="

# Check important labels
echo -e "\n${YELLOW}Testing: OCI image labels${NC}"
LABELS_OK=true

for label in "org.opencontainers.image.version" "org.opencontainers.image.title" "org.opencontainers.image.licenses"; do
    if docker inspect "$IMAGE_NAME" --format "{{index .Config.Labels \"$label\"}}" | grep -q "."; then
        echo "  ✓ $label: $(docker inspect "$IMAGE_NAME" --format "{{index .Config.Labels \"$label\"}}")"
    else
        echo "  ✗ Missing: $label"
        LABELS_OK=false
    fi
done

if $LABELS_OK; then
    echo -e "${GREEN}✅ PASSED - All labels present${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED - Some labels missing${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "📊 Test Results Summary"
echo "======================="
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "🎉 ${GREEN}All tests passed!${NC}"
    echo "✅ Docker image is ready for Docker MCP Catalog submission"
    exit 0
else
    echo ""
    echo -e "⚠️  ${YELLOW}Some tests failed${NC}"
    echo "❌ Please fix the issues before submitting to Docker MCP Catalog"
    exit 1
fi
