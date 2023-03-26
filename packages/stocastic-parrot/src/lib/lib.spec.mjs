import { randomNumber } from './lib.mjs';

describe('stochastic parrot library', () => {

    describe('randomNumber', () => {
        test('it should return a number to two decimal places', () => {
            const number = randomNumber();
            expect(number).toEqual(expect.any(Number));
        })
    });

});
