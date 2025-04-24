import { describe, expect, test } from "bun:test";
import * as path from 'path';
import * as fs from 'fs';
import { parseFile, parseDirectory } from '../src/parser';
import type { ParserOptions, FunctionDeclaration } from '../src/types';

/**
 * Normalize a function declaration for comparison
 * This removes or normalizes fields that might vary between test runs
 */
function normalizeFunctionDeclaration(func: FunctionDeclaration): any {
  // Create a copy of the function but exclude the id field
  const { id, ...normalizedWithoutId } = func;
  const normalized = { ...normalizedWithoutId };

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
 * Save actual parse results to a file for debugging and updating expected results
 */
function saveActualResults(results: FunctionDeclaration[], fixtureName: string, subFolder: string = 'sample'): void {
  const normalizedResults = results.map(func => normalizeFunctionDeclaration(func));
  const outputPath = path.join(__dirname, 'fixtures', 'js', subFolder, `actual-${fixtureName}.json`);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(normalizedResults, null, 2));
    console.log(`Saved actual results to ${outputPath}`);
  } catch (error) {
    console.error(`Error saving results: ${error}`);
  }
}

describe('Parser', () => {
  // Test fixture setup
  const jsFixturesDir = path.join(__dirname, 'fixtures', 'js');
  const sampleFixtureDir = path.join(jsFixturesDir, 'sample');
  const classesFixtureDir = path.join(jsFixturesDir, 'classes');

  test('should parse JavaScript file correctly', async () => {
    const sampleJsPath = path.join(sampleFixtureDir, 'sample.js');
    const expectedOutputPath = path.join(sampleFixtureDir, 'expected-output.json');

    const options: ParserOptions = {
      directory: sampleFixtureDir,
    };

    const parseResults = await parseFile(sampleJsPath, options);

    // Save actual results for debugging
    saveActualResults(parseResults, 'sample', 'sample');

    // Read expected results
    const expectedContent = fs.readFileSync(expectedOutputPath, 'utf8');
    const expectedResults = JSON.parse(expectedContent);

    // Normalize results for comparison
    const normalizedResults = parseResults.map(func => normalizeFunctionDeclaration(func));

    // Now expect the parser to return actual results
    expect(normalizedResults.length).toBeGreaterThan(0);
    expect(normalizedResults.map(r => r.functionName).sort()).toEqual(
      expectedResults.map(r => r.functionName).sort()
    );
  });

  test.skip('should parse directory correctly', async () => {
    const options: ParserOptions = {
      directory: sampleFixtureDir,
    };

    const parseResults = await parseDirectory(options);

    // Save actual results for debugging
    saveActualResults(parseResults, 'directory', 'sample');

    // Now expect the parser to return actual results
    expect(parseResults.length).toBeGreaterThan(0);

    // Check if key functions are found
    const functionNames = parseResults
      .filter(func => func.fileName.includes('sample.js'))
      .map(func => func.functionName);

    expect(functionNames).toContain('add');
    expect(functionNames).toContain('multiplyAndAdd');
    expect(functionNames).toContain('subtract');
  });

  test.skip('should handle class declarations', async () => {
    const classFixturePath = path.join(classesFixtureDir, 'class-sample.js');
    const expectedOutputPath = path.join(classesFixtureDir, 'expected-output.json');

    const options: ParserOptions = {
      directory: classesFixtureDir,
    };

    const parseResults = await parseFile(classFixturePath, options);

    // Save actual results for debugging
    saveActualResults(parseResults, 'class', 'classes');

    // Read expected results
    const expectedContent = fs.readFileSync(expectedOutputPath, 'utf8');
    const expectedResults = JSON.parse(expectedContent);

    // Normalize results for comparison
    const normalizedResults = parseResults.map(func => normalizeFunctionDeclaration(func));

    // Now expect the parser to return actual results
    expect(normalizedResults.length).toBeGreaterThan(0);

    // Check if class constructor and methods are found
    const functionNames = parseResults.map(func => func.functionName);
    expect(functionNames).toContain('constructor');
  });

  test.skip('should handle error for non-existent file', async () => {
    const nonExistentFile = path.join(sampleFixtureDir, 'does-not-exist.js');
    const options: ParserOptions = {
      directory: sampleFixtureDir,
    };

    const result = await parseFile(nonExistentFile, options);

    // Should return an empty array, not throw an exception
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(0);
  });

});
