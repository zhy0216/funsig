import { describe, expect, test, beforeAll } from "bun:test";
import * as path from 'path';
import * as fs from 'fs';
import { parseDirectory } from '../src/parser';
import { readdir } from "node:fs/promises";

import type { ParserOptions, FunctionDeclaration, FileDeclaration } from '../src/types';

/**
 * Normalize a file declaration for comparison
 * This removes or normalizes fields that might vary between test runs
 */
function normalizeFileDeclaration(fileDecls: FileDeclaration[]): any {
  return fileDecls.map(fileDecl => ({
    fileName: path.basename(fileDecl.fileName),
    functions: fileDecl.functions.map(func => normalizeFunctionDeclaration(func)),
    classes: fileDecl.classes.map(cls => normalizeClassDeclaration(cls))
  }))
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

// Define test case interface
interface TestCase {
  language: string;
  extension: string;
  fixturePath: string;
  sampleFile: string;
  description: string;
}

describe('Parser', async () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const langDirs = await readdir(fixturesDir);

  for(const lang of langDirs) {
    const exampleDirs = await readdir(path.join(fixturesDir, lang));
    for (const exampleDirName of exampleDirs) {
      const exampleDir = path.join(fixturesDir, lang, exampleDirName)
      test(exampleDir, async () => {
        // Skip if sample file doesn't exist
        if (!fs.existsSync(exampleDir)) {
          console.log(`Skipping fixtureDir test: sample file not found at ${exampleDir}`);
          return;
        }
        
        const options: ParserOptions = {
          directory: exampleDir,
        };
        
        const parseResult = await parseDirectory(options);
        
        // Normalize results for comparison
        const normalizedResult = normalizeFileDeclaration(parseResult);
        
        expect(normalizedResult).toMatchSnapshot();
      });
    }
  }
});
