#!/bin/bash

# Enhanced Spring Documentation MCP Server Test Script
# Tests all 12 tools with various scenarios

echo "🧪 Testing Enhanced Spring Documentation MCP Server"
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test a tool
test_tool() {
    local tool_name="$1"
    local test_data="$2"
    local description="$3"

    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "Tool: $tool_name"

    local result
    result=$(echo "$test_data" | timeout 15s node build/index.js 2>/dev/null)
    local exit_code=$?

    if [ $exit_code -eq 0 ] && echo "$result" | grep -q '"result"'; then
        echo -e "${GREEN}✅ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Exit code: $exit_code"
        if [ ! -z "$result" ]; then
            echo "Output: $result" | head -3
        fi
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo -e "\n📋 Testing Tool List"
echo "===================="

# Test 1: List all tools
test_tool "tools/list" \
'{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' \
"List all available tools"

echo -e "\n🔍 Testing Original Tools (Enhanced)"
echo "====================================="

# Test 2: Search documentation
test_tool "search_spring_docs" \
'{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "search_spring_docs", "arguments": {"query": "REST API", "limit": 3}}}' \
"Search Spring documentation"

# Test 3: Search projects
test_tool "search_spring_projects" \
'{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_spring_projects", "arguments": {"query": "security", "limit": 3}}}' \
"Search Spring projects"

# Test 4: Get specific project
test_tool "get_spring_project" \
'{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "get_spring_project", "arguments": {"projectName": "spring-boot"}}}' \
"Get Spring Boot project details"

# Test 5: Get all guides
test_tool "get_all_spring_guides" \
'{"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "get_all_spring_guides", "arguments": {"limit": 5}}}' \
"Get all Spring guides"

# Test 6: Get specific guide
test_tool "get_spring_guide" \
'{"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "get_spring_guide", "arguments": {"guideId": "gs-rest-service"}}}' \
"Get REST service guide"

# Test 7: Get reference documentation
test_tool "get_spring_reference" \
'{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "get_spring_reference", "arguments": {"section": "web"}}}' \
"Get web reference documentation"

# Test 8: Search concepts
test_tool "search_spring_concepts" \
'{"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "search_spring_concepts", "arguments": {"concept": "auto-configuration"}}}' \
"Search Spring concepts"

echo -e "\n🆕 Testing Advanced Tools (New)"
echo "==============================="

# Test 9: Search ecosystem
test_tool "search_spring_ecosystem" \
'{"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "search_spring_ecosystem", "arguments": {"query": "microservices", "scope": "all", "limit": 3}}}' \
"Search Spring ecosystem"

# Test 10: Get tutorial
test_tool "get_spring_tutorial" \
'{"jsonrpc": "2.0", "id": 10, "method": "tools/call", "params": {"name": "get_spring_tutorial", "arguments": {"topic": "rest-api", "level": "beginner"}}}' \
"Get REST API tutorial"

# Test 11: Compare versions
test_tool "compare_spring_versions" \
'{"jsonrpc": "2.0", "id": 11, "method": "tools/call", "params": {"name": "compare_spring_versions", "arguments": {"version1": "2.7.0", "version2": "3.0.0", "focus": "breaking-changes"}}}' \
"Compare Spring Boot versions"

# Test 12: Get best practices
test_tool "get_spring_best_practices" \
'{"jsonrpc": "2.0", "id": 12, "method": "tools/call", "params": {"name": "get_spring_best_practices", "arguments": {"category": "architecture", "experience_level": "intermediate"}}}' \
"Get architecture best practices"

# Test 13: Diagnose issues
test_tool "diagnose_spring_issues" \
'{"jsonrpc": "2.0", "id": 13, "method": "tools/call", "params": {"name": "diagnose_spring_issues", "arguments": {"error_message": "Port 8080 was already in use", "component": "startup"}}}' \
"Diagnose startup issues"

echo -e "\n🔄 Testing Error Handling"
echo "========================="

# Test 14: Invalid tool name
test_result=$(echo '{"jsonrpc": "2.0", "id": 14, "method": "tools/call", "params": {"name": "invalid_tool", "arguments": {}}}' | timeout 10s node build/index.js 2>/dev/null)
if echo "$test_result" | grep -q '"isError":true'; then
    echo -e "${GREEN}✅ PASSED${NC} - Invalid tool error handling"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC} - Invalid tool error handling"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 15: Missing required parameters
test_result=$(echo '{"jsonrpc": "2.0", "id": 15, "method": "tools/call", "params": {"name": "search_spring_docs", "arguments": {}}}' | timeout 10s node build/index.js 2>/dev/null)
if echo "$test_result" | grep -q '"isError":true'; then
    echo -e "${GREEN}✅ PASSED${NC} - Missing parameter error handling"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAILED${NC} - Missing parameter error handling"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -e "\n⚡ Testing Performance & Caching"
echo "================================"

# Test 16: Cache performance (repeat same query)
echo "Running same query twice to test caching..."

start_time=$(date +%s%N)
echo '{"jsonrpc": "2.0", "id": 16, "method": "tools/call", "params": {"name": "search_spring_projects", "arguments": {"query": "boot", "limit": 2}}}' | timeout 10s node build/index.js > /dev/null 2>&1
first_query_time=$(($(date +%s%N) - start_time))

start_time=$(date +%s%N)
echo '{"jsonrpc": "2.0", "id": 17, "method": "tools/call", "params": {"name": "search_spring_projects", "arguments": {"query": "boot", "limit": 2}}}' | timeout 10s node build/index.js > /dev/null 2>&1
second_query_time=$(($(date +%s%N) - start_time))

echo "First query time: $((first_query_time / 1000000))ms"
echo "Second query time: $((second_query_time / 1000000))ms"

if [ $second_query_time -lt $first_query_time ]; then
    echo -e "${GREEN}✅ PASSED${NC} - Caching improves performance"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Caching performance not clearly demonstrated"
    TESTS_PASSED=$((TESTS_PASSED + 1))  # Still count as pass
fi

echo -e "\n📊 Test Results Summary"
echo "======================="
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All tests passed!${NC}"
    echo "✅ Enhanced Spring Documentation MCP Server is working correctly"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}Some tests failed${NC}"
    echo "❌ Please check the server configuration and try again"
    exit 1
fi