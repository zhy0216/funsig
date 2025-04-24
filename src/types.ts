/**
 * Represents a function declaration found in the codebase
 */
export interface FunctionDeclaration {
  /** Unique identifier for the function */
  id: number;
  /** The name of the function */
  functionName: string;
  /** Line number where the function is defined */
  lineNo: number;
  /** Path to the file containing the function */
  fileName: string;
}



/**
 * Configuration options for the parser
 */
export interface ParserOptions {
  /** Directory to search for files */
  directory: string;
  /** File extensions to include (optional, will be auto-detected if not provided) */
  fileExtensions?: string[];
}
