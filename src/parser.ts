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
      return fileContent.substring(0, pos).split('\n').length;
    };
    
    // Build a map of comments for faster lookups
    const commentMap = this.buildCommentMap(tree.rootNode, fileContent);
    
    // Check if this is a TypeScript file by extension
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    
    // If it's TypeScript, try to extract type information directly from the source code
    const typeInfo: { [key: string]: { params: { [name: string]: string }, returnType: string } } = {};
    
    if (isTypeScript) {
      // Extract function declarations with types
      const functionRegex = /function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^{]+)/g;
      let match;
      
      while ((match = functionRegex.exec(fileContent)) !== null) {
        const funcName = match[1];
        const paramsStr = match[2];
        const returnType = match[3].trim();
        
        // Extract parameters and their types
        const params: { [name: string]: string } = {};
        paramsStr.split(',').forEach(param => {
          const parts = param.trim().split(':');
          if (parts.length >= 2) {
            const paramName = parts[0].trim();
            const paramType = parts[1].trim();
            params[paramName] = paramType;
          }
        });
        
        typeInfo[funcName] = { params, returnType };
      }
      
      // Extract arrow functions with types
      const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*:\s*([^=]+?)\s*=>/g;
      
      while ((match = arrowRegex.exec(fileContent)) !== null) {
        const funcName = match[1];
        const paramsStr = match[2];
        const returnType = match[3].trim();
        
        // Extract parameters and their types
        const params: { [name: string]: string } = {};
        paramsStr.split(',').forEach(param => {
          const parts = param.trim().split(':');
          if (parts.length >= 2) {
            const paramName = parts[0].trim();
            const paramType = parts[1].trim();
            params[paramName] = paramType;
          }
        });
        
        typeInfo[funcName] = { params, returnType };
      }
      
      // Extract class methods with types
      const classMethodRegex = /\b(public|private|protected)?\s*(\w+)\s*\(([^)]*)\)\s*:\s*([^{]+)/g;
      
      while ((match = classMethodRegex.exec(fileContent)) !== null) {
        const methodName = match[2];
        const paramsStr = match[3];
        const returnType = match[4].trim();
        
        // Skip constructor since it doesn't conform to the pattern well
        if (methodName === 'constructor') continue;
        
        // Extract parameters and their types
        const params: { [name: string]: string } = {};
        paramsStr.split(',').forEach(param => {
          const parts = param.trim().split(':');
          if (parts.length >= 2) {
            const paramName = parts[0].trim();
            const paramType = parts[1].trim();
            params[paramName] = paramType;
          }
        });
        
        typeInfo[methodName] = { params, returnType };
      }
    }
    
    // Define visitors for different node types
    const visitors = {
      visitFunction: (node: any) => {
        const name = this.getNodeName(node, fileContent);
        if (name) {
          // Get associated JSDoc comment if any
          const jsDoc = this.findClosestComment(node, commentMap, fileContent);
          
          // Extract parameters and return type
          let params = this.extractParameters(node, fileContent, jsDoc);
          let returnType = this.extractReturnType(node, fileContent, jsDoc);
          
          // For TypeScript, check if we have extracted type info for this function
          if (isTypeScript && typeInfo[name]) {
            // If we have TypeScript type information, use it to enhance the parameters
            const funcTypeInfo = typeInfo[name];
            
            // Add type information to parameters
            if (funcTypeInfo.params) {
              params = params.map(param => {
                if (param.name && funcTypeInfo.params[param.name]) {
                  return {
                    ...param,
                    type: funcTypeInfo.params[param.name]
                  };
                }
                return param;
              });
            }
            
            // Add return type information
            if (funcTypeInfo.returnType && (!returnType || returnType === '')) {
              returnType = funcTypeInfo.returnType;
            }
          }
          
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
          
          // Process methods and properties
          const body = node.childForFieldName('body');
          if (body) {
            for (let i = 0; i < body.namedChildCount; i++) {
              const child = body.namedChild(i);
              
              if (!child) continue;
              
              if (child.type === 'method_definition') {
                // Class method
                const methodName = this.getNodeName(child, fileContent);
                if (methodName) {
                  const methodJsDoc = this.findClosestComment(child, commentMap, fileContent);
                  let params = this.extractParameters(child, fileContent, methodJsDoc);
                  let returnType = this.extractReturnType(child, fileContent, methodJsDoc);
                  
                  // For TypeScript, check if we have extracted type info for this method
                  if (isTypeScript && typeInfo[methodName]) {
                    // If we have TypeScript type information, use it to enhance the parameters
                    const methodTypeInfo = typeInfo[methodName];
                    
                    // Add type information to parameters
                    if (methodTypeInfo.params) {
                      params = params.map(param => {
                        if (param.name && methodTypeInfo.params[param.name]) {
                          return {
                            ...param,
                            type: methodTypeInfo.params[param.name]
                          };
                        }
                        return param;
                      });
                    }
                    
                    // Add return type information
                    if (methodTypeInfo.returnType && (!returnType || returnType === '')) {
                      returnType = methodTypeInfo.returnType;
                    }
                  }
                  
                  classMethods.push({
                    id: this.idCounter++,
                    functionName: methodName,
                    lineNo: getLineNumber(child.startPosition),
                    parameters: params,
                    returnType: returnType
                  });
                }
              } 
              else if (child.type === 'property_definition' && child.childForFieldName('value')) {
                // Class property with method assignment (arrow function)
                const propName = this.getNodeName(child, fileContent);
                const valueNode = child.childForFieldName('value');
                
                if (propName && valueNode && 
                    (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
                  const methodJsDoc = this.findClosestComment(child, commentMap, fileContent);
                  let params = this.extractParameters(valueNode, fileContent, methodJsDoc);
                  let returnType = this.extractReturnType(valueNode, fileContent, methodJsDoc);
                  
                  // For TypeScript, check if we have extracted type info for this property method
                  if (isTypeScript && typeInfo[propName]) {
                    // If we have TypeScript type information, use it to enhance the parameters
                    const propTypeInfo = typeInfo[propName];
                    
                    // Add type information to parameters
                    if (propTypeInfo.params) {
                      params = params.map(param => {
                        if (param.name && propTypeInfo.params[param.name]) {
                          return {
                            ...param,
                            type: propTypeInfo.params[param.name]
                          };
                        }
                        return param;
                      });
                    }
                    
                    // Add return type information
                    if (propTypeInfo.returnType && (!returnType || returnType === '')) {
                      returnType = propTypeInfo.returnType;
                    }
                  }
                  
                  classMethods.push({
                    id: this.idCounter++,
                    functionName: propName,
                    lineNo: getLineNumber(child.startPosition),
                    parameters: params,
                    returnType: returnType
                  });
                }
              }
              else if (child.type === 'method_signature' || child.type === 'property_signature') {
                // Interface method or property with function type
                const memberName = this.getNodeName(child, fileContent);
                const typeNode = child.childForFieldName('type');
                
                if (memberName && typeNode && 
                    (typeNode.type === 'function_type' || child.type === 'method_signature')) {
                  const methodJsDoc = this.findClosestComment(child, commentMap, fileContent);
                  let params = this.extractParameters(child, fileContent, methodJsDoc);
                  let returnType = this.extractReturnType(child, fileContent, methodJsDoc);
                  
                  // For TypeScript, check if we have extracted type info for this interface method
                  if (isTypeScript && typeInfo[memberName]) {
                    // If we have TypeScript type information, use it to enhance the parameters
                    const memberTypeInfo = typeInfo[memberName];
                    
                    // Add type information to parameters
                    if (memberTypeInfo.params) {
                      params = params.map(param => {
                        if (param.name && memberTypeInfo.params[param.name]) {
                          return {
                            ...param,
                            type: memberTypeInfo.params[param.name]
                          };
                        }
                        return param;
                      });
                    }
                    
                    // Add return type information
                    if (memberTypeInfo.returnType && (!returnType || returnType === '')) {
                      returnType = memberTypeInfo.returnType;
                    }
                  }
                  
                  classMethods.push({
                    id: this.idCounter++,
                    functionName: memberName,
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
    };
    
    // Traverse the syntax tree with our visitors
    this.traverseTree(tree.rootNode, visitors, fileContent);
    
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
      case 'interface_declaration':
      case 'enum_declaration':
        nameNode = node.childForFieldName('name');
        break;
      case 'method_definition':
        // Handle TypeScript style methods with modifiers (public, private, protected)
        nameNode = node.childForFieldName('name');
        break;
      case 'variable_declarator':
        nameNode = node.firstNamedChild;
        break;
      case 'property_signature':
      case 'property_definition':
        nameNode = node.childForFieldName('name');
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
      case 'method_signature':  // TypeScript interface method
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
      case 'function_type':  // TypeScript function type
        formalParams = node.childForFieldName('parameters');
        break;
      case 'property_signature':  // TypeScript interface property
        // Check if it has a function type
        const typeNode = node.childForFieldName('type');
        if (typeNode && typeNode.type === 'function_type') {
          formalParams = typeNode.childForFieldName('parameters');
        }
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
      
      // Helper function to extract type annotation text
      const extractTypeAnnotation = (typeNode: any): string => {
        if (!typeNode || !fileContent) return '';
        
        // For TypeScript, the type annotation often starts with a colon
        // We want to extract just the type, not the colon
        let typeText = fileContent.substring(typeNode.startPosition, typeNode.endPosition).trim();
        
        // If the type annotation starts with a colon, remove it
        if (typeText.startsWith(':')) {
          typeText = typeText.substring(1).trim();
        }
        
        return typeText;
      };
      
      // Handle different parameter forms
      if (param.type === 'identifier') {
        // Simple parameter: function(a)
        paramName = param.text;
        
        // Check for TypeScript type annotation
        if (param.childForFieldName && param.childForFieldName('type')) {
          const typeNode = param.childForFieldName('type');
          if (typeNode) {
            paramType = extractTypeAnnotation(typeNode);
          }
        }
      } 
      else if (param.type === 'assignment_pattern') {
        // Parameter with default value: function(a = 1)
        const leftNode = param.childForFieldName('left');
        if (leftNode) {
          paramName = leftNode.text;
          isOptional = true;
          
          // Check for TypeScript type annotation
          if (leftNode.childForFieldName && leftNode.childForFieldName('type')) {
            const typeNode = leftNode.childForFieldName('type');
            if (typeNode) {
              paramType = extractTypeAnnotation(typeNode);
            }
          }
        }
      }
      else if (param.type === 'rest_parameter') {
        // Rest parameter: function(...args)
        const restNode = param.firstNamedChild;
        if (restNode) {
          paramName = restNode.text;
          paramType = 'rest';
          
          // Check for TypeScript type annotation
          if (param.childForFieldName && param.childForFieldName('type')) {
            const typeNode = param.childForFieldName('type');
            if (typeNode) {
              paramType = extractTypeAnnotation(typeNode);
            }
          }
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
      else if (param.type === 'required_parameter') {
        // TypeScript required parameter with type annotation
        const patternNode = param.childForFieldName('pattern');
        if (patternNode) {
          paramName = patternNode.text;
        }
        
        // Get the type annotation
        const typeNode = param.childForFieldName('type');
        if (typeNode) {
          paramType = extractTypeAnnotation(typeNode);
        }
      }
      else if (param.type === 'optional_parameter') {
        // TypeScript optional parameter: function(a?: string)
        const patternNode = param.childForFieldName('pattern');
        if (patternNode) {
          paramName = patternNode.text;
          isOptional = true;
        }
        
        // Get the type annotation
        const typeNode = param.childForFieldName('type');
        if (typeNode) {
          paramType = extractTypeAnnotation(typeNode);
        }
      }
      else if (param.type === 'parameter') {
        // TypeScript/JavaScript parameter
        // Try to get name from the pattern field
        const patternNode = param.childForFieldName('pattern') || param.firstNamedChild;
        if (patternNode) {
          paramName = patternNode.text;
        }
        
        // Check for optional flag
        if (param.childForFieldName && param.childForFieldName('question') !== null) {
          isOptional = true;
        }
        
        // Get the type annotation
        const typeNode = param.childForFieldName('type');
        if (typeNode) {
          paramType = extractTypeAnnotation(typeNode);
        }
      }
      
      // If we have a JSDoc type for this parameter, use it if TypeScript type is not present
      if (paramName && paramTypesMap.has(paramName) && !paramType) {
        paramType = paramTypesMap.get(paramName) || "";
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
    // Helper function to clean up type annotation text
    const cleanTypeAnnotation = (typeText: string): string => {
      // For TypeScript, the type annotation often starts with a colon
      // We want to extract just the type, not the colon
      let cleanType = typeText.trim();
      
      // If the type annotation starts with a colon, remove it
      if (cleanType.startsWith(':')) {
        cleanType = cleanType.substring(1).trim();
      }
      
      return cleanType;
    };

    // Helper function to extract type from a node
    const extractTypeFromNode = (node: any): string | undefined => {
      if (!node || !fileContent) return undefined;
      
      // TypeScript return type annotation is either directly in return_type or in type_annotation
      const returnTypeNode = node.childForFieldName('return_type') || 
                           node.childForFieldName('type_annotation') ||
                           node.childForFieldName('type');
      
      if (returnTypeNode) {
        return cleanTypeAnnotation(fileContent.substring(returnTypeNode.startPosition, returnTypeNode.endPosition));
      }
      return undefined;
    };
    
    // First check for explicit return type in the code
    let returnType: string | undefined = undefined;
    
    switch (node.type) {
      case 'function_declaration':
      case 'method_definition':
      case 'method_signature':
        returnType = extractTypeFromNode(node);
        break;
      case 'variable_declarator':
        // For arrow functions or function expressions, check the value node
        const valueNode = node.childForFieldName('value');
        if (valueNode) {
          if (valueNode.type === 'arrow_function' || valueNode.type === 'function') {
            returnType = extractTypeFromNode(valueNode);
          }
        }
        break;
      case 'arrow_function':
      case 'function':
        returnType = extractTypeFromNode(node);
        break;
      case 'property_signature':
        // TypeScript interface property with function type
        const typeNode = node.childForFieldName('type');
        if (typeNode && typeNode.type === 'function_type') {
          const fnReturnTypeNode = typeNode.childForFieldName('return_type');
          if (fnReturnTypeNode && fileContent) {
            returnType = cleanTypeAnnotation(fileContent.substring(fnReturnTypeNode.startPosition, fnReturnTypeNode.endPosition));
          }
        } else {
          returnType = extractTypeFromNode(node);
        }
        break;
      case 'function_type':
        // Direct function type (e.g., in type aliases or interfaces)
        const fnTypeReturnNode = node.childForFieldName('return_type');
        if (fnTypeReturnNode && fileContent) {
          returnType = cleanTypeAnnotation(fileContent.substring(fnTypeReturnNode.startPosition, fnTypeReturnNode.endPosition));
        }
        break;
    }
    
    // If no explicit return type, check JSDoc for @returns
    if (!returnType && jsDoc) {
      const returnMatch = jsDoc.match(/@returns?\s+{([^}]+)}/i);
      if (returnMatch && returnMatch[1]) {
        returnType = returnMatch[1].trim();
      }
    }
    
    return returnType;
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
                (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
              if (visitors.visitFunction) {
                visitors.visitFunction(declarator);
              }
            }
          }
        }
        break;
      // TypeScript specific node types - removed interface_declaration processing
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
