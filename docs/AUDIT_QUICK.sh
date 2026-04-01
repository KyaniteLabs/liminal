#!/bin/bash
# Quick Pre-Flight Audit Script
# Run this to verify harness readiness

echo "🔍 Liminal Harness Pre-Flight Audit"
echo "===================================="
echo ""

cd /Users/simongonzalezdecruz/workspaces/liminal

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN++))
}

echo "1. Checking build status..."
if npm run build 2>&1 | grep -q "error TS"; then
    check_fail "TypeScript build has errors"
else
    check_pass "TypeScript build passes"
fi

echo ""
echo "2. Checking dependencies..."
if [ -d "node_modules/ink" ]; then
    check_pass "TUI dependencies present"
else
    check_fail "TUI dependencies missing (run npm install)"
fi

echo ""
echo "3. Checking harness core files..."
if [ -f "src/harness/index.ts" ]; then
    check_pass "Harness index exists"
else
    check_fail "Harness index missing"
fi

if [ -f "src/harness/MetaHarnessIntegration.ts" ]; then
    check_pass "MetaHarnessIntegration exists"
else
    check_fail "MetaHarnessIntegration missing"
fi

if [ -f "src/harness/agent/HarnessAgent.ts" ]; then
    check_pass "HarnessAgent exists"
else
    check_fail "HarnessAgent missing"
fi

echo ""
echo "4. Checking wiring..."
if grep -q "metaHarness" src/core/RalphLoop.ts 2>/dev/null; then
    check_pass "RalphLoop wired to metaHarness"
else
    check_fail "RalphLoop NOT wired to metaHarness"
fi

if grep -q "metaHarness" src/index.ts 2>/dev/null; then
    check_pass "src/index.ts wired to metaHarness"
else
    check_fail "src/index.ts NOT wired to metaHarness"
fi

echo ""
echo "5. Checking task files..."
TASK_COUNT=$(ls harness-tasks/*.json 2>/dev/null | wc -l)
if [ $TASK_COUNT -ge 5 ]; then
    check_pass "Found $TASK_COUNT task files"
else
    check_fail "Only $TASK_COUNT task files (expected 5+)"
fi

for task in M1 M4 M6 M7 M8; do
    if [ -f "harness-tasks/$task.json" ]; then
        if python3 -m json.tool "harness-tasks/$task.json" > /dev/null 2>&1; then
            check_pass "Task $task is valid JSON"
        else
            check_fail "Task $task has invalid JSON"
        fi
    else
        check_fail "Task $task missing"
    fi
done

echo ""
echo "6. Checking safety systems..."
if [ -f "src/harness/tools/ValidationGuard.ts" ]; then
    check_pass "ValidationGuard exists"
else
    check_fail "ValidationGuard missing"
fi

if [ -f "src/harness/tools/RateLimiter.ts" ]; then
    check_pass "RateLimiter exists"
else
    check_fail "RateLimiter missing"
fi

if [ -d ".liminal" ]; then
    check_pass "Backup directory exists"
else
    check_warn "Backup directory missing (will be created)"
fi

echo ""
echo "7. Checking TUI..."
if [ -f "src/tui/HarnessTUI.tsx" ]; then
    check_pass "TUI main file exists"
else
    check_fail "TUI main file missing"
fi

if grep -q '"tui":' package.json 2>/dev/null; then
    check_pass "npm run tui script exists"
else
    check_fail "npm run tui script missing"
fi

echo ""
echo "8. Checking LLM configuration..."
if [ -n "$LIMINAL_LLM_BASE_URL" ] || [ -n "$OPENAI_API_KEY" ] || [ -n "$MINIMAX_API_KEY" ]; then
    check_pass "LLM provider configured"
else
    check_warn "No LLM provider configured (will use defaults)"
fi

echo ""
echo "===================================="
echo "AUDIT COMPLETE"
echo "===================================="
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ GO - Harness is ready${NC}"
    echo ""
    echo "Next steps:"
    echo "  npm run tui"
    echo "  /status"
    echo "  /run M1"
    exit 0
else
    echo -e "${RED}❌ NO-GO - Fix $FAIL critical issues first${NC}"
    exit 1
fi
