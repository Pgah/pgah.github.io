import { describe, it, expect } from 'vitest';
import {
  base64Encode, base64Decode, hexEncode, hexDecode,
  urlEncode, urlDecode, rot13, caesar, sha, decodeJwt,
} from './crypto';

describe('base64', () => {
  it('encodes a known ASCII vector', () => {
    expect(base64Encode('hello')).toBe('aGVsbG8=');
  });
  it('round-trips UTF-8 text', () => {
    for (const s of ['merhaba', 'çğüşöİ', '🔒 secure', '']) {
      expect(base64Decode(base64Encode(s))).toBe(s);
    }
  });
});

describe('hex', () => {
  it('encodes a known vector', () => {
    expect(hexEncode('ABC')).toBe('414243');
  });
  it('round-trips and ignores whitespace on decode', () => {
    expect(hexDecode('41 42 43')).toBe('ABC');
    expect(hexDecode(hexEncode('şifre'))).toBe('şifre');
  });
  it('throws on invalid hex', () => {
    expect(() => hexDecode('xyz')).toThrow();
    expect(() => hexDecode('abc')).toThrow(); // odd length
  });
});

describe('url', () => {
  it('encodes and decodes', () => {
    expect(urlEncode('a b&c')).toBe('a%20b%26c');
    expect(urlDecode('a%20b%26c')).toBe('a b&c');
  });
});

describe('rot13 / caesar', () => {
  it('rot13 matches known vector and is self-inverse', () => {
    expect(rot13('Hello, World!')).toBe('Uryyb, Jbeyq!');
    expect(rot13(rot13('The quick brown fox'))).toBe('The quick brown fox');
  });
  it('caesar shifts and wraps', () => {
    expect(caesar('abc', 1)).toBe('bcd');
    expect(caesar('xyz', 3)).toBe('abc');
    expect(caesar('ABC', -1)).toBe('ZAB');
    expect(caesar('abc', 26)).toBe('abc');
  });
});

describe('sha', () => {
  it('computes SHA-256 of "abc"', async () => {
    expect(await sha('SHA-256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('computes SHA-1 of "abc"', async () => {
    expect(await sha('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
});

describe('decodeJwt', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
    '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  it('decodes header and payload', () => {
    const { header, payload } = decodeJwt(token);
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
    expect(payload.sub).toBe('1234567890');
    expect(payload.name).toBe('John Doe');
    expect(payload.iat).toBe(1516239022);
  });
  it('throws on malformed tokens', () => {
    expect(() => decodeJwt('not.a')).toThrow();
    expect(() => decodeJwt('a.b.c')).toThrow();
  });
});
