import { describe, it, expect } from 'vitest';
import { findCommand, commands, CATEGORIES, type CommandCtx, type PostMeta } from './commands';

const POSTS: PostMeta[] = [
  { id: 'how-dns-works', date: 2, dateStr: '02/02/2026', title: 'How DNS Works', description: 'dns stuff', tags: ['dns', 'networking'] },
  { id: 'how-tls-works', date: 1, dateStr: '01/01/2026', title: 'How TLS Works', description: 'tls stuff', tags: ['tls'] },
];

function makeCtx(posts: PostMeta[] = POSTS) {
  const lines: string[] = [];
  const ctx: CommandCtx = {
    posts,
    history: [],
    addLine: (h = '') => { lines.push(h); },
    navigate: (u) => { lines.push('NAV:' + u); },
    clearOutput: () => { lines.length = 0; },
    setActiveTag: () => {},
    getActiveTag: () => null,
    esc: (s) => String(s),
    tagSpan: (t) => `[${t}]`,
  };
  return { ctx, lines, out: () => lines.join('\n') };
}

async function run(name: string, args: string[], argStr = args.join(' ')) {
  const cmd = findCommand(name);
  if (!cmd) throw new Error(`no command ${name}`);
  const { ctx, out } = makeCtx();
  await cmd.run(ctx, args, argStr);
  return out();
}

describe('registry wiring', () => {
  it('resolves every command by its own name', () => {
    for (const c of commands) expect(findCommand(c.name)).toBe(c);
  });
  it('assigns every command to a known category', () => {
    const ids = new Set(CATEGORIES.map(c => c.id));
    for (const c of commands) expect(ids.has(c.category)).toBe(true);
  });
});

describe('security & encoding commands', () => {
  it('hash sha256 abc', async () => {
    expect(await run('hash', ['sha256', 'abc'])).toContain(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('base64 encode/decode', async () => {
    expect(await run('base64', ['encode', 'hello'])).toContain('aGVsbG8=');
    expect(await run('base64', ['decode', 'aGVsbG8='])).toContain('hello');
  });
  it('caesar shift', async () => {
    expect(await run('caesar', ['3', 'abc'])).toContain('def');
  });
  it('rot13', async () => {
    expect(await run('rot13', ['Hello'])).toContain('Uryyb');
  });
  it('jwt decode surfaces claims', async () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const out = await run('jwt', [token]);
    expect(out).toContain('John Doe');
    expect(out).toContain('HS256');
  });
});

describe('network commands', () => {
  it('subnet', async () => {
    const out = await run('subnet', ['192.168.1.0/24']);
    expect(out).toContain('192.168.1.255');
    expect(out).toContain('255.255.255.0');
  });
  it('ports lookup', async () => {
    expect(await run('ports', ['443'])).toContain('HTTPS');
  });
});

describe('navigation & utility commands', () => {
  it('ls lists post ids', async () => {
    const out = await run('ls', []);
    expect(out).toContain('how-dns-works');
    expect(out).toContain('how-tls-works');
  });
  it('cd navigates to a post', async () => {
    expect(await run('cd', ['how-dns-works'])).toBe('NAV:/posts/how-dns-works');
  });
  it('grep matches by tag', async () => {
    expect(await run('grep', ['tls'])).toContain('How TLS Works');
  });
  it('echo echoes', async () => {
    expect(await run('echo', ['hey', 'there'], 'hey there')).toBe('hey there');
  });
  it('unknown-looking pwgen still generates', async () => {
    const out = await run('pwgen', []);
    expect(out).toContain('Entropy');
  });
});
