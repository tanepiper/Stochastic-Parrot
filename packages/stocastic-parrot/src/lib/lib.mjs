import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import axios from 'axios';

export const randomFloat = () =>
  crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/**
 * Get a random floating pont number between -1 and 1, or between 0 and 1 if onlyPositive is true
 * @returns {number} A random number between -1 and 1
 */
export const randomNumber = (onlyPositive = false) =>
  parseFloat(
    (randomFloat(1) * onlyPositive
      ? 1
      : randomFloat(1) >= 0.5
      ? 1
      : -1
    ).toFixed(2)
  );

function sanitize(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  const reg = /[&<>"'/]/gi;
  return string.replace(reg, (match) => map[match]);
}

export function textToAudio(apiKey = '', voice = '') {
  async function say(text) {
    text = sanitize(text);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`;
    return await axios(url, {
      method: 'post',
      data: { text },
      headers: {
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      responseType: 'stream'
    })
  }

  return {
    say,
  };
}
