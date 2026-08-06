// Terminal command registry.
//
// Each command is a self-contained entry with metadata used to auto-generate
// `help` and `tour` output. Command handlers talk to the page through a
// DOM-agnostic `CommandCtx` surface, so the pure logic they call
// (password / crypto / network) stays unit-testable.

import {
  analyzePassword, formatCrackTime, generatePassword,
  PW_BARS, PW_LABELS, PW_COLORS,
} from './password';
import {
  base64Encode, base64Decode, hexEncode, hexDecode, urlEncode, urlDecode,
  rot13, caesar, sha, decodeJwt, HASH_ALGOS, type HashAlgo,
} from './crypto';
import { subnet, lookupPort } from './network';

export interface PostMeta {
  id: string;
  date: number;
  dateStr: string;
  title: string;
  description: string;
  tags: string[];
}

export interface CommandCtx {
  posts: PostMeta[];
  history: string[];
  addLine(html?: string): void;
  navigate(url: string): void;
  clearOutput(): void;
  setActiveTag(tag: string | null): void;
  getActiveTag(): string | null;
  esc(s: unknown): string;
  tagSpan(t: string): string;
}

export interface CommandRow {
  usage: string;
  summary: string;
}

export interface Command {
  name: string;
  aliases?: string[];
  category: string;
  usage: string;
  summary: string;
  /** Extra rows shown under this command in help/tour (e.g. flag variants). */
  variants?: CommandRow[];
  /** When true (with an argument present), the invocation is kept out of history. */
  secret?: boolean;
  /** Hide from help/tour listings. */
  hidden?: boolean;
  run(ctx: CommandCtx, args: string[], argStr: string): void | Promise<void>;
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: 'navigation', label: 'navigation', emoji: '📂' },
  { id: 'security', label: 'security tools', emoji: '🔒' },
  { id: 'encoding', label: 'encoding & crypto', emoji: '🧬' },
  { id: 'network', label: 'network tools', emoji: '🌐' },
  { id: 'utilities', label: 'utilities', emoji: '⚙️' },
  { id: 'system', label: 'system', emoji: '🖥️' },
];

// ── shared formatting helpers ────────────────────────────────────────────
const INFO = '<span style="color:var(--cyan)">[INFO]</span>';
const WARN = '<span style="color:#ff8c00">[WARN]</span>';
const DIVIDER = '<span class="term-dim">────────────────────────────────</span>';

const label = (s: string, w = 16) =>
  `<span style="display:inline-block;min-width:${w}ch;color:var(--fg-dim)">${s}</span>`;

const nfLabel = (s: string) =>
  `<span class="man-section" style="display:inline-block;width:8ch">${s}</span>`;

function rowsFor(c: Command): CommandRow[] {
  return [{ usage: c.usage, summary: c.summary }, ...(c.variants ?? [])];
}

/** Split off the remainder after arg0, preserving internal spaces. */
function afterFirst(args: string[], argStr: string): string {
  return args.length ? argStr.slice(args[0].length).trim() : '';
}

/** Build an encode|decode style command handler. */
function codecCommand(
  name: string,
  encodeFn: (s: string) => string,
  decodeFn: (s: string) => string,
): Command['run'] {
  return (ctx, args, argStr) => {
    const mode = args[0];
    const text = afterFirst(args, argStr);
    if (mode !== 'encode' && mode !== 'decode') {
      ctx.addLine(`<span class="term-dim">usage: ${name} encode|decode &lt;text&gt;</span>`);
      return;
    }
    if (!text) { ctx.addLine(`<span class="term-err">${name}: no input</span>`); return; }
    try {
      const out = mode === 'encode' ? encodeFn(text) : decodeFn(text);
      ctx.addLine(`<span class="term-cmd" style="word-break:break-all">${ctx.esc(out)}</span>`);
    } catch {
      ctx.addLine(`<span class="term-err">${name}: invalid input</span>`);
    }
  };
}

const HASH_ALIASES: Record<string, HashAlgo> = {
  sha1: 'SHA-1', 'sha-1': 'SHA-1',
  sha256: 'SHA-256', 'sha-256': 'SHA-256',
  sha512: 'SHA-512', 'sha-512': 'SHA-512',
};

