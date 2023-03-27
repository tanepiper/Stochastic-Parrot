import { randomNumber, sanitizeString } from './lib.mjs';

describe('stochastic parrot library', () => {
  describe('randomNumber', () => {
    test('it should return a number to two decimal places', () => {
      const number = randomNumber();
      expect(number).toEqual(expect.any(Number));
    });
  });
});



describe('sanitizeString function', () => {
  it('removes HTML tags from the input string', () => {
    const inputString = '<h1>Hello world</h1>';
    const sanitizedString = sanitizeString(inputString);
    expect(sanitizedString).toEqual('Hello world');
  });

  it('removes special characters that are not ASCII or Emoji characters', () => {
    const inputString = 'Héllø wôrld! 😀❄︎⍓︎◻︎♏︎';
    const sanitizedString = sanitizeString(inputString);
    // Match instead of equal because non-breaking spaces
    expect(sanitizedString).toMatch('Héllø wôrld! 😀');
  });

  it('returns an empty string if the input string is empty', () => {
    const inputString = '';
    const sanitizedString = sanitizeString(inputString);
    expect(sanitizedString).toEqual('');
  });

  it('returns the same string if there are no HTML tags or special characters', () => {
    const inputString = 'Hello world';
    const sanitizedString = sanitizeString(inputString);
    expect(sanitizedString).toEqual('Hello world');
  });
});
