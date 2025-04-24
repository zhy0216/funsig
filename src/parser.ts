import fs from 'fs';
import path from 'path';
import Parser from "tree-sitter";
import type { FunctionDeclaration, ClassDeclaration, FileDeclaration, ParserOptions } from './types';

// For TypeScript
let JavaScript: any;
let TypeScript: any;

/**
 * CodeParser class for extracting function signatures from code
 */
export class CodeParser {
  private parser: Parser;
  private idCounter: number;
  private languageModules: Map<string, any>;

  /**
   * Create a new CodeParser instance
   */
  constructor() {
    this.parser = new Parser();
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
        if (!TypeScript) {
          TypeScript = require('tree-sitter-typescript').typescript;
        }
        languageModule = TypeScript;
      } else if (language === 'tsx') {
        if (!TypeScript) {
          TypeScript = require('tree-sitter-typescript').tsx;
        }
        languageModule = TypeScript;
      } else if (language === 'javascript') {
        if (!JavaScript) {
          JavaScript = require('tree-sitter-javascript');
        }
        languageModule = JavaScript;
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
   * Get the language for a file based on its extension
   * @param filePath Path to the file
   */
  getLanguageForFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.js':
        return 'javascript';
      case '.ts':
        return 'typescript';
      case '.jsx':
        return 'javascript';
      case '.tsx':
        return 'tsx';  // TypeScript with JSX
      case '.py':
        return 'python';
      case '.rb':
        return 'ruby';
      case '.java':
        return 'java';
      case '.c':
      case '.h':
        return 'c';
      case '.cpp':
      case '.hpp':
      case '.cc':
        return 'cpp';
      case '.cs':
        return 'c_sharp';
      case '.go':
        return 'go';
      case '.php':
        return 'php';
      case '.rs':
        return 'rust';
      case '.json':
        // Skip JSON files or handle differently
        console.warn(`Skipping JSON file: ${filePath}`);
        return 'json'; // Not actually used but prevents the error
      // Add more languages as needed
      default:
        console.warn(`Unsupported file extension: ${ext} for file ${filePath}, skipping...`);
        return 'unknown';
    }
  }

  /**
   * Extract function and class declarations from a syntax tree
   * @param tree The parsed syntax tree
   * @param filePath Path to the source file
   * @param fileContent Content of the source file
   */
  extractDeclarations(
    tree: any,
    filePath: string,
    fileContent: string
  ): { functions: FunctionDeclaration[], classes: ClassDeclaration[] } {
    const functions: FunctionDeclaration[] = [];
    const classes: ClassDeclaration[] = [];
    
    // Helper function to get line number
    const getLineNumber = (pos: number): number => {
      return fileContent.substring(0, pos).split('\n').length;
    };
    
    // Traverse the AST to find functions and classes
    this.traverseTree(tree.rootNode, {
      visitFunction: (node: any) => {
        const name = this.getNodeName(node, fileContent);
        if (name) {
          functions.push({
            id: this.idCounter++,
            functionName: name,
            lineNo: getLineNumber(node.startPosition.row + 1),
          });
        }
      },
      visitClass: (node: any) => {
        const name = this.getNodeName(node, fileContent);
        if (name) {
          const methods: FunctionDeclaration[] = [];
          
          // Get class methods
          const body = node.childForFieldName('body');
          if (body) {
            for (let i = 0; i < body.childCount; i++) {
              const child = body.child(i);
              if (child && child.type === 'method_definition') {
                const methodName = this.getNodeName(child, fileContent);
                if (methodName) {
                  methods.push({
                    id: this.idCounter++,
                    functionName: methodName,
                    lineNo: getLineNumber(child.startPosition.row + 1),
                  });
                }
              }
            }
          }
          
          classes.push({
            id: this.idCounter++,
            className: name,
            lineNo: getLineNumber(node.startPosition.row + 1),
            signature: this.getClassSignature(node, fileContent),
            methods: methods
          });
        }
      }
    });
    
    return { functions, classes };
  }
  
  /**
   * Helper method to get the name of a node
   */
  private getNodeName(node: any, fileContent: string): string {
    if (!node) return '';
    
    let nameNode = null;
    
    switch (node.type) {
      case 'function_declaration':
      case 'class_declaration':
        nameNode = node.firstNamedChild;
        break;
      case 'method_definition':
        nameNode = node.firstNamedChild;
        break;
      case 'variable_declarator':
        nameNode = node.firstNamedChild;
        break;
    }
    
    if (nameNode && nameNode.text) {
      return nameNode.text;
    }
    
    return '';
  }
  
  /**
   * Helper method to get class signature
   */
  private getClassSignature(node: any, fileContent: string): string {
    if (!node || node.type !== 'class_declaration') return '';
    
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      const startPos = node.startPosition;
      const endPos = bodyNode.startPosition;
      
      try {
        return fileContent.substring(startPos.index, endPos.index).trim();
      } catch (e) {
        return 'class ' + this.getNodeName(node, fileContent);
      }
    }
    
    return 'class ' + this.getNodeName(node, fileContent);
  }
  
  /**
   * Traverse the AST with visitors for different node types
   */
  private traverseTree(
    node: any, 
    visitors: { 
      visitFunction?: (node: any) => void, 
      visitClass?: (node: any) => void 
    }
  ) {
    if (!node) return;
    
    // Skip method_definition nodes in the top-level traversal
    // because they'll be handled within class visitor
    if (node.type === 'method_definition' && 
        (!node.parent || node.parent.type !== 'class_body')) {
      if (visitors.visitFunction) {
        visitors.visitFunction(node);
      }
    }
    else switch (node.type) {
      case 'function_declaration':
        if (visitors.visitFunction) {
          visitors.visitFunction(node);
        }
        break;
      case 'class_declaration':
        if (visitors.visitClass) {
          visitors.visitClass(node);
        }
        // Skip traversing into class body to avoid processing methods twice
        const body = node.childForFieldName('body');
        if (body) {
          // Skip this child node when recursively processing
          for (let i = 0; i < node.childCount; i++) {
            if (node.child(i) !== body) {
              this.traverseTree(node.child(i), visitors);
            }
          }
          return; // Return early to skip the default child processing below
        }
        break;
      case 'variable_declaration':
      case 'lexical_declaration':
        for (let i = 0; i < node.namedChildCount; i++) {
          const declarator = node.namedChild(i);
          if (declarator && declarator.type === 'variable_declarator') {
            // Check if it's a function assignment
            const valueNode = declarator.lastNamedChild;
            if (valueNode && 
                (valueNode.type === 'arrow_function' || 
                 valueNode.type === 'function')) {
              if (visitors.visitFunction) {
                visitors.visitFunction(declarator);
              }
            }
          }
        }
        break;
    }
    
    // Recursively process child nodes (unless we've already returned above)
    for (let i = 0; i < node.childCount; i++) {
      this.traverseTree(node.child(i), visitors);
    }
  }

  /**
   * Parse a single file to extract function and class declarations
   * @param filePath Path to the file
   */
  async parseFile(
    filePath: string,
  ): Promise<FileDeclaration> {
    try {
      // Get the appropriate language parser
      const language = this.getLanguageForFile(filePath);
      if (language === 'unknown' || language === 'json') {
        // Skip unsupported files
        return { fileName: filePath, functions: [], classes: [] };
      }

      // Initialize the parser with the correct language
      await this.initParser(language);

      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Parse the code
      const tree = this.parser.parse(fileContent);

      // Extract declarations
      const { functions, classes } = this.extractDeclarations(tree, filePath, fileContent);
      
      // Return as a FileDeclaration
      return {
        fileName: filePath,
        functions,
        classes
      };
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      return { fileName: filePath, functions: [], classes: [] };
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
   * Detect file extensions present in a directory
   * @param directory Directory to scan
   * @returns Array of file extensions found (with leading dots)
   */
  async detectFileExtensions(directory: string): Promise<string[]> {
    try {
      // Set to track unique extensions
      const extensions = new Set<string>();

      // Helper function to recursively scan directories
      const scanDir = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules and hidden directories
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
              continue;
            }
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext) {
              extensions.add(ext);
            }
          }
        }
      };

      await scanDir(directory);

      // Convert set to array
      const extensionsArray = Array.from(extensions);

      // If no extensions found, use default ones
      if (extensionsArray.length === 0) {
        return ['.js', '.ts', '.jsx', '.tsx'];
      }

      return extensionsArray;
    } catch (error) {
      console.error(`Error detecting file extensions: ${error}`);
      // Return default extensions on error
      return ['.js', '.ts', '.jsx', '.tsx'];
    }
  }

  /**
   * Parse all files in a directory to extract function and class declarations
   * @param options Parser options
   */
  async parseDirectory(
    options: ParserOptions
  ): Promise<FileDeclaration[]> {
    const fileDeclarations: FileDeclaration[] = [];

    try {
      // Reset counter for a fresh run
      this.idCounter = 1;

      // Detect file extensions if not provided
      if (!options.fileExtensions || options.fileExtensions.length === 0) {
        options.fileExtensions = await this.detectFileExtensions(options.directory);
        console.log(`Detected file extensions: ${options.fileExtensions.join(', ')}`);
      }

      // Find all matching files
      const files = this.findFiles(options.directory, options.fileExtensions);

      // Parse each file
      for (const file of files) {
        const fileDeclaration = await this.parseFile(file);
        fileDeclarations.push(fileDeclaration);
      }

      return fileDeclarations;
    } catch (error) {
      console.error('Error parsing directory:', error);
      return [];
    }
  }
}

// Export functions that use the singleton instance for backward compatibility
export async function parseFile(filePath: string, options: ParserOptions): Promise<FileDeclaration> {
  const parser = new CodeParser();
  return parser.parseFile(filePath);
}

export async function parseDirectory(options: ParserOptions): Promise<FileDeclaration[]> {
  const parser = new CodeParser();
  return parser.parseDirectory(options);
}