export const THEMES = ['gold', 'matrix', 'amber'];

const FORTUNES = [
  'A password is like a toothbrush: change it regularly and never share it.',
  'There is no patch for human curiosity — beware phishing.',
  'Encryption without key management is just a false sense of security.',
  'The S in IoT stands for Security.',
  'Trust, but verify. Then verify again.',
  'Amateurs hack systems, professionals hack people.',
  'A chain is only as strong as its weakest, unpatched link.',
  'Backups you have never restored are just hopes, not backups.',
  'The most secure system is one that is also usable.',
  'Defense in depth: assume every single layer will fail.',
];

export function applyTheme(name: string): void {
  document.documentElement.setAttribute('data-theme', name);
  try { localStorage.setItem('theme', name); } catch { /* ignore */ }
}

// ── command definitions ──────────────────────────────────────────────────
export const commands: Command[] = [
  // navigation
  {
    name: 'ls', category: 'navigation',
    usage: 'ls', summary: 'list all posts',
    variants: [
      { usage: 'ls -la', summary: 'list with details' },
      { usage: 'ls --tag &lt;tag&gt;', summary: 'filter listing by tag' },
      { usage: 'ls --tag', summary: 'clear tag filter' },
    ],
    run(ctx, args) {
      const tagIdx = args.indexOf('--tag');
      if (tagIdx !== -1) {
        const tag = args[tagIdx + 1];
        if (!tag) {
          ctx.setActiveTag(null);
          ctx.addLine('<span class="term-dim">tag filter cleared</span>');
          return;
        }
        const newTag = ctx.getActiveTag() === tag ? null : tag;
        ctx.setActiveTag(newTag);
        if (!newTag) { ctx.addLine('<span class="term-dim">tag filter cleared</span>'); return; }
        const filtered = ctx.posts.filter(p => p.tags.includes(tag));
        if (!filtered.length) {
          ctx.addLine(`<span class="term-err">ls: no posts tagged "${ctx.esc(tag)}"</span>`);
          return;
        }
        ctx.addLine(`<span class="term-dim">tag: ${ctx.tagSpan(tag)} — ${filtered.length} post${filtered.length !== 1 ? 's' : ''}:</span>`);
        filtered.forEach(p => ctx.addLine(`<span class="perm">-rw-r--r--</span>&nbsp;&nbsp;<span class="date">${p.dateStr}</span>&nbsp;&nbsp;<a class="term-link" href="/posts/${p.id}">${ctx.esc(p.title)}</a>`));
        return;
      }
      const flag = args[0];
      if (flag === '-la' || flag === '-l') {
        ctx.posts.forEach(p => ctx.addLine(`<span class="perm">-rw-r--r--</span>&nbsp;&nbsp;<span class="date">${p.dateStr}</span>&nbsp;&nbsp;<span class="term-cmd">${p.id}</span>`));
      } else {
        ctx.posts.forEach(p => ctx.addLine(`<span class="term-cmd">${p.id}</span>`));
      }
    },
  },
  {
    name: 'cd', category: 'navigation',
    usage: 'cd &lt;post-id&gt;', summary: 'open a post',
    run(ctx, args) {
      const target = args[0];
      if (!target) { ctx.addLine('<span class="term-err">cd: missing operand</span>'); return; }
      if (target === '..') { ctx.navigate('/'); return; }
      const post = ctx.posts.find(p => p.id === target);
      if (post) ctx.navigate(`/posts/${post.id}`);
      else ctx.addLine(`<span class="term-err">bash: cd: ${ctx.esc(target)}: No such file or directory</span>`);
    },
  },
  {
    name: 'cat', category: 'navigation',
    usage: 'cat &lt;post-id&gt;', summary: 'open a post (alias)',
    run(ctx, args) {
      const raw = args[0];
      if (!raw) { ctx.addLine('<span class="term-err">cat: missing operand</span>'); return; }
      const target = raw.replace(/\.md$/, '');
      const post = ctx.posts.find(p => p.id === target);
      if (post) ctx.navigate(`/posts/${post.id}`);
      else ctx.addLine(`<span class="term-err">cat: ${ctx.esc(raw)}: No such file or directory</span>`);
    },
  },
  {
    name: 'grep', category: 'navigation',
    usage: 'grep &lt;term&gt;', summary: 'search titles, descriptions, tags',
    run(ctx, args) {
      if (!args.length) { ctx.addLine('<span class="term-dim">usage: grep &lt;term&gt;</span>'); return; }
      const query = args.join(' ');
      const pattern = query.replace(/^["']|["']$/g, '').toLowerCase();
      const matches = ctx.posts.filter(p =>
        p.title.toLowerCase().includes(pattern) ||
        p.description.toLowerCase().includes(pattern) ||
        p.tags.some(t => t.toLowerCase().includes(pattern)));
      if (!matches.length) {
        ctx.addLine(`<span class="term-err">grep: no matches for "${ctx.esc(query)}"</span>`);
        return;
      }
      ctx.addLine(`<span class="term-dim">${matches.length} match${matches.length !== 1 ? 'es' : ''}:</span>`);
      matches.forEach(p => {
        const tagsHtml = p.tags.map(t => ctx.tagSpan(t)).join(' ');
        const desc = p.description.length > 85 ? p.description.slice(0, 85) + '…' : p.description;
        ctx.addLine(`<a class="term-link" href="/posts/${p.id}">${ctx.esc(p.title)}</a>&nbsp;${tagsHtml}`);
        ctx.addLine(`<span class="term-desc">&nbsp;&nbsp;${ctx.esc(desc)}</span>`);
      });
    },
  },
  {
    name: 'man', category: 'navigation',
    usage: 'man &lt;post-id&gt;', summary: 'show post info',
    variants: [{ usage: 'man about', summary: 'view about page' }],
    run(ctx, args) {
      const target = args[0];
      if (!target) { ctx.addLine('<span class="term-dim">usage: man &lt;post-id&gt;</span>'); return; }
      if (target === 'about') { ctx.navigate('/about'); return; }
      const exact = ctx.posts.find(p => p.id === target);
      const partialMatches = ctx.posts.filter(p => p.id.includes(target));
      const post = exact || (partialMatches.length === 1 ? partialMatches[0] : null);
      if (!post && partialMatches.length > 1) {
        ctx.addLine(`<span class="term-err">man: ambiguous — did you mean: ${partialMatches.map(p => p.id).join(', ')}?</span>`);
      } else if (post) {
        ctx.addLine(`<span class="man-name">${ctx.esc(post.title)}</span>`);
        ctx.addLine('<span class="term-dim">────────────────────────────────</span>');
        ctx.addLine('<span class="man-section">DESCRIPTION</span>');
        ctx.addLine(`&nbsp;&nbsp;&nbsp;&nbsp;${ctx.esc(post.description)}`);
        if (post.tags.length) {
          ctx.addLine('<span class="man-section">TAGS</span>');
          ctx.addLine(`&nbsp;&nbsp;&nbsp;&nbsp;${post.tags.map(t => ctx.tagSpan(t)).join(' ')}`);
        }
        ctx.addLine('<span class="man-section">DATE</span>');
        ctx.addLine(`&nbsp;&nbsp;&nbsp;&nbsp;${post.dateStr}`);
        ctx.addLine(`<span class="term-dim">&nbsp;&nbsp;→ <a class="term-link" href="/posts/${post.id}">cd ${ctx.esc(post.id)}</a></span>`);
      } else {
        ctx.addLine(`<span class="term-err">man: no entry for "${ctx.esc(target)}" — try: grep ${ctx.esc(target)}</span>`);
      }
    },
  },

  // security tools
  {
    name: 'pwcheck', category: 'security', secret: true,
    usage: 'pwcheck &lt;password&gt;', summary: 'analyze password strength',
    run(ctx, _args, argStr) {
      const pw = argStr;
      if (!pw) {
        ctx.addLine('<span class="term-dim">usage: pwcheck &lt;password&gt;</span>');
        ctx.addLine('<span class="term-dim">e.g.:&nbsp;&nbsp;pwcheck MyP@ssw0rd123!</span>');
        return;
      }
      const a = analyzePassword(pw);
      ctx.addLine(`${INFO} <span class="term-dim">Password is analyzed locally in your browser.</span>`);
      ctx.addLine(DIVIDER);
      ctx.addLine(label('Length') + `<span class="term-cmd">${pw.length} chars</span>`);
      ctx.addLine(label('Charset') + ctx.esc(a.charsetDesc));
      ctx.addLine(label('Entropy') + `${a.entropy.toFixed(1)} bit`);
      ctx.addLine(label('Est. crack time') + `~${ctx.esc(formatCrackTime(a.crackSeconds))} <span class="term-dim">(GPU brute-force)</span>`);
      ctx.addLine(label('Strength') + `<span style="color:${PW_COLORS[a.score]}">${PW_BARS[a.score]}&nbsp;&nbsp;${PW_LABELS[a.score]}</span>`);
      if (a.warnings.length) {
        ctx.addLine(DIVIDER);
        a.warnings.forEach(w => ctx.addLine(`${WARN} ${ctx.esc(w)}`));
      }
      const tips: string[] = [];
      if (pw.length < 12) tips.push('Use at least 12 characters (16+ recommended)');
      else if (pw.length < 16) tips.push('16+ characters would be stronger');
      if (!a.hasUpper) tips.push('Add uppercase letters (A-Z)');
      if (!a.hasDigit) tips.push('Add digits (0-9)');
      if (!a.hasSymbol) tips.push('Add symbols (!@#$ etc.)');
      if (a.score < 3) tips.push('&rarr; generate a strong one with <span class="term-cmd">pwgen -l 20</span>');
      if (tips.length) {
        ctx.addLine(DIVIDER);
        ctx.addLine('<span class="term-dim">Suggestions:</span>');
        tips.forEach(t => ctx.addLine(`&nbsp;&nbsp;<span class="term-dim">+</span> ${t}`));
      }
    },
  },
  {
    name: 'pwgen', category: 'security',
    usage: 'pwgen', summary: 'generate a 16-char password',
    variants: [
      { usage: 'pwgen -l &lt;n&gt;', summary: 'custom length (8–128)' },
      { usage: 'pwgen -n &lt;k&gt;', summary: 'generate k passwords (max 10)' },
      { usage: 'pwgen --no-symbols', summary: 'no symbols' },
    ],
    run(ctx, args) {
      let genLen = 16, genCount = 1, genSymbols = true;
      let genErr: string | null = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-l') {
          const v = parseInt(args[i + 1], 10);
          if (!args[i + 1] || isNaN(v) || v < 8 || v > 128) { genErr = 'pwgen: -l value must be between 8-128'; break; }
          genLen = v; i++;
        } else if (args[i] === '-n') {
          const v = parseInt(args[i + 1], 10);
          if (!args[i + 1] || isNaN(v) || v < 1 || v > 10) { genErr = 'pwgen: -n value must be between 1-10'; break; }
          genCount = v; i++;
        } else if (args[i] === '--no-symbols') {
          genSymbols = false;
        } else {
          genErr = `pwgen: unknown option: ${ctx.esc(args[i])}`; break;
        }
      }
      if (genErr) { ctx.addLine(`<span class="term-err">${genErr}</span>`); return; }
      ctx.addLine(`${INFO} <span class="term-dim">Passwords are generated locally in your browser.</span>`);
      ctx.addLine(DIVIDER);
      for (let i = 0; i < genCount; i++) {
        ctx.addLine(`&nbsp;&nbsp;<span class="term-cmd">${ctx.esc(generatePassword(genLen, genSymbols))}</span>`);
      }
      const poolSize = 62 + (genSymbols ? 24 : 0);
      const entropy = genLen * Math.log2(poolSize);
      const score = entropy < 28 ? 0 : entropy < 36 ? 1 : entropy < 60 ? 2 : entropy < 128 ? 3 : 4;
      ctx.addLine(DIVIDER);
      ctx.addLine(`<span class="term-dim">Entropy: ~${entropy.toFixed(0)} bit &nbsp;|&nbsp; Strength: <span style="color:${PW_COLORS[score]}">${PW_BARS[score]} ${PW_LABELS[score]}</span></span>`);
    },
  },

  // encoding & crypto
  {
    name: 'hash', category: 'encoding',
    usage: 'hash [algo] &lt;text&gt;', summary: 'SHA-1/256/512 digest (all if no algo)',
    async run(ctx, args, argStr) {
      if (!args.length) { ctx.addLine('<span class="term-dim">usage: hash [sha1|sha256|sha512] &lt;text&gt;</span>'); return; }
      const first = args[0].toLowerCase();
      if (first === 'md5') {
        ctx.addLine(`${WARN} MD5 is not available via Web Crypto (and is cryptographically broken). Try sha256.`);
        return;
      }
      let algos: HashAlgo[];
      let text: string;
      if (HASH_ALIASES[first]) { algos = [HASH_ALIASES[first]]; text = afterFirst(args, argStr); }
      else { algos = HASH_ALGOS; text = argStr; }
      if (!text) { ctx.addLine('<span class="term-err">hash: no text to hash</span>'); return; }
      ctx.addLine(`${INFO} <span class="term-dim">Hashed locally in your browser.</span>`);
      ctx.addLine(DIVIDER);
      for (const algo of algos) {
        const digest = await sha(algo, text);
        ctx.addLine(`<span style="display:inline-block;min-width:9ch;color:var(--fg-dim)">${algo}</span><span class="term-cmd" style="word-break:break-all">${digest}</span>`);
      }
    },
  },
  {
    name: 'base64', category: 'encoding',
    usage: 'base64 encode|decode &lt;text&gt;', summary: 'Base64 encode / decode',
    run: codecCommand('base64', base64Encode, base64Decode),
  },
  {
    name: 'hex', category: 'encoding',
    usage: 'hex encode|decode &lt;text&gt;', summary: 'hex encode / decode',
    run: codecCommand('hex', hexEncode, hexDecode),
  },
  {
    name: 'url', category: 'encoding',
    usage: 'url encode|decode &lt;text&gt;', summary: 'URL percent encode / decode',
    run: codecCommand('url', urlEncode, urlDecode),
  },
  {
    name: 'rot13', category: 'encoding',
    usage: 'rot13 &lt;text&gt;', summary: 'ROT13 cipher (self-inverse)',
    run(ctx, _args, argStr) {
      if (!argStr) { ctx.addLine('<span class="term-dim">usage: rot13 &lt;text&gt;</span>'); return; }
      ctx.addLine(`<span class="term-cmd" style="word-break:break-all">${ctx.esc(rot13(argStr))}</span>`);
    },
  },
  {
    name: 'caesar', category: 'encoding',
    usage: 'caesar &lt;shift&gt; &lt;text&gt;', summary: 'Caesar cipher by N positions',
    run(ctx, args, argStr) {
      const shift = parseInt(args[0], 10);
      const text = afterFirst(args, argStr);
      if (isNaN(shift) || !text) { ctx.addLine('<span class="term-dim">usage: caesar &lt;shift&gt; &lt;text&gt;</span>'); return; }
      ctx.addLine(`<span class="term-cmd" style="word-break:break-all">${ctx.esc(caesar(text, shift))}</span>`);
    },
  },
  {
    name: 'jwt', category: 'encoding',
    usage: 'jwt &lt;token&gt;', summary: 'decode a JWT (no verification)',
    run(ctx, args) {
      const token = args[0];
      if (!token) { ctx.addLine('<span class="term-dim">usage: jwt &lt;token&gt;</span>'); return; }
      let parts;
      try { parts = decodeJwt(token); }
      catch (e) { ctx.addLine(`<span class="term-err">jwt: ${ctx.esc((e as Error).message)}</span>`); return; }
      ctx.addLine(`${INFO} <span class="term-dim">Decoded locally. Signature is NOT verified.</span>`);
      ctx.addLine(DIVIDER);
      ctx.addLine('<span class="man-section">HEADER</span>');
      ctx.addLine(`<span class="term-cmd" style="word-break:break-all">${ctx.esc(JSON.stringify(parts.header))}</span>`);
      ctx.addLine('<span class="man-section">PAYLOAD</span>');
      for (const [k, v] of Object.entries(parts.payload)) {
        let line = `&nbsp;&nbsp;<span style="color:var(--fg-dim)">${ctx.esc(k)}</span>: ${ctx.esc(JSON.stringify(v))}`;
        if ((k === 'exp' || k === 'iat' || k === 'nbf') && typeof v === 'number') {
          line += ` <span class="term-dim">(${new Date(v * 1000).toISOString()})</span>`;
        }
        ctx.addLine(line);
      }
      if (typeof parts.payload.exp === 'number') {
        const expired = parts.payload.exp * 1000 < Date.now();
        ctx.addLine(DIVIDER);
        ctx.addLine(expired
          ? `${WARN} token is <span style="color:#e05252">EXPIRED</span>`
          : `<span style="color:var(--green)">[OK]</span> token not expired`);
      }
    },
  },

  // network tools
  {
    name: 'subnet', category: 'network',
    usage: 'subnet &lt;ip&gt;/&lt;prefix&gt;', summary: 'IPv4 subnet calculator',
    run(ctx, args) {
      if (!args[0]) { ctx.addLine('<span class="term-dim">usage: subnet &lt;ip&gt;/&lt;prefix&gt;  e.g. 192.168.1.0/24</span>'); return; }
      let info;
      try { info = subnet(args[0]); }
      catch (e) { ctx.addLine(`<span class="term-err">subnet: ${ctx.esc((e as Error).message)}</span>`); return; }
      ctx.addLine(label('Network') + `<span class="term-cmd">${info.cidr}</span>`);
      ctx.addLine(label('Netmask') + info.netmask);
      ctx.addLine(label('Wildcard') + info.wildcard);
      ctx.addLine(label('Broadcast') + info.broadcast);
      ctx.addLine(label('Host range') + `${info.firstHost} <span class="term-dim">–</span> ${info.lastHost}`);
      ctx.addLine(label('Usable hosts') + `<span class="term-cmd">${info.usableHosts.toLocaleString('en-US')}</span>`);
    },
  },
  {
    name: 'ports', category: 'network',
    usage: 'ports &lt;number|range|service&gt;', summary: 'look up common ports (e.g. 443, 1-1024, ssh)',
    run(ctx, args) {
      if (!args[0]) { ctx.addLine('<span class="term-dim">usage: ports &lt;number|range|service&gt;  e.g. ports 443, ports 1-1024, ports ssh</span>'); return; }
      const query = args.join(' ');
      const results = lookupPort(query);
      if (!results.length) { ctx.addLine(`<span class="term-err">ports: no match for "${ctx.esc(query)}"</span>`); return; }
      const shown = results.slice(0, 40);
      shown.forEach(p => {
        ctx.addLine(
          `<span class="term-cmd" style="display:inline-block;min-width:7ch">${p.port}</span>` +
          `<span style="display:inline-block;min-width:9ch;color:var(--fg-dim)">${ctx.esc(p.proto)}</span>` +
          `<span style="display:inline-block;min-width:11ch">${ctx.esc(p.service)}</span>` +
          `<span class="term-desc">${ctx.esc(p.desc)}</span>`);
        if (p.risk) {
          ctx.addLine(`<span style="display:inline-block;min-width:27ch"></span>${WARN} <span class="term-desc">${ctx.esc(p.risk)}</span>`);
        }
      });
      if (results.length > shown.length) {
        ctx.addLine(`<span class="term-dim">… and ${results.length - shown.length} more — narrow the range</span>`);
      }
    },
  },

  // utilities
  {
    name: 'echo', category: 'utilities',
    usage: 'echo &lt;text&gt;', summary: 'print text back',
    run(ctx, _args, argStr) { ctx.addLine(argStr ? ctx.esc(argStr) : ''); },
  },
  {
    name: 'date', category: 'utilities',
    usage: 'date', summary: 'show current date & time',
    run(ctx) { ctx.addLine(`<span class="term-cmd">${ctx.esc(new Date().toString())}</span>`); },
  },
  {
    name: 'history', category: 'utilities',
    usage: 'history', summary: 'show command history',
    run(ctx) {
      if (!ctx.history.length) { ctx.addLine('<span class="term-dim">no history yet</span>'); return; }
      ctx.history.forEach((h, i) => ctx.addLine(
        `&nbsp;&nbsp;<span class="term-dim" style="display:inline-block;min-width:5ch">${i + 1}</span><span class="term-cmd">${ctx.esc(h)}</span>`));
    },
  },
  {
    name: 'fortune', category: 'utilities',
    usage: 'fortune', summary: 'a random security aphorism',
    run(ctx) {
      const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      ctx.addLine(`<span class="term-cmd">"${ctx.esc(f)}"</span>`);
    },
  },
  {
    name: 'theme', category: 'utilities',
    usage: 'theme &lt;name&gt;', summary: `switch color theme (${THEMES.join(', ')})`,
    run(ctx, args) {
      const name = args[0];
      const current = document.documentElement.getAttribute('data-theme') || 'gold';
      if (!name) {
        ctx.addLine('<span class="term-dim">available themes:</span>');
        THEMES.forEach(t => ctx.addLine(`&nbsp;&nbsp;<span class="term-cmd">${t}</span>${t === current ? ' <span class="term-dim">(current)</span>' : ''}`));
        ctx.addLine('<span class="term-dim">usage: theme &lt;name&gt;</span>');
        return;
      }
      if (!THEMES.includes(name)) {
        ctx.addLine(`<span class="term-err">theme: unknown theme "${ctx.esc(name)}" — try: ${THEMES.join(', ')}</span>`);
        return;
      }
      applyTheme(name);
      ctx.addLine(`<span class="term-dim">theme set to</span> <span class="term-cmd">${name}</span>`);
    },
  },
  {
    name: 'matrix', category: 'utilities',
    usage: 'matrix on|off', summary: 'toggle the matrix rain background',
    run(ctx, args) {
      const mode = args[0];
      if (mode !== 'on' && mode !== 'off') { ctx.addLine('<span class="term-dim">usage: matrix on|off</span>'); return; }
      document.documentElement.setAttribute('data-matrix', mode);
      try { localStorage.setItem('matrix', mode); } catch { /* ignore */ }
      ctx.addLine(`<span class="term-dim">matrix rain</span> <span class="term-cmd">${mode}</span>`);
    },
  },
  {
    name: 'sudo', category: 'utilities', hidden: true,
    usage: 'sudo &lt;command&gt;', summary: 'superuser do',
    run(ctx) {
      ctx.addLine('<span class="term-dim">[sudo] password for sleeper:</span>');
      ctx.addLine('<span class="term-err">sleeper is not in the sudoers file. This incident will be reported.</span>');
    },
  },

  // system
  {
    name: 'whoami', category: 'system',
    usage: 'whoami', summary: 'current user',
    run(ctx) {
      ctx.addLine('sleeper');
      ctx.addLine('<span class="term-dim">→ <a class="term-link" href="/about">man about</a></span>');
    },
  },
  {
    name: 'neofetch', category: 'system',
    usage: 'neofetch', summary: 'system info',
    run(ctx) {
      const uniqueTags = [...new Set(ctx.posts.flatMap(p => p.tags))];
      const latest = ctx.posts[0];
      ctx.addLine('<span class="term-cmd">sleeper</span><span class="term-dim">@</span><span class="term-cmd">matrix-303.pages.dev</span>');
      ctx.addLine('<span class="term-dim">────────────────────────────</span>');
      ctx.addLine(`${nfLabel('Posts')}${ctx.posts.length}`);
      ctx.addLine(`${nfLabel('Tags')}${uniqueTags.map(t => ctx.tagSpan(t)).join(' ')}`);
      if (latest) ctx.addLine(`${nfLabel('Latest')}<a class="term-link" href="/posts/${latest.id}">${ctx.esc(latest.title)}</a> <span class="term-dim">(${latest.dateStr})</span>`);
      ctx.addLine(`${nfLabel('Shell')}bash (matrix terminal v2)`);
      ctx.addLine(`${nfLabel('Theme')}${document.documentElement.getAttribute('data-theme') || 'gold'}`);
      ctx.addLine(`${nfLabel('Site')}<a class="term-link" href="/">matrix-303.pages.dev</a>`);
    },
  },
  {
    name: 'clear', category: 'system',
    usage: 'clear', summary: 'clear terminal output',
    run(ctx) { ctx.clearOutput(); },
  },
  {
    name: 'tour', category: 'system',
    usage: 'tour', summary: 'interactive feature overview',
    run(ctx) {
      const tl = (s: string) => `<span style="display:inline-block;min-width:18ch;color:var(--cyan)">${s}</span>`;
      ctx.addLine('<span class="term-dim">╔══════════════════════════════════════╗</span>');
      ctx.addLine('<span class="term-dim">║</span>           site features              <span class="term-dim">║</span>');
      ctx.addLine('<span class="term-dim">╚══════════════════════════════════════╝</span>');
      for (const cat of CATEGORIES) {
        const cmds = commands.filter(c => c.category === cat.id && !c.hidden && c.name !== 'help' && c.name !== 'tour');
        if (!cmds.length) continue;
        ctx.addLine('');
        ctx.addLine(`&nbsp;&nbsp;<span style="color:var(--green)">${cat.emoji} ${cat.label}</span>`);
        ctx.addLine('&nbsp;&nbsp;<span class="term-dim">──────────────────────────────────────</span>');
        for (const c of cmds) {
          for (const row of rowsFor(c)) {
            ctx.addLine(`&nbsp;&nbsp;${tl(row.usage)}${row.summary}`);
          }
        }
      }
      ctx.addLine('');
      ctx.addLine('&nbsp;&nbsp;<span style="color:var(--green)">⌨️  shortcuts</span>');
      ctx.addLine('&nbsp;&nbsp;<span class="term-dim">──────────────────────────────────────</span>');
      ctx.addLine('&nbsp;&nbsp;<span class="term-dim" style="display:inline-block;min-width:18ch">Tab</span>autocomplete commands & post IDs');
      ctx.addLine('&nbsp;&nbsp;<span class="term-dim" style="display:inline-block;min-width:18ch">↑ / ↓</span>navigate command history');
      ctx.addLine('');
      ctx.addLine("&nbsp;&nbsp;<span class=\"term-dim\">type 'help' for the full command reference</span>");
    },
  },
  {
    name: 'help', category: 'system', hidden: true,
    usage: 'help', summary: 'show command reference',
    run(ctx) {
      ctx.addLine('<span class="term-dim">available commands:</span>');
      let first = true;
      for (const cat of CATEGORIES) {
        const cmds = commands.filter(c => c.category === cat.id && !c.hidden);
        if (!cmds.length) continue;
        if (!first) {
          const dashes = '─'.repeat(Math.max(2, 30 - cat.label.length));
          ctx.addLine(`&nbsp;&nbsp;<span class="term-dim">── ${cat.label} ${dashes}</span>`);
        }
        first = false;
        for (const c of cmds) {
          for (const row of rowsFor(c)) {
            ctx.addLine(`&nbsp;&nbsp;<span class="term-cmd" style="display:inline-block;min-width:28ch">${row.usage}</span><span class="term-desc">${row.summary}</span>`);
          }
        }
      }
      ctx.addLine('<span class="term-dim">tip: Tab autocompletes commands & post IDs &nbsp;↑↓ navigates history</span>');
    },
  },
];

// ── registry lookup ──────────────────────────────────────────────────────
const commandMap = new Map<string, Command>();
for (const c of commands) {
  commandMap.set(c.name, c);
  for (const a of c.aliases ?? []) commandMap.set(a, c);
}

export function findCommand(name: string): Command | undefined {
  return commandMap.get(name);
}

/** All command names + aliases, for tab completion. */
export const commandNames: string[] = [...commandMap.keys()].sort();
