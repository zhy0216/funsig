import { parseFile } from './src/parser';
import * as path from 'path';
import * as fs from 'fs';

// Test the parser with direct comment processing
async function testParser() {
  const sampleJsPath = path.join(__dirname, 'tests/fixtures/js/sample/sample.js');
  const options = {
    directory: path.dirname(sampleJsPath),
  };
  
  const fileContent = fs.readFileSync(sampleJsPath, 'utf8');
  console.log('File content:');
  console.log(fileContent.substring(0, 200) + '...');
  
  // Get the JSDoc from the file directly
  const addFunctionJSDoc = fileContent.match(/\/\*\*[\s\S]*?\*\//)?.[0] || null;
  console.log('\nJSDoc for add function:');
  console.log(addFunctionJSDoc);
  
  if (addFunctionJSDoc) {
    // Extract parameter types
    const paramRegex = /@param\s+\{([^}]+)\}\s+(\w+)/g;
    let match;
    console.log('\nParameter types:');
    while ((match = paramRegex.exec(addFunctionJSDoc)) !== null) {
      if (match.length >= 3) {
        console.log(`Parameter: ${match[2]}, Type: ${match[1]}`);
      }
    }
    
    // Extract return type
    const returnMatch = addFunctionJSDoc.match(/@returns?\s+\{([^}]+)\}/);
    if (returnMatch && returnMatch[1]) {
      console.log(`\nReturn type: ${returnMatch[1].trim()}`);
    }
  }
  
  // Run the parser
  console.log('\nRunning parser...');
  const parseResult = await parseFile(sampleJsPath, options);
  
  // Output results
  console.log('\nParsing Results:');
  console.log(JSON.stringify(parseResult, null, 2));
}

testParser().catch(console.error);
