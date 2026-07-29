import { describe, it, expect } from 'vitest';
import { analyzePassword, formatCrackTime, generatePassword } from './password';

describe('analyzePassword', () => {
  it('flags a common password as very weak', () => {
    const a = analyzePassword('password');
    expect(a.score).toBe(0);
    expect(a.warnings).toContain('found in common passwords list');
  });

  it('detects character classes and sequential patterns', () => {
    const a = analyzePassword('abc12345');
    expect(a.hasLower).toBe(true);
    expect(a.hasDigit).toBe(true);
    expect(a.hasUpper).toBe(false);
    expect(a.warnings.some(w => w.includes('sequential'))).toBe(true);
  });

  it('rates a long mixed password strongly', () => {
    const a = analyzePassword('Xq7#vP2!mZ9@rL4$wK8&');
    expect(a.score).toBeGreaterThanOrEqual(3);
    expect(a.entropy).toBeGreaterThan(80);
  });

  it('entropy grows with length for the same charset', () => {
    const short = analyzePassword('aaaaaa');
    const long = analyzePassword('aaaaaaaaaaaa');
    expect(long.entropy).toBeGreaterThan(short.entropy);
  });
});

describe('formatCrackTime', () => {
  it('formats across unit boundaries', () => {
    expect(formatCrackTime(30)).toBe('30.0 seconds');
    expect(formatCrackTime(120)).toBe('2 minutes');
    expect(formatCrackTime(7200)).toBe('2 hours');
    expect(formatCrackTime(Infinity)).toBe('longer than the age of the universe');
  });
});

describe('generatePassword', () => {
  it('produces the requested length', () => {
    expect(generatePassword(16, true)).toHaveLength(16);
    expect(generatePassword(32, false)).toHaveLength(32);
  });

  it('omits symbols when asked', () => {
    const pw = generatePassword(200, false);
    expect(/^[a-zA-Z0-9]+$/.test(pw)).toBe(true);
  });

  it('is not trivially repetitive', () => {
    expect(generatePassword(24, true)).not.toBe(generatePassword(24, true));
  });
});
