#!/bin/bash

# Functional test script for Ruler Rust port
# This script tests the Rust implementation against the TypeScript implementation
# to ensure 100% functional compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test directories
TEST_DIR="/tmp/ruler-functional-test"
TS_TEST_DIR="$TEST_DIR/ts-test"
RUST_TEST_DIR="$TEST_DIR/rust-test"

# Paths to executables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUST_RULER="$SCRIPT_DIR/../target/debug/ruler"
TS_RULER_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")" # Go up two levels to get to main repo

echo -e "${YELLOW}Starting Ruler Functional Test Suite${NC}"
echo "Rust executable: $RUST_RULER"
echo "TypeScript directory: $TS_RULER_DIR"

# Cleanup function
cleanup() {
    rm -rf "$TEST_DIR"
}

# Setup function
setup() {
    echo -e "${YELLOW}Setting up test environment...${NC}"
    cleanup
    mkdir -p "$TS_TEST_DIR" "$RUST_TEST_DIR"
}

# Function to compare files
compare_files() {
    local file1="$1"
    local file2="$2"
    local description="$3"
    
    if cmp -s "$file1" "$file2"; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        echo "Differences found:"
        diff -u "$file1" "$file2" || true
        return 1
    fi
}

# Function to compare directory structures
compare_directories() {
    local dir1="$1"
    local dir2="$2"
    local description="$3"
    
    echo "Comparing directory structures: $description"
    
    # Get file lists (relative paths)
    local files1=$(cd "$dir1" && find . -type f | sort)
    local files2=$(cd "$dir2" && find . -type f | sort)
    
    if [ "$files1" = "$files2" ]; then
        echo -e "${GREEN}✓${NC} Directory structures match"
        
        # Compare each file content
        local all_files_match=true
        while IFS= read -r file; do
            if [ -f "$dir1/$file" ] && [ -f "$dir2/$file" ]; then
                if ! compare_files "$dir1/$file" "$dir2/$file" "File: $file"; then
                    all_files_match=false
                fi
            fi
        done <<< "$files1"
        
        return $($all_files_match && echo 0 || echo 1)
    else
        echo -e "${RED}✗${NC} Directory structures differ"
        echo "TypeScript files:"
        echo "$files1"
        echo "Rust files:"
        echo "$files2"
        return 1
    fi
}

# Test 1: Basic init command
test_init() {
    echo -e "${YELLOW}Test 1: Basic init command${NC}"
    
    # Test TypeScript init
    cd "$TS_TEST_DIR"
    if command -v node >/dev/null 2>&1; then
        node "$TS_RULER_DIR/dist/cli/index.js" init >/dev/null 2>&1 || {
            echo -e "${RED}✗${NC} TypeScript ruler init failed"
            return 1
        }
    else
        echo -e "${YELLOW}!${NC} Node.js not available, skipping TypeScript test"
        return 1
    fi
    
    # Test Rust init
    cd "$RUST_TEST_DIR"
    "$RUST_RULER" init >/dev/null 2>&1 || {
        echo -e "${RED}✗${NC} Rust ruler init failed"
        return 1
    }
    
    # Compare results
    compare_directories "$TS_TEST_DIR" "$RUST_TEST_DIR" "init command output"
}

# Test 2: Init with global flag
test_init_global() {
    echo -e "${YELLOW}Test 2: Init with --global flag${NC}"
    
    # Create temporary home directories
    local ts_home="$TS_TEST_DIR/home"
    local rust_home="$RUST_TEST_DIR/home"
    mkdir -p "$ts_home" "$rust_home"
    
    # Test TypeScript init --global
    cd "$TS_TEST_DIR"
    if command -v node >/dev/null 2>&1; then
        HOME="$ts_home" node "$TS_RULER_DIR/dist/cli/index.js" init --global >/dev/null 2>&1 || {
            echo -e "${RED}✗${NC} TypeScript ruler init --global failed"
            return 1
        }
    else
        echo -e "${YELLOW}!${NC} Node.js not available, skipping TypeScript test"
        return 1
    fi
    
    # Test Rust init --global
    cd "$RUST_TEST_DIR"
    HOME="$rust_home" "$RUST_RULER" init --global >/dev/null 2>&1 || {
        echo -e "${RED}✗${NC} Rust ruler init --global failed"
        return 1
    }
    
    # Compare the global config directories
    compare_directories "$ts_home/.config/ruler" "$rust_home/.config/ruler" "global init output"
}

