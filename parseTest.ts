import { parseFile } from './src/parser';
import * as path from 'path';

// Test the parser
async function testParser() {
  const sampleJsPath = path.join(__dirname, 'tests/fixtures/js/sample/sample.js');
  const options = {
    directory: path.dirname(sampleJsPath),
  };
  
  const parseResult = await parseFile(sampleJsPath, options);
  
  // Output full results for inspection
  console.log('Parsing Results:');
  console.log(JSON.stringify(parseResult, null, 2));
}

testParser().catch(console.error);
