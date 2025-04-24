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
  /** Optional list of function IDs that this function depends on (not currently implemented) */
  dependOn?: number[];
}

/**
 * Configuration options for the parser
 */
export interface ParserOptions {
  /** Directory to search for files */
  directory: string;
  /** File extensions to include */
  fileExtensions: string[];
}
