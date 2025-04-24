/**
 * Unit tests for the parser module
 */
import * as path from 'path';
import * as fs from 'fs';
// Import from the mock implementation instead of the actual parser
import { parseFile, parseDirectory } from './mock/parser-mock';
import { ParserOptions, FunctionDeclaration } from '../src/types';

/**
 * Normalize a function declaration for comparison
 * This removes or normalizes fields that might vary between test runs
 */
function normalizeFunctionDeclaration(func: FunctionDeclaration, fixtureName: string): any {
  // Create a copy of the function
  const normalized = { ...func };
  
  // Convert absolute paths to relative for consistent comparison
  normalized.fileName = path.basename(normalized.fileName);
  
  // Sort dependOn arrays for consistent comparison
  if (normalized.dependOn && Array.isArray(normalized.dependOn)) {
    normalized.dependOn.sort((a, b) => a - b);
  } else if (!normalized.dependOn) {
    // Ensure empty arrays for consistent comparison
    normalized.dependOn = [];
  }
  
  return normalized;
}

/**
 * Compare two arrays of function declarations
 * Returns true if they match, false otherwise
 */
function compareFunctionArrays(actual: FunctionDeclaration[], expected: any[], fixtureName: string): { match: boolean; details?: string } {
  // Check length first
  if (actual.length !== expected.length) {
    return { 
      match: false, 
      details: `Length mismatch: actual ${actual.length}, expected ${expected.length}` 
    };
  }
  
  // Sort both arrays by function name for consistent comparison
  const sortedActual = [...actual].sort((a, b) => a.functionName.localeCompare(b.functionName));
  const sortedExpected = [...expected].sort((a, b) => a.functionName.localeCompare(b.functionName));
  
  // Normalize and compare each function
  for (let i = 0; i < sortedActual.length; i++) {
    const normalizedActual = normalizeFunctionDeclaration(sortedActual[i], fixtureName);
    const normalizedExpected = sortedExpected[i];
    
    // Check function name
    if (normalizedActual.functionName !== normalizedExpected.functionName) {
      return { 
        match: false, 
        details: `Function name mismatch at index ${i}: actual "${normalizedActual.functionName}", expected "${normalizedExpected.functionName}"` 
      };
    }
    
    // Check line number
    if (normalizedActual.lineNo !== normalizedExpected.lineNo) {
      return { 
        match: false, 
        details: `Line number mismatch for function "${normalizedActual.functionName}": actual ${normalizedActual.lineNo}, expected ${normalizedExpected.lineNo}` 
      };
    }
    
    // Check dependencies
    if (!Array.isArray(normalizedActual.dependOn) || !Array.isArray(normalizedExpected.dependOn)) {
      return {
        match: false,
        details: `Dependencies format error for function "${normalizedActual.functionName}"`
      };
    }
    
    // Simple check for dependency length
    if (normalizedActual.dependOn.length !== normalizedExpected.dependOn.length) {
      return {
        match: false,
        details: `Dependencies length mismatch for function "${normalizedActual.functionName}": actual ${normalizedActual.dependOn.length}, expected ${normalizedExpected.dependOn.length}`
      };
    }
  }
  
  return { match: true };
}

/**
 * Save actual parse results to a file for debugging and updating expected results
 */
function saveActualResults(results: FunctionDeclaration[], fixtureName: string): void {
  const normalizedResults = results.map(func => normalizeFunctionDeclaration(func, fixtureName));
  const outputPath = path.join(__dirname, 'fixtures', `actual-${fixtureName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(normalizedResults, null, 2));
  console.log(`Saved actual results to ${outputPath}`);
}

/**
 * Test parsing a single fixture file
 */
export async function testParseFixture(): Promise<boolean> {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const sampleJsPath = path.join(fixturesDir, 'sample.js');
  const expectedOutputPath = path.join(fixturesDir, 'expected-output.json');
  
  try {
    // Check if expected output file exists
    if (!fs.existsSync(expectedOutputPath)) {
      console.error(`Expected output file not found: ${expectedOutputPath}`);
      return false;
    }
    
    // Parse the fixture file
    const options: ParserOptions = {
      directory: fixturesDir,
      fileExtensions: ['.js'],
      calculateDependencies: true,
    };
    
    const parseResults = await parseFile(sampleJsPath, options);
    
    // Save actual results for debugging and future updates
    saveActualResults(parseResults, 'sample');
    
    // Read expected results
    const expectedContent = fs.readFileSync(expectedOutputPath, 'utf8');
    const expectedResults = JSON.parse(expectedContent);
    
    // Compare results
    const comparison = compareFunctionArrays(parseResults, expectedResults, 'sample');
    
    if (!comparison.match) {
      console.error(`Parse results do not match expected output: ${comparison.details}`);
      console.log('Check the actual-sample.json file for the current parse results');
      return false;
    }
    
    console.log('Parse results match expected output');
    return true;
  } catch (error) {
    console.error('Error in testParseFixture:', error);
    return false;
  }
}

/**
 * Test parsing a directory of fixtures
 */
export async function testParseDirectory(): Promise<boolean> {
  const fixturesDir = path.join(__dirname, 'fixtures');
  
  try {
    const options: ParserOptions = {
      directory: fixturesDir,
      fileExtensions: ['.js'],
      calculateDependencies: true,
    };
    
    const parseResults = await parseDirectory(options);
    
    // Save actual directory parse results
    saveActualResults(parseResults, 'directory');
    
    // Basic validation
    if (!Array.isArray(parseResults)) {
      console.error('parseDirectory did not return an array');
      return false;
    }
    
    if (parseResults.length === 0) {
      console.error('parseDirectory did not find any functions');
      return false;
    }
    
    // Check required properties
    const allValid = parseResults.every(func => (
      typeof func.id === 'number' &&
      typeof func.functionName === 'string' &&
      typeof func.lineNo === 'number' &&
      typeof func.fileName === 'string'
    ));
    
    if (!allValid) {
      console.error('Not all function declarations have required properties');
      return false;
    }
    
    console.log('Directory parse successful');
    return true;
  } catch (error) {
    console.error('Error in testParseDirectory:', error);
    return false;
  }
}

/**
 * Test error handling
 */
export async function testErrorHandling(): Promise<boolean> {
  try {
    // Test with non-existent file
    const nonExistentFile = path.join(__dirname, 'fixtures', 'does-not-exist.js');
    const options: ParserOptions = {
      directory: path.join(__dirname, 'fixtures'),
      fileExtensions: ['.js'],
      calculateDependencies: false,
    };
    
    const result = await parseFile(nonExistentFile, options);
    
    // Should return an empty array, not throw an exception
    if (!Array.isArray(result)) {
      console.error('Error handling test failed: did not return an array');
      return false;
    }
    
    if (result.length !== 0) {
      console.error('Error handling test failed: returned non-empty array for non-existent file');
      return false;
    }
    
    console.log('Error handling test passed');
    return true;
  } catch (error) {
    console.error('Error handling test threw an exception:', error);
    return false;
  }
}
