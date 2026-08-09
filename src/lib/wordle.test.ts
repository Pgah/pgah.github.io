import { describe, it, expect } from 'vitest';
import {
  evaluateGuess, isValidGuess, buildShareText, getDailyWord,
  WORDS, type WordleState,
} from './wordle';

describe('evaluateGuess', () => {
  it('marks every letter correct when the guess equals the target', () => {
    expect(evaluateGuess('PROXY', 'PROXY')).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
  });

  it('marks a letter present when it exists elsewhere in the target', () => {
    // PATCH vs PROXY: P correct; A/T/C/H absent (not in PROXY)
    expect(evaluateGuess('PATCH', 'PROXY')).toEqual([
      'correct', 'absent', 'absent', 'absent', 'absent',
    ]);
  });

  it('distinguishes present from absent by position', () => {
    // CRACK vs PROXY: R is present (target has R at index 1, guess at index 1 -> correct)
    // Actually R at guess index 1 matches target index 1 -> correct
    expect(evaluateGuess('CRACK', 'PROXY')).toEqual([
      'absent', 'correct', 'absent', 'absent', 'absent',
    ]);
  });

  it('handles duplicate letters in the guess (only as many as the target has)', () => {
    // Guess ROOTS = R O O T S, target PROXY = P R O X Y (one O, at index 2).
    // idx0 R: present (target has R at idx1). idx1 O: absent (target's only O is
    // consumed as the exact match). idx2 O: correct. idx3 T, idx4 S: absent.
    expect(evaluateGuess('ROOTS', 'PROXY')).toEqual([
      'present', 'absent', 'correct', 'absent', 'absent',
    ]);
  });

  it('does not over-award present for extra duplicate letters', () => {
    // Guess LLAMA-like: use SPEED vs ERASE (both real 5-letter shapes for the rule).
    // target ABUSE has one A; guess ARMOR: A correct (index 0), R absent, M absent, O absent, R absent
    expect(evaluateGuess('ARMOR', 'ABUSE')).toEqual([
      'correct', 'absent', 'absent', 'absent', 'absent',
    ]);
  });

  it('awards present only up to the count available in the target', () => {
    // target LOOPS has two O; guess ROOTS: R present, O correct(idx1), O correct(idx2)?
    // LOOPS indices: L O O P S. ROOTS: R O O T S
    // idx0 R vs L -> not correct, R not in LOOPS -> absent
    // idx1 O vs O -> correct; idx2 O vs O -> correct; idx3 T vs P -> absent; idx4 S vs S -> correct
    expect(evaluateGuess('ROOTS', 'LOOPS')).toEqual([
      'absent', 'correct', 'correct', 'absent', 'correct',
    ]);
  });

  it('is case-insensitive', () => {
    expect(evaluateGuess('proxy', 'PROXY')).toEqual(
      evaluateGuess('PROXY', 'PROXY'),
    );
  });
});

describe('isValidGuess', () => {
  it('accepts a word in the list regardless of case', () => {
    expect(isValidGuess('proxy')).toBe(true);
    expect(isValidGuess('PROXY')).toBe(true);
  });
  it('rejects a word not in the list', () => {
    expect(isValidGuess('ZZZZZ')).toBe(false);
    expect(isValidGuess('HELLO')).toBe(false);
  });
});

describe('getDailyWord', () => {
  it('returns a 5-letter word from the list', () => {
    const w = getDailyWord();
    expect(w).toHaveLength(5);
    expect(WORDS).toContain(w);
  });
});

describe('buildShareText', () => {
  it('renders solved header and emoji rows', () => {
    const state: WordleState = {
      date: '2026-08-09',
      guesses: ['CRACK', 'PROXY'],
      results: [
        ['absent', 'correct', 'absent', 'absent', 'absent'],
        ['correct', 'correct', 'correct', 'correct', 'correct'],
      ],
      solved: true,
      failed: false,
      hintUsed: false,
      streak: 3,
      lastWin: '2026-08-09',
    };
    const text = buildShareText(state, 42);
    expect(text).toContain('Security Wordle #42 2/6');
    expect(text).toContain('🟩🟩🟩🟩🟩');
    expect(text).toContain('⬛🟩⬛⬛⬛');
  });

  it('renders X/6 header when not solved', () => {
    const state: WordleState = {
      date: '2026-08-09',
      guesses: [],
      results: [],
      solved: false,
      failed: true,
      hintUsed: false,
      streak: 0,
      lastWin: '',
    };
    expect(buildShareText(state, 7)).toContain('Security Wordle #7 X/6');
  });
});
