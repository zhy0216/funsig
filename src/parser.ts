import * as fs from 'fs';
import * as path from 'path';
import Parser = require("tree-sitter");
import { FunctionDeclaration, ParserOptions } from './types';

/**
 * CodeParser class for extracting function signatures from code
 */
export class CodeParser {
  private parser: Parser;
  private functionMap: Map<string, FunctionDeclaration>;
  private idCounter: number;
  private languageModules: Map<string, any>;

  /**
   * Create a new CodeParser instance
   */
  constructor() {
    this.parser = new Parser();
    this.functionMap = new Map();
    this.idCounter = 1;
    this.languageModules = new Map();
  }

  /**
   * Initialize tree-sitter parser with specified language
   * @param language Language name (e.g., 'javascript', 'typescript', etc.)
   */
  async initParser(language: string): Promise<void> {
    try {
      // Return if language is already loaded
      if (this.languageModules.has(language)) {
        this.parser.setLanguage(this.languageModules.get(language));
        return;
      }

      let languageModule;
      
      // Special handling for TypeScript which has separate modules for TS and TSX
      if (language === 'typescript') {
        languageModule = require('tree-sitter-typescript').typescript;
      } else if (language === 'tsx') {
        languageModule = require('tree-sitter-typescript').tsx;
      } else {
        // For other languages, try to load them directly
        languageModule = require(`tree-sitter-${language}`);
      }
      
      // Cache the language module for future use
      this.languageModules.set(language, languageModule);
      
      // Set the parser's language
      this.parser.setLanguage(languageModule);
      
    } catch (error) {
      console.error(`Failed to load language ${language}:`, error);
      throw new Error(`Unsupported language: ${language}. Make sure the tree-sitter-${language} module is installed.`);
    }
  }

