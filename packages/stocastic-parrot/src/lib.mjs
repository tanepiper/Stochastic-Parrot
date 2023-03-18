import crypto from 'node:crypto';

export const randomFloat = () =>
  crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

  /**
   * Get a random floating pont number between -1 and 1, or between 0 and 1 if onlyPositive is true
   * @returns {number} A random number between -1 and 1
   */
export const randomNumber = (onlyPositive = false) =>
  parseFloat((randomFloat(1) * onlyPositive ? 1 : (randomFloat(1) >= 0.5 ? 1 : -1)).toFixed(2));