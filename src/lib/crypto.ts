// Client-side crypto / encoding helpers.
// Pure, DOM-free functions (Web Crypto's `crypto.subtle` is available both in
// the browser and in Node >=18, so these are unit-testable).

export function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64Decode(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function hexEncode(text: string): string {
  return Array.from(new TextEncoder().encode(text), b => b.toString(16).padStart(2, '0')).join('');
}

export function hexDecode(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new Error('invalid hex string');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return new TextDecoder().decode(bytes);
}

export function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

export function urlDecode(text: string): string {
  return decodeURIComponent(text.trim());
}

export function rot13(text: string): string {
  return caesar(text, 13);
}

export function caesar(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

export type HashAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512';
export const HASH_ALGOS: HashAlgo[] = ['SHA-1', 'SHA-256', 'SHA-512'];

export async function sha(algo: HashAlgo, text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return base64Decode(s);
}

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export function decodeJwt(token: string): JwtParts {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('not a valid JWT (expected 3 dot-separated parts)');
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw new Error('failed to decode JWT — header/payload is not valid base64url JSON');
  }
  return { header, payload, signature: parts[2] };
}
