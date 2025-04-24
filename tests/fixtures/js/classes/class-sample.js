// Sample class file for testing

/**
 * A calculator class with various methods
 */
class Calculator {
  /**
   * Constructor initializes the calculator
   */
  constructor() {
    this.memory = 0;
    this.history = [];
  }

  /**
   * Add a number to the calculator
   * @param {number} value - Number to add
   * @returns {number} The result
   */
  add(value) {
    this.memory += value;
    this.history.push(`add: ${value}`);
    return this.memory;
  }

  /**
   * Subtract a number from the calculator
   * @param {number} value - Number to subtract
   * @returns {number} The result
   */
  subtract(value) {
    this.memory -= value;
    this.history.push(`subtract: ${value}`);
    return this.memory;
  }

  /**
   * Clear the calculator memory
   */
  clear() {
    this.memory = 0;
    this.history.push('clear');
  }

  /**
   * Get the calculator history
   * @returns {Array} History of operations
   */
  getHistory() {
    return [...this.history];
  }
}

// Export the calculator
module.exports = Calculator;
