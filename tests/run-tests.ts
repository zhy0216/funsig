/**
 * Simple test runner for funsig
 */
import * as path from 'path';
// Import the test functions from parser.test.ts
import { testParseFixture, testParseDirectory, testErrorHandling } from './parser.test';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test statistics
let passed = 0;
let failed = 0;
let total = 0;

/**
 * Run a test and update statistics
 * @param name Test name
 * @param testFn Test function
 */
async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
  console.log(`${colors.cyan}Test: ${name}${colors.reset}`);
  total++;
  
  try {
    const result = await testFn();
    if (result) {
      passed++;
      console.log(`${colors.green}✓ PASS${colors.reset}: ${name}\n`);
    } else {
      failed++;
      console.log(`${colors.red}✗ FAIL${colors.reset}: ${name}\n`);
    }
  } catch (error) {
    failed++;
    console.error(`Error running test "${name}":`, error);
    console.log(`${colors.red}✗ FAIL${colors.reset}: ${name} (threw exception)\n`);
  }
}

/**
 * Print test results
 */
function printResults(): void {
  console.log('\n-----------------------------');
  console.log(`${colors.blue}Test Results:${colors.reset}`);
  console.log(`Total tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log('-----------------------------\n');
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

/**
 * Run all parser tests
 */
async function runParserTests(): Promise<void> {
  console.log(`\n${colors.magenta}Running Parser Tests...${colors.reset}\n`);
  
  // Test parsing a single fixture file
  await runTest('Parse fixture file and compare with expected output', testParseFixture);
  
  // Test parsing a directory
  await runTest('Parse directory', testParseDirectory);
  
  // Test error handling
  await runTest('Error handling', testErrorHandling);
}

/**
 * Main test function
 */
async function runTests(): Promise<void> {
  console.log(`${colors.blue}Running funsig Tests${colors.reset}`);
  console.log('===============================');
  
  try {
    await runParserTests();
    
    // Add more test suites here
    
    printResults();
  } catch (error) {
    console.error('Unhandled error during tests:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
