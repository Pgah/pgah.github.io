import { describe, it, expect } from 'vitest';
import { subnet, lookupPort } from './network';

describe('subnet', () => {
  it('computes a /24', () => {
    const s = subnet('192.168.1.0/24');
    expect(s.netmask).toBe('255.255.255.0');
    expect(s.network).toBe('192.168.1.0');
    expect(s.broadcast).toBe('192.168.1.255');
    expect(s.firstHost).toBe('192.168.1.1');
    expect(s.lastHost).toBe('192.168.1.254');
    expect(s.totalHosts).toBe(256);
    expect(s.usableHosts).toBe(254);
  });

  it('derives the network address from any host in the block', () => {
    const s = subnet('192.168.1.130/26');
    expect(s.network).toBe('192.168.1.128');
    expect(s.broadcast).toBe('192.168.1.191');
    expect(s.usableHosts).toBe(62);
  });

  it('handles a large /8', () => {
    const s = subnet('10.0.0.0/8');
    expect(s.netmask).toBe('255.0.0.0');
    expect(s.broadcast).toBe('10.255.255.255');
    expect(s.usableHosts).toBe(16777214);
  });

  it('treats /31 and /32 as fully usable', () => {
    const p2p = subnet('192.168.0.0/31');
    expect(p2p.usableHosts).toBe(2);
    const host = subnet('192.168.0.5/32');
    expect(host.usableHosts).toBe(1);
    expect(host.network).toBe(host.broadcast);
  });

  it('rejects bad input', () => {
    expect(() => subnet('192.168.1.0')).toThrow();
    expect(() => subnet('999.0.0.0/24')).toThrow();
    expect(() => subnet('10.0.0.0/40')).toThrow();
  });
});

describe('lookupPort', () => {
  it('finds by number', () => {
    const r = lookupPort('443');
    expect(r).toHaveLength(1);
    expect(r[0].service).toBe('HTTPS');
  });
  it('finds by service name (case-insensitive)', () => {
    expect(lookupPort('ssh').some(p => p.port === 22)).toBe(true);
    expect(lookupPort('DNS').some(p => p.port === 53)).toBe(true);
  });
  it('returns empty for unknown', () => {
    expect(lookupPort('99999')).toHaveLength(0);
  });
  it('supports ranges, sorted ascending and within bounds', () => {
    const r = lookupPort('20-25');
    expect(r.map(p => p.port)).toEqual([20, 21, 22, 23, 25]);
  });
  it('normalizes reversed ranges', () => {
    expect(lookupPort('25-20').map(p => p.port)).toEqual([20, 21, 22, 23, 25]);
  });
  it('carries risk notes on insecure ports', () => {
    expect(lookupPort('23')[0].risk).toMatch(/SSH/);
    expect(lookupPort('3389')[0].risk).toBeTruthy();
    expect(lookupPort('443')[0].risk).toBeUndefined();
  });
  it('includes the expanded port set', () => {
    for (const n of [88, 3389, 5900, 2375, 25565]) {
      expect(lookupPort(String(n))).toHaveLength(1);
    }
  });
});
