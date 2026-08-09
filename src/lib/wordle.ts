// Daily Security Wordle — word list, game logic, and localStorage state.

export type GuessResult = 'correct' | 'present' | 'absent';

export interface WordleState {
  date: string;
  guesses: string[];
  results: GuessResult[][];
  solved: boolean;
  failed: boolean;
  hintUsed: boolean;
  streak: number;
  lastWin: string;
}

export const WORDS: readonly string[] = [
  'CRACK', 'PROXY', 'TOKEN', 'PATCH', 'FLOOD',
  'SPOOF', 'SNIFF', 'NONCE', 'CRYPT', 'BLOCK',
  'CHAIN', 'SHELL', 'PIVOT', 'AUDIT', 'VIRUS',
  'WORMS', 'STACK', 'IPSEC', 'ADMIN', 'AGENT',
  'ALERT', 'ASSET', 'BRUTE', 'CACHE', 'CREDS',
  'CYBER', 'DEBUG', 'DECOY', 'EPOCH', 'ERROR',
  'EVADE', 'EXFIL', 'FAULT', 'FORGE', 'FRAME',
  'GHOST', 'GROUP', 'GUARD', 'HEIST', 'HOOKS',
  'HYDRA', 'IMAGE', 'INPUT', 'LOGIN', 'MACRO',
  'MITRE', 'MUTEX', 'NODES', 'NOISE', 'OAUTH',
  'OWNER', 'PANIC', 'PARSE', 'PERMS', 'PHISH',
  'PLAIN', 'PORTS', 'POWER', 'PRIME', 'PROBE',
  'QUEUE', 'RECON', 'RELAY', 'RESET', 'ROGUE',
  'ROOTS', 'ROUTE', 'RULES', 'SCOPE', 'SIGMA',
  'SOCKS', 'SPAWN', 'SPRAY', 'STAGE', 'STATE',
  'STEAL', 'STDIN', 'TRACK', 'TRACE', 'TRUST',
  'UNION', 'USERS', 'VAULT', 'VENOM', 'VHOST',
  'XPATH', 'LINUX', 'GRANT', 'MOUNT', 'BREAK',
  'LAYER', 'REALM', 'LOGIC', 'EMBED', 'FETCH',
  'FIELD', 'RANGE', 'TRAIL', 'TRAPS', 'LOCAL',
  'MODEL', 'MODES', 'KNOWN', 'CLOSE', 'CHECK',
  'LEARN', 'CLONE', 'DEPTH', 'DRAIN', 'TRADE',
  'MIMIC', 'SPEAR', 'SNARE', 'ARMOR', 'BYTES',
  'CLOUD', 'CRAFT', 'CYCLE', 'DELTA', 'DRAFT',
  'ENTRY', 'ENVOY', 'EJECT', 'ELUDE', 'QUOTA',
  'SEIZE', 'VIGOR', 'WIPES', 'BLUFF', 'LOOPS',
  'CHMOD', 'CHOWN', 'CNAME', 'UNAME', 'UMASK',
  'INODE', 'STEGO', 'POSIX', 'ABUSE', 'DUMPS',
  'LOCKS', 'DROPS', 'EMAIL', 'PAGES', 'PIXEL',
  'SNORT', 'ENCAP', 'SWEEP', 'FUZZY', 'EAVES',
] as const;

const WORD_SET = new Set<string>(WORDS);

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayIndex(): number {
  const epoch = new Date('2026-01-01').getTime();
  const localMidnight = new Date();
  localMidnight.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((localMidnight.getTime() - epoch) / 86_400_000));
}

export function getDailyWord(): string {
  return WORDS[dayIndex() % WORDS.length];
}

const STORAGE_KEY = 'wordle-state';

function freshState(): WordleState {
  return {
    date: todayStr(),
    guesses: [],
    results: [],
    solved: false,
    failed: false,
    hintUsed: false,
    streak: 0,
    lastWin: '',
  };
}

export function loadState(): WordleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw) as WordleState;
    if (s.date !== todayStr()) {
      const streak = s.lastWin === yesterdayStr() ? s.streak : 0;
      const next = freshState();
      next.streak = streak;
      return next;
    }
    return s;
  } catch {
    return freshState();
  }
}

export function saveState(state: WordleState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function isValidGuess(word: string): boolean {
  return WORD_SET.has(word.toUpperCase());
}

// Correct Wordle evaluation handling duplicate letters.
export function evaluateGuess(guess: string, target: string): GuessResult[] {
  const g = guess.toUpperCase();
  const t = target.toUpperCase();
  const result: GuessResult[] = new Array(5).fill('absent');
  const remaining: Record<string, number> = {};

  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct';
    } else {
      remaining[t[i]] = (remaining[t[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i];
    if (remaining[ch]) {
      result[i] = 'present';
      remaining[ch]--;
    }
  }

  return result;
}

export function buildShareText(state: WordleState, day: number): string {
  const header = state.solved
    ? `Security Wordle #${day} ${state.guesses.length}/6`
    : `Security Wordle #${day} X/6`;
  const rows = state.results.map(r =>
    r.map(v => v === 'correct' ? '🟩' : v === 'present' ? '🟨' : '⬛').join('')
  );
  return [header, '', ...rows, '', 'pgah.github.io/wordle'].join('\n');
}
