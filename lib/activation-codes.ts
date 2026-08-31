const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ACTIVATION_CODE_PATTERN = /^WED-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeActivationCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function isActivationCodeFormat(value: string) {
  return ACTIVATION_CODE_PATTERN.test(value);
}

export async function hashActivationCode(value: string) {
  return digest(`davetly:activation-code:v1:${normalizeActivationCode(value)}`);
}

export async function hashActivationToken(token: string) {
  return digest(`davetly:activation-token:v1:${token}`);
}

export function createActivationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const characters = Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]);
  return `WED-${characters.slice(0, 4).join('')}-${characters.slice(4, 8).join('')}-${characters.slice(8, 12).join('')}`;
}

export function createActivationToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
