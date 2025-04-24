#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { parseDirectory } from './parser';
import { ParserOptions } from './types';

// Parse command line arguments
function parseArgs(): ParserOptions & { outputFile?: string } {
  const args = process.argv.slice(2);
  const options: ParserOptions & { outputFile?: string } = {
    directory: '.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
    calculateDependencies: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--directory' || arg === '-d') {
      options.directory = args[++i] || '.';
    } else if (arg === '--extensions' || arg === '-e') {
      const extensionsStr = args[++i] || '';
      options.fileExtensions = extensionsStr
        .split(',')
        .map(ext => ext.startsWith('.') ? ext : `.${ext}`);
    } else if (arg === '--dependencies' || arg === '--deps') {
      options.calculateDependencies = true;
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
  --extensions, -e <list>    Comma-separated list of file extensions to include
                            (default: js,ts,jsx,tsx)
  --dependencies, --deps     Calculate function dependencies
  --output, -o <file>        Output file path (default: stdout)
  --help, -h                 Show this help message
  `);
}

// Main function
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    
    console.log(`Parsing directory: ${options.directory}`);
    console.log(`File extensions: ${options.fileExtensions.join(', ')}`);
    console.log(`Calculate dependencies: ${options.calculateDependencies ? 'Yes' : 'No'}`);
    
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
