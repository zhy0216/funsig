// Sample JavaScript file with class declarations for testing

/**
 * A simple Calculator class with methods for basic arithmetic
 */
class Calculator {
  /**
   * Initialize calculator with optional initial value
   * @param {number} initialValue Starting value (default: 0)
   */
  constructor(initialValue = 0) {
    this.value = initialValue;
  }
  
  /**
   * Add a number to the current value
   * @param {number} x Number to add
   * @returns {number} New value
   */
  add(x) {
    this.value += x;
    return this.value;
  }
  
  /**
   * Subtract a number from the current value
   * @param {number} x Number to subtract
   * @returns {number} New value
   */
  subtract(x) {
    this.value -= x;
    return this.value;
  }
  
  /**
   * Multiply the current value by a number
   * @param {number} x Number to multiply by
   * @returns {number} New value
   */
  multiply(x) {
    this.value *= x;
    return this.value;
  }
  
  /**
   * Reset calculator to zero
   */
  reset() {
    this.value = 0;
    return this.value;
  }
  
  /**
   * Get the current value
   * @returns {number} Current value
   */
  getValue() {
    return this.value;
  }
}

// Another class example using ES6 syntax with static methods
class MathUtils {
  /**
   * Calculate the square of a number
   * @param {number} x Number to square
   * @returns {number} Square of the number
   */
  static square(x) {
    return x * x;
  }
  
  /**
   * Calculate the cube of a number
   * @param {number} x Number to cube
   * @returns {number} Cube of the number
   */
  static cube(x) {
    return x * x * x;
  }
}

// Export the classes
module.exports = {
  Calculator,
  MathUtils
};
