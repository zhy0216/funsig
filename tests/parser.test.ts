import { describe, expect, test } from "bun:test";
import * as path from 'path';
import { parseFile } from '../src/parser';
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

describe('Parser', () => {
  // Test fixture setup
  const jsFixturesDir = path.join(__dirname, 'fixtures', 'js');
  const sampleFixtureDir = path.join(jsFixturesDir, 'sample');

  test('should parse JavaScript file correctly', async () => {
    const sampleJsPath = path.join(sampleFixtureDir, 'sample.js');

    const options: ParserOptions = {
      directory: sampleFixtureDir,
    };

    const parseResult = await parseFile(sampleJsPath, options);

    // Normalize results for comparison
    const normalizedResult = normalizeFileDeclaration(parseResult);

    expect(normalizedResult).toMatchSnapshot();

  });

});
