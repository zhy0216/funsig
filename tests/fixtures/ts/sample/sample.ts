// Sample TypeScript file with various TypeScript features for testing

/**
 * Interface defining a person
 */
interface Person {
  name: string;
  age: number;
  email?: string;  // Optional property
}

/**
 * Generic interface for a response from an API
 * @template T The type of data in the response
 */
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

/**
 * Type alias using union types
 */
type Status = 'pending' | 'active' | 'completed' | 'failed';

/**
 * Function with TypeScript type annotations
 * @param a First number
 * @param b Second number
 * @returns Sum of a and b
 */
function add(a: number, b: number): number {
  return a + b;
}

/**
 * Generic function example
 * @param items Array of items to process
 * @returns Processed array with string representation
 */
function processItems<T>(items: T[]): string[] {
  return items.map(item => `Processed: ${item}`);
}

// Arrow function with type annotations
const multiply = (a: number, b: number): number => a * b;

// Class with TypeScript features
class UserManager {
  private users: Person[] = [];
  
  /**
   * Add a new user
   * @param user User to add
   */
  public addUser(user: Person): void {
    this.users.push(user);
  }
  
  /**
   * Get user by name
   * @param name Name to search for
   * @returns Found user or undefined
   */
  public getUserByName(name: string): Person | undefined {
    return this.users.find(user => user.name === name);
  }
  
  /**
   * Get all users
   * @returns Array of all users
   */
  public getAllUsers(): ReadonlyArray<Person> {
    return this.users;
  }
}

// Abstract class
abstract class BaseService {
  protected serviceUrl: string;
  
  constructor(serviceUrl: string) {
    this.serviceUrl = serviceUrl;
  }
  
  abstract fetchData<T>(endpoint: string): Promise<T>;
}

// Exported constants and functions
export const API_VERSION = '1.0.0';

export { add, multiply, processItems, UserManager };
export type { Person, ApiResponse, Status };
