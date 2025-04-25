import fs from 'fs';
import path from 'path';
import Parser from "tree-sitter";
import type { FunctionDeclaration, ClassDeclaration, FileDeclaration, ParserOptions, ParameterInfo } from './types';

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
    
    // Helper function to get line number (1-based)
    const getLineNumber = (pos: number): number => {
      // Count newlines up to the position to get the line number
      return fileContent.substring(0, pos).split('\n').length;
    };

    // Build a map of comments for easier lookup
    const commentMap = this.buildCommentMap(tree.rootNode, fileContent);

    // Process the AST with visitors for function and class declarations
    this.traverseTree(tree.rootNode, {
      visitFunction: (node: any) => {
        const name = this.getNodeName(node, fileContent);
        if (name) {
          // Get associated JSDoc comment if any
          const jsDoc = this.findClosestComment(node, commentMap, fileContent);
          
          // Extract parameters, types, and return types
          const params = this.extractParameters(node, fileContent, jsDoc);
          const returnType = this.extractReturnType(node, fileContent, jsDoc);
          
          functions.push({
            id: this.idCounter++,
            functionName: name,
            lineNo: getLineNumber(node.startPosition),
            parameters: params,
            returnType: returnType
          });
        }
      },
      visitClass: (node: any) => {
        const className = this.getNodeName(node, fileContent);
        if (className) {
          const classMethods: FunctionDeclaration[] = [];
          const classSignature = this.getClassSignature(node, fileContent);
          const jsDoc = this.findClosestComment(node, commentMap, fileContent);
          
          // Process methods
          const body = node.childForFieldName('body');
          if (body) {
            for (let i = 0; i < body.namedChildCount; i++) {
              const child = body.namedChild(i);
              
              if (child && child.type === 'method_definition') {
                const methodName = this.getNodeName(child, fileContent);
                if (methodName) {
                  const methodJsDoc = this.findClosestComment(child, commentMap, fileContent);
                  const params = this.extractParameters(child, fileContent, methodJsDoc);
                  const returnType = this.extractReturnType(child, fileContent, methodJsDoc);
                  
                  classMethods.push({
                    id: this.idCounter++,
                    functionName: methodName,
                    lineNo: getLineNumber(child.startPosition),
                    parameters: params,
                    returnType: returnType
                  });
                }
              }
            }
          }
          
          classes.push({
            id: this.idCounter++,
            className,
            lineNo: getLineNumber(node.startPosition),
            signature: classSignature,
            methods: classMethods
          });
        }
      }
    }, fileContent);
    
    return { functions, classes };
  }
  
  /**
   * Build a map of comments in the file for faster lookup
   */
  private buildCommentMap(rootNode: any, fileContent: string): Map<number, string> {
    const commentMap = new Map<number, string>();
    
    // First, extract comments directly from the file content using regex
    // This ensures we catch all comments, including JSDoc
    const commentRegex = /\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g;
    let match;
    
    while ((match = commentRegex.exec(fileContent)) !== null) {
      const commentText = match[0];
      const commentEnd = match.index + commentText.length;
      commentMap.set(commentEnd, commentText);
    }
    
    // Also process the AST to make sure we get all comments
    const processNode = (node: any) => {
      if (!node) return;
      
      // Check if this is a comment node
      if (node.type === 'comment' || node.type.includes('comment')) {
        const commentText = fileContent.substring(node.startPosition, node.endPosition);
        commentMap.set(node.endPosition, commentText);
      }
      
      // Process children
      for (let i = 0; i < node.childCount; i++) {
        processNode(node.child(i));
      }
    };
    
    processNode(rootNode);
    return commentMap;
  }
  
  /**
   * Find the closest comment before a node
   */
  private findClosestComment(node: any, commentMap: Map<number, string>, fileContent: string): string | null {
    if (!node || !node.startPosition) return null;
    
    // Get the line number for this node
    const nodeLine = fileContent.substring(0, node.startPosition).split('\n').length;
    
    // Look for the closest comment ending before this node starts
    let closestComment = null;
    let closestDistance = Infinity;
    
    for (const [commentEnd, commentText] of commentMap.entries()) {
      if (commentEnd < node.startPosition) {
        const commentEndLine = fileContent.substring(0, commentEnd).split('\n').length;
        const distance = nodeLine - commentEndLine;
        
        // Consider comments that are within 10 lines of the node
        if (distance >= 0 && distance < 10 && distance < closestDistance) {
          closestDistance = distance;
          closestComment = commentText;
        }
      }
    }
    
    return closestComment;
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
   * Extract parameters from a function declaration node
   */
  private extractParameters(node: any, fileContent: string, jsDoc: string | null): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    
    // Find the formal parameters node
    let formalParams: any = null;
    
    switch (node.type) {
      case 'function_declaration':
      case 'method_definition':
        formalParams = node.childForFieldName('parameters');
        break;
      case 'variable_declarator':
        // For arrow functions, we need to look at the value node (the function itself)
        const valueNode = node.childForFieldName('value');
        if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
          formalParams = valueNode.childForFieldName('parameters');
        }
        break;
      case 'arrow_function':
      case 'function':
        formalParams = node.childForFieldName('parameters');
        break;
    }
    
    if (!formalParams) return parameters;
    
    // Look for JSDoc comments to get parameter types
    const paramTypesMap = this.extractJSDocParamTypes(jsDoc);
    
    // Parse each parameter
    for (let i = 0; i < formalParams.namedChildCount; i++) {
      const param = formalParams.namedChild(i);
      if (!param) continue;
      
      let paramName = '';
      let paramType = '';
      let isOptional = false;
      
      // Handle different parameter forms
      if (param.type === 'identifier') {
        // Simple parameter: function(a)
        paramName = param.text;
      } 
      else if (param.type === 'assignment_pattern') {
        // Parameter with default value: function(a = 1)
        const leftNode = param.childForFieldName('left');
        if (leftNode) {
          paramName = leftNode.text;
          isOptional = true;
        }
      }
      else if (param.type === 'rest_parameter') {
        // Rest parameter: function(...args)
        const restNode = param.firstNamedChild;
        if (restNode) {
          paramName = restNode.text;
          paramType = 'rest';
        }
      }
      else if (param.type === 'object_pattern') {
        // Destructured object parameter: function({a, b})
        paramName = "{" + param.text + "}";
        paramType = 'object';
      }
      else if (param.type === 'array_pattern') {
        // Destructured array parameter: function([a, b])
        paramName = "[" + param.text + "]";
        paramType = 'array';
      }
      
      // For TypeScript, check for type annotations
      if (param.childForFieldName && param.childForFieldName('type')) {
        const typeNode = param.childForFieldName('type');
        if (typeNode) {
          paramType = fileContent.substring(typeNode.startPosition, typeNode.endPosition);
        }
      }
      
      // If we have a JSDoc type for this parameter, use it
      if (paramName && paramTypesMap.has(paramName)) {
        paramType = paramTypesMap.get(paramName) || paramType;
      }
      
      if (paramName) {
        parameters.push({
          name: paramName,
          type: paramType || "", // Ensure type is never undefined
          optional: isOptional
        });
      }
    }
    
    return parameters;
  }
  
  /**
   * Extract JSDoc parameter types from a comment
   */
  private extractJSDocParamTypes(jsDoc: string | null): Map<string, string> {
    const paramTypes = new Map<string, string>();
    
    if (!jsDoc) return paramTypes;
    
    // Find all @param annotations
    // Updated regex to work with JSDoc format variations
    const paramRegex = /@param\s+(?:\{([^}]+)\})?\s*(\w+)(?:\s+-\s*(.+))?/g;
    let match;
    
    while ((match = paramRegex.exec(jsDoc)) !== null) {
      if (match.length >= 3) {
        const type = match[1] ? match[1].trim() : '';
        const name = match[2].trim();
        paramTypes.set(name, type);
      }
    }
    
    return paramTypes;
  }
  
  /**
   * Extract return type from a function declaration node
   */
  private extractReturnType(node: any, fileContent: string, jsDoc: string | null): string | undefined {
    // Look for TypeScript return type annotations
    if (node.childForFieldName && node.childForFieldName('return_type')) {
      const returnTypeNode = node.childForFieldName('return_type');
      if (returnTypeNode) {
        return fileContent.substring(returnTypeNode.startPosition, returnTypeNode.endPosition);
      }
    }
    
    // For JavaScript, try to infer from JSDoc if available
    if (jsDoc) {
      // Extract return type from JSDoc - improved regex to match more JSDoc variations
      const returnMatch = jsDoc.match(/@returns?\s+(?:\{([^}]+)\})?/);
      if (returnMatch && returnMatch[1]) {
        return returnMatch[1].trim();
      }
    }
    
    return undefined;
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
        return fileContent.substring(startPos, endPos).trim();
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
    },
    fileContent: string
  ) {
    if (!node) return;
    
    switch (node.type) {
      case 'function_declaration':
      case 'method_definition':
      case 'generator_function_declaration':
      case 'function':
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
              this.traverseTree(node.child(i), visitors, fileContent);
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
      // TypeScript specific node types
      case 'interface_declaration':
        if (visitors.visitClass) {
          // We treat interfaces similar to classes for documentation purposes
          visitors.visitClass(node);
        }
        break;
      case 'type_alias_declaration':
        // Check if the type alias is for a function type
        const typeNode = node.childForFieldName('value');
        if (typeNode && (
            typeNode.type === 'function_type' || 
            typeNode.type === 'arrow_function')) {
          if (visitors.visitFunction) {
            visitors.visitFunction(node);
          }
        }
        break;
      case 'export_statement':
        // Process exports to find functions or classes being exported
        for (let i = 0; i < node.childCount; i++) {
          this.traverseTree(node.child(i), visitors, fileContent);
        }
        // Return early to avoid duplicate processing
        return;
      case 'enum_declaration':
        // Handle TypeScript enums like classes
        if (visitors.visitClass) {
          visitors.visitClass(node);
        }
        break;
    }
    
    // Recursively process child nodes (unless we've already returned above)
    for (let i = 0; i < node.childCount; i++) {
      this.traverseTree(node.child(i), visitors, fileContent);
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
