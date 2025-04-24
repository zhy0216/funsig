import { describe, expect, test } from "bun:test";
import * as path from 'path';
import * as fs from 'fs';
import { parseFile, parseDirectory } from '../src/parser';
import type { ParserOptions, FunctionDeclaration, FileDeclaration } from '../src/types';

/**
 * Normalize a file declaration for comparison
 * This removes or normalizes fields that might vary between test runs
 */
function normalizeFileDeclaration(fileDecl: FileDeclaration): any {
  // Create a normalized copy
  const normalized = {
    fileName: path.basename(fileDecl.fileName),
    functions: fileDecl.functions.map(func => normalizeFunctionDeclaration(func)),
    classes: fileDecl.classes.map(cls => normalizeClassDeclaration(cls))
  };

  return normalized;
}

/**
 * Normalize a function declaration for comparison
 * This removes or normalizes fields that might vary between test runs
 */
function normalizeFunctionDeclaration(func: FunctionDeclaration): any {
  // Create a copy of the function but exclude the id field
  const { id, ...normalizedWithoutId } = func;
  return normalizedWithoutId;
}

/**
 * Normalize a class declaration for comparison
 * This removes or normalizes fields that might vary between test runs
 */
function normalizeClassDeclaration(classDecl: any): any {
  // Create a copy of the class but exclude the id field
  const { id, ...normalizedWithoutId } = classDecl;
  
  // Normalize methods if they exist
  if (normalizedWithoutId.methods) {
    normalizedWithoutId.methods = normalizedWithoutId.methods.map((method: FunctionDeclaration) => 
      normalizeFunctionDeclaration(method)
    );
  }
  
  return normalizedWithoutId;
}

/**
 * Save actual parse results to a file for debugging and updating expected results
 */
function saveActualResults(result: FileDeclaration, fixtureName: string, subFolder: string = 'sample'): void {
  const normalizedResult = normalizeFileDeclaration(result);
  const outputPath = path.join(__dirname, 'fixtures', 'js', subFolder, `actual-${fixtureName}.json`);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(normalizedResult, null, 2));
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

    const parseResult = await parseFile(sampleJsPath, options);

    // Save actual results for debugging
    saveActualResults(parseResult, 'sample', 'sample');

    // Read expected results
    const expectedContent = fs.readFileSync(expectedOutputPath, 'utf8');
    const expectedResults = JSON.parse(expectedContent);

    // Normalize results for comparison
    const normalizedResult = normalizeFileDeclaration(parseResult);

    // Now expect the parser to return actual results
    expect(normalizedResult.functions.length).toBeGreaterThan(0);
    
    // Compare function names
    const actualFunctionNames = normalizedResult.functions.map(f => f.functionName).sort();
    const expectedFunctionNames = expectedResults.functions.map(f => f.functionName).sort();
    expect(actualFunctionNames).toEqual(expectedFunctionNames);
    
    // Check if we have classes (this sample has at least one class)
    expect(normalizedResult.classes.length).toBeGreaterThan(0);
    
    // Verify class methods
    expect(normalizedResult.classes[0].methods?.length).toBeGreaterThan(0);
  });

});
