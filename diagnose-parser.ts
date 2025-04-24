import { parseFile } from './src/parser';
import * as path from 'path';
import * as fs from 'fs';

// Diagnostic script to verify the parser functionality
async function diagnoseParser() {
  const sampleJsPath = path.join(__dirname, 'tests/fixtures/js/sample/sample.js');
  const options = {
    directory: path.dirname(sampleJsPath),
  };
  
  console.log('Running parser diagnostic...');
  console.log(`Parsing file: ${sampleJsPath}`);
  
  try {
    const parseResult = await parseFile(sampleJsPath, options);
    
    // Output the full results
    console.log('\nParsing Results:');
    console.log(JSON.stringify(parseResult, null, 2));
    
    // Focus on specific functions to verify parameter types and return types
    if (parseResult.functions && parseResult.functions.length > 0) {
      console.log('\n--- Functions ---');
      parseResult.functions.forEach(func => {
        console.log(`\nFunction: ${func.functionName} (Line: ${func.lineNo})`);
        
        // Show return type if available
        if (func.returnType) {
          console.log(`Return Type: ${func.returnType}`);
        } else {
          console.log('Return Type: <none specified>');
        }
        
        // Show parameters and their types
        console.log('Parameters:');
        if (func.parameters && func.parameters.length > 0) {
          func.parameters.forEach(param => {
            const optionalMark = param.optional ? '?' : '';
            const typeInfo = param.type ? `: ${param.type}` : '';
            console.log(`  - ${param.name}${optionalMark}${typeInfo}`);
          });
        } else {
          console.log('  <none>');
        }
      });
    }
    
    // Focus on classes and their methods
    if (parseResult.classes && parseResult.classes.length > 0) {
      console.log('\n--- Classes ---');
      parseResult.classes.forEach(cls => {
        console.log(`\nClass: ${cls.className} (Line: ${cls.lineNo})`);
        console.log(`Signature: ${cls.signature || '<none>'}`);
        
        // Show class methods
        console.log('Methods:');
        if (cls.methods && cls.methods.length > 0) {
          cls.methods.forEach(method => {
            console.log(`  Method: ${method.functionName} (Line: ${method.lineNo})`);
            
            // Show return type if available
            if (method.returnType) {
              console.log(`  Return Type: ${method.returnType}`);
            }
            
            // Show parameters and their types
            console.log('  Parameters:');
            if (method.parameters && method.parameters.length > 0) {
              method.parameters.forEach(param => {
                const optionalMark = param.optional ? '?' : '';
                const typeInfo = param.type ? `: ${param.type}` : '';
                console.log(`    - ${param.name}${optionalMark}${typeInfo}`);
              });
            } else {
              console.log('    <none>');
            }
          });
        } else {
          console.log('  <none>');
        }
      });
    }
    
  } catch (error) {
    console.error('Error during diagnosis:', error);
  }
}

diagnoseParser().catch(console.error);
