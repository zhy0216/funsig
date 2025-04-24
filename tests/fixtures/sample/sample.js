// Sample JavaScript file with functions for testing

/**
 * A simple function that adds two numbers
 * @param {number} a First number
 * @param {number} b Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}

/**
 * A function that multiplies two numbers and calls add()
 * @param {number} a First number
 * @param {number} b Second number
 * @returns {number} Result of (a * b) + (a + b)
 */
function multiplyAndAdd(a, b) {
  const product = a * b;
  return product + add(a, b);
}

// Arrow function example
const subtract = (a, b) => {
  return a - b;
};

// Class with methods
class Calculator {
  constructor() {
    this.memory = 0;
  }

  /**
   * Add number to memory
   * @param {number} value Number to add
   */
  add(value) {
    this.memory += value;
    return this.memory;
  }

  /**
   * Clear calculator memory
   */
  clear() {
    this.memory = 0;
  }
}

// Export all functions
module.exports = {
  add,
  multiplyAndAdd,
  subtract,
  Calculator
};