  /**
   * Get the appropriate language for a file based on its extension
   * @param filePath Path to the file
   */
  getLanguageForFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.js':
        return 'javascript';
      case '.ts':
        return 'typescript';
      case '.tsx':
        return 'tsx';
      case '.jsx':
        return 'javascript'; // Use javascript parser for JSX files
      case '.py':
        return 'python';
      case '.rb':
        return 'ruby';
      case '.go':
        return 'go';
      case '.c':
      case '.h':
        return 'c';
      case '.cpp':
      case '.hpp':
      case '.cc':
        return 'cpp';
      case '.java':
        return 'java';
      case '.php':
        return 'php';
      case '.rs':
        return 'rust';
      // Add more languages as needed
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }
  }

  /**
   * Extract function declarations from a syntax tree
   * @param tree The parsed syntax tree
   * @param filePath Path to the source file
   * @param fileContent Content of the source file
   */
  extractFunctionDeclarations(
    tree: any,
    filePath: string,
    fileContent: string
  ): FunctionDeclaration[] {
    const functions: FunctionDeclaration[] = [];
    const cursor = tree.walk();
    
    // Helper function to count lines
    const getLineNumber = (position: number): number => {
      return fileContent.substring(0, position).split('\n').length;
    };

    // Function to process function declarations based on language
    const processNode = (node: any) => {
      let functionName = '';
      let lineNo = 0;
      
      // Check for function declarations based on node type
      switch (node.type) {
        // JavaScript/TypeScript: Regular function declarations
        case 'function_declaration':
          {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
              functionName = nameNode.text;
              lineNo = getLineNumber(node.startPosition.row + 1);
            }
          }
          break;
        
        // JavaScript/TypeScript: Methods in classes
        case 'method_definition':
          {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
              functionName = nameNode.text;
              lineNo = getLineNumber(node.startPosition.row + 1);
            }
          }
          break;
        
        // JavaScript/TypeScript: Generator functions
        case 'generator_function_declaration':
          {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
              functionName = nameNode.text;
              lineNo = getLineNumber(node.startPosition.row + 1);
            }
          }
          break;
          
        // JavaScript/TypeScript: Arrow functions with variable assignments
        case 'variable_declaration':
          {
            const declarationNode = node.childForFieldName('declarator');
            if (declarationNode) {
              const nameNode = declarationNode.childForFieldName('name');
              const valueNode = declarationNode.childForFieldName('value');
              
              if (nameNode && valueNode && valueNode.type === 'arrow_function') {
                functionName = nameNode.text;
                lineNo = getLineNumber(node.startPosition.row + 1);
              }
            }
          }
          break;
          
        // JavaScript/TypeScript: Arrow functions directly
        case 'arrow_function':
          {
            // For arrow functions, we need to check if it's part of a variable declaration
            // This is handled in the 'variable_declaration' case
            // This case is for standalone arrow functions which usually don't have names
          }
          break;
          
        // TypeScript: Interface declaration
        case 'interface_declaration':
          {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
              functionName = `interface:${nameNode.text}`;
              lineNo = getLineNumber(node.startPosition.row + 1);
            }
          }
          break;
          
        // TypeScript: Type alias declaration  
        case 'type_alias_declaration':
          {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
              functionName = `type:${nameNode.text}`;
              lineNo = getLineNumber(node.startPosition.row + 1);
            }
          }
          break;
          
        // Python
        case 'function_definition':
          {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
              functionName = nameNode.text;
              lineNo = getLineNumber(node.startPosition.row + 1);
            }
          }
          break;
          
        // Add more language-specific function detection as needed
        
        default:
          return;
      }
      
      if (functionName && lineNo) {
        const funcDecl: FunctionDeclaration = {
          id: this.idCounter++,
          functionName,
          lineNo,
          fileName: filePath,
        };
        
        this.functionMap.set(`${filePath}:${functionName}`, funcDecl);
        functions.push(funcDecl);
      }
    };
    
    // Process all nodes in the tree
    let reachedRoot = false;
    
    while (!reachedRoot) {
      processNode(cursor.currentNode());
      
      if (cursor.gotoFirstChild()) {
        continue;
      }
      
      if (cursor.gotoNextSibling()) {
        continue;
      }
      
      let retracing = true;
      while (retracing) {
        if (!cursor.gotoParent()) {
          reachedRoot = true;
          break;
        }
        
        if (cursor.gotoNextSibling()) {
          retracing = false;
        }
      }
    }
    
    return functions;
  }

  /**
   * Parse a single file to extract function declarations
   * @param filePath Path to the file
   * @param options Parser options
   */
  async parseFile(
    filePath: string,
    options: ParserOptions
  ): Promise<FunctionDeclaration[]> {
    try {
      const language = this.getLanguageForFile(filePath);
      await this.initParser(language);
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const tree = this.parser.parse(fileContent);
      
      const functions = this.extractFunctionDeclarations(tree, filePath, fileContent);
      return functions;
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Recursively find all files with specified extensions in a directory
   * @param directory Directory to search
   * @param extensions File extensions to include
   */
  findFiles(directory: string, extensions: string[]): string[] {
    const results: string[] = [];
    
    const items = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(directory, item.name);
      
      if (item.isDirectory()) {
        results.push(...this.findFiles(itemPath, extensions));
      } else if (
        item.isFile() &&
        extensions.includes(path.extname(item.name).toLowerCase())
      ) {
        results.push(itemPath);
      }
    }
    
    return results;
  }

  /**
   * Parse all files in a directory to extract function declarations
   * @param options Parser options
   */
  async parseDirectory(
    options: ParserOptions
  ): Promise<FunctionDeclaration[]> {
    const allFunctions: FunctionDeclaration[] = [];
    
    try {
      // Reset counter and map for a fresh run
      this.idCounter = 1;
      this.functionMap.clear();
      
      // Find all matching files
      const files = this.findFiles(options.directory, options.fileExtensions);
      
      // Parse each file
      for (const file of files) {
        const functions = await this.parseFile(file, options);
        allFunctions.push(...functions);
      }
      
      return allFunctions;
    } catch (error) {
      console.error('Error parsing directory:', error);
      return [];
    }
  }
}

// Create singleton instances for compatibility with the existing code
const parser = new CodeParser();

// Export functions that use the singleton instance for backward compatibility
export async function parseFile(filePath: string, options: ParserOptions): Promise<FunctionDeclaration[]> {
  return parser.parseFile(filePath, options);
}

export async function parseDirectory(options: ParserOptions): Promise<FunctionDeclaration[]> {
  return parser.parseDirectory(options);
}