# Test 3: Help output comparison
test_help() {
    echo -e "${YELLOW}Test 3: Help output comparison${NC}"
    
    local ts_help="$TEST_DIR/ts-help.txt"
    local rust_help="$TEST_DIR/rust-help.txt"
    
    # Get TypeScript help
    if command -v node >/dev/null 2>&1; then
        cd "$TS_RULER_DIR" && node dist/cli/index.js --help > "$ts_help" 2>&1 || {
            echo -e "${RED}✗${NC} Could not get TypeScript help"
            return 1
        }
    else
        echo -e "${YELLOW}!${NC} Node.js not available, skipping help comparison"
        return 1
    fi
    
    # Get Rust help
    "$RUST_RULER" --help > "$rust_help" 2>&1 || {
        echo -e "${RED}✗${NC} Could not get Rust help"
        return 1
    }
    
    # Check that both contain the core commands (init, apply, revert)
    local ts_has_commands=0
    local rust_has_commands=0
    
    if grep -q "init" "$ts_help" && grep -q "apply" "$ts_help" && grep -q "revert" "$ts_help"; then
        ts_has_commands=1
    fi
    
    if grep -q "init" "$rust_help" && grep -q "apply" "$rust_help" && grep -q "revert" "$rust_help"; then
        rust_has_commands=1
    fi
    
    if [ $ts_has_commands -eq 1 ] && [ $rust_has_commands -eq 1 ]; then
        echo -e "${GREEN}✓${NC} Both help outputs contain core commands (init, apply, revert)"
    else
        echo -e "${RED}✗${NC} Help outputs missing core commands"
        echo "TypeScript help:"
        cat "$ts_help"
        echo "Rust help:"
        cat "$rust_help"
        return 1
    fi
}

# Test 4: Version output
test_version() {
    echo -e "${YELLOW}Test 4: Version output${NC}"
    
    # Test Rust version
    local rust_version=$("$RUST_RULER" --version 2>&1)
    if [[ "$rust_version" == *"0.2.19"* ]]; then
        echo -e "${GREEN}✓${NC} Rust version output correct"
    else
        echo -e "${RED}✗${NC} Rust version output: $rust_version"
        return 1
    fi
}

# Test 5: Apply command (basic test)
test_apply_basic() {
    echo -e "${YELLOW}Test 5: Basic apply command${NC}"
    
    # Setup test environment with .ruler directory
    cd "$TS_TEST_DIR"
    mkdir -p .ruler
    echo "# Test Rule" > .ruler/test.md
    echo '[agents.copilot]
enabled = true' > .ruler/ruler.toml
    
    cd "$RUST_TEST_DIR"
    mkdir -p .ruler
    echo "# Test Rule" > .ruler/test.md
    echo '[agents.copilot]
enabled = true' > .ruler/ruler.toml
    
    # Test Rust apply (should not crash)
    cd "$RUST_TEST_DIR"
    "$RUST_RULER" apply >/dev/null 2>&1 || {
        echo -e "${RED}✗${NC} Rust apply command failed"
        return 1
    }
    
    echo -e "${GREEN}✓${NC} Apply command executed without error"
}

# Main test execution
run_tests() {
    setup
    
    local tests_run=0
    local tests_passed=0
    
    for test_func in test_init test_init_global test_help test_version test_apply_basic; do
        tests_run=$((tests_run + 1))
        echo
        if $test_func; then
            tests_passed=$((tests_passed + 1))
        fi
    done
    
    echo
    echo -e "${YELLOW}Test Results:${NC}"
    echo "Tests run: $tests_run"
    echo "Tests passed: $tests_passed"
    
    if [ $tests_passed -eq $tests_run ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        cleanup
        exit 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        cleanup
        exit 1
    fi
}

# Check if Rust executable exists
if [ ! -f "$RUST_RULER" ]; then
    echo -e "${RED}Error: Rust ruler executable not found at $RUST_RULER${NC}"
    echo "Please build the Rust project first with: cargo build"
    exit 1
fi

# Run all tests
run_tests
