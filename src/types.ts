export interface FileDeclaration {
  /** Path to the file */
  fileName: string;
  /** Functions defined in this file */
  functions: FunctionDeclaration[];
  /** Classes defined in this file */
  classes: ClassDeclaration[];
}

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
  /** Function parameters with their types (if available) */
  parameters: ParameterInfo[];
  /** Return type of the function (if available) */
  returnType?: string;
}

/**
 * Information about a function parameter
 */
export interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Whether parameter is optional */
  optional: boolean;
}

/**
 * Represents a class declaration found in the codebase
 */
export interface ClassDeclaration {
  /** Unique identifier for the class */
  id: number;
  /** The name of the class */
  className: string;
  /** Line number where the class is defined */
  lineNo: number;
  /** Class signature including extends/implements */
  signature: string;
  /** Methods defined in this class */
  methods: FunctionDeclaration[];
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
