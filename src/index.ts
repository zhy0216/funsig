#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { parseDirectory } from './parser';
import type { ParserOptions } from './types';

// Parse command line arguments
function parseArgs(): ParserOptions & { outputFile?: string, directorySpecified?: boolean } {
  const args = process.argv.slice(2);
  const options: ParserOptions & { outputFile?: string, directorySpecified?: boolean } = {
    directory: '.',
    directorySpecified: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--directory' || arg === '-d') {
      options.directory = args[++i] || '.';
      options.directorySpecified = true;
    } else if (arg === '--output' || arg === '-o') {
      options.outputFile = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

// Print help message
function printHelp(): void {
  console.log(`
Function Signature Extractor (funsig)
Usage: funsig [options]

Options:
  --directory, -d <path>     Directory to search for files (default: current directory)
  --output, -o <file>        Output file path (default: stdout)
  --help, -h                 Show this help message
  `);
}

// Main function
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    
    // Abort if no directory was explicitly specified
    if (!options.directorySpecified) {
      console.error('Error: No directory specified');
      printHelp();
      process.exit(1);
      return;
    }
    
    console.log(`Parsing directory: ${options.directory}`);
    
    const functions = await parseDirectory(options);
    
    console.log(`Found ${functions.length} function declarations`);
    
    const jsonOutput = JSON.stringify(functions, null, 2);
    
    if (options.outputFile) {
      fs.writeFileSync(options.outputFile, jsonOutput);
      console.log(`Results written to ${options.outputFile}`);
    } else {
      console.log('Results:');
      console.log(jsonOutput);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the program
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
