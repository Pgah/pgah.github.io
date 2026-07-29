// Password analysis + generation logic.
// Pure, DOM-free functions so they can be unit-tested and reused by the
// terminal command registry. Extracted from the original inline script in
// src/pages/index.astro (behaviour preserved).

export const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'michael', 'football', 'batman', 'welcome', 'login', 'admin',
  'hunter2', 'password1', 'access', 'hello', '123456789', '000000', '111111',
  'password123', 'test', 'user', 'pass', 'root', 'toor', 'changeme',
  // Turkish names
  'emre', 'ali', 'mehmet', 'mustafa', 'ahmet', 'fatma', 'ayse', 'zeynep',
  'murat', 'hasan', 'huseyin', 'ibrahim', 'ismail', 'yusuf', 'omer', 'kemal',
  'burak', 'serkan', 'tolga', 'volkan', 'berk', 'ege', 'arda', 'kaan', 'eren',
  'selin', 'elif', 'buse', 'merve', 'esra', 'dilan', 'asli', 'pinar', 'deniz',
  // International names
  'john', 'jane', 'alex', 'david', 'james', 'robert', 'mike', 'chris', 'mark',
  'lisa', 'anna', 'sara', 'emma', 'kate', 'julia', 'laura', 'sofia', 'maria',
  // Name+number combos
  'emre123', 'ali123', 'mehmet123', 'admin123', 'user123', 'test123',
];

export const KEYBOARD_ROWS = ['qwerty', 'qwertz', 'azerty', 'asdfgh', 'zxcvbn', 'qweasd'];
export const PW_BARS = ['■□□□□', '■■□□□', '■■■□□', '■■■■□', '■■■■■'];
export const PW_LABELS = ['VERY WEAK', 'WEAK', 'MODERATE', 'STRONG', 'VERY STRONG'];
export const PW_COLORS = ['#e05252', '#ff8c00', 'var(--fg-dim)', 'var(--fg)', 'var(--green)'];

export interface PwAnalysis {
  entropy: number;
  charsetDesc: string;
  crackSeconds: number;
  warnings: string[];
  score: number;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
}

export function analyzePassword(pw: string): PwAnalysis {
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasDigit) charsetSize += 10;
  if (hasSymbol) charsetSize += 32;
  if (charsetSize === 0) charsetSize = 26;

  const entropy = pw.length * Math.log2(charsetSize);
  const combos = Math.pow(charsetSize, pw.length);
  const crackSeconds = isFinite(combos) ? combos / (2 * 1e10) : Infinity;

  const warnings: string[] = [];
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.includes(lower)) warnings.push('found in common passwords list');
  if (/(.)\1{2,}/.test(pw)) warnings.push('repeated characters detected (e.g. aaa)');
  if (/012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321/.test(pw)) warnings.push('sequential digits detected');
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(pw)) warnings.push('sequential letters detected');
  for (const seq of KEYBOARD_ROWS) {
    if (lower.includes(seq)) { warnings.push(`'${seq}' keyboard pattern detected`); break; }
  }

  let score = 0;
  if (entropy >= 28) score = 1;
  if (entropy >= 36) score = 2;
  if (entropy >= 60) score = 3;
  if (entropy >= 128) score = 4;
  if (pw.length < 8 && score > 1) score = 1;
  if (COMMON_PASSWORDS.includes(lower)) score = 0;
  else if (warnings.length >= 1 && score > 0) score--;

  const parts: string[] = [];
  if (hasLower) parts.push('lower (26)');
  if (hasUpper) parts.push('upper (26)');
  if (hasDigit) parts.push('digits (10)');
  if (hasSymbol) parts.push('symbols (~32)');
  const charsetDesc = parts.join(' + ') + ` = ${charsetSize}`;

  return { entropy, charsetDesc, crackSeconds, warnings, score, hasLower, hasUpper, hasDigit, hasSymbol };
}

export function formatCrackTime(sec: number): string {
  if (!isFinite(sec) || sec >= 1e30) return 'longer than the age of the universe';
  if (sec < 1e-7) return 'instant (< 1ns)';
  if (sec < 0.001) return `${(sec * 1e6).toFixed(0)} microseconds`;
  if (sec < 1) return `${(sec * 1000).toFixed(0)} milliseconds`;
  if (sec < 60) return `${sec.toFixed(1)} seconds`;
  if (sec < 3600) return `${(sec / 60).toFixed(0)} minutes`;
  if (sec < 86400) return `${(sec / 3600).toFixed(0)} hours`;
  if (sec < 31536000) return `${(sec / 86400).toFixed(0)} days`;
  if (sec < 3.154e10) return `${(sec / 31536000).toFixed(0)} years`;
  return `${(sec / 3.154e9).toFixed(0)} centuries`;
}

export function generatePassword(length: number, useSymbols: boolean): string {
  const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    + (useSymbols ? '!@#$%^&*()-_=+[]|;:,.<>?' : '');
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => pool[n % pool.length]).join('');
}
