// IPv4 subnet math + common-port lookup. Pure, DOM-free, unit-testable.

function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) throw new Error('invalid IPv4 address');
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) throw new Error('invalid IPv4 octet: ' + p);
    const o = Number(p);
    if (o < 0 || o > 255) throw new Error('invalid IPv4 octet: ' + p);
    n = ((n << 8) | o) >>> 0;
  }
  return n >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export interface SubnetInfo {
  cidr: string;
  prefix: number;
  netmask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  usableHosts: number;
}

export function subnet(input: string): SubnetInfo {
  const m = input.trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!m) throw new Error('usage: subnet <ip>/<prefix>  e.g. 192.168.1.0/24');
  const ipInt = ipToInt(m[1]);
  const prefix = Number(m[2]);
  if (prefix < 0 || prefix > 32) throw new Error('prefix must be between 0 and 32');

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = ~mask >>> 0;
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = Math.pow(2, 32 - prefix);

  let firstHost: number;
  let lastHost: number;
  let usable: number;
  if (prefix >= 31) {
    // /31 (point-to-point) and /32 (single host): every address is usable
    firstHost = network;
    lastHost = broadcast;
    usable = total;
  } else {
    firstHost = (network + 1) >>> 0;
    lastHost = (broadcast - 1) >>> 0;
    usable = total - 2;
  }

  return {
    cidr: `${intToIp(network)}/${prefix}`,
    prefix,
    netmask: intToIp(mask),
    wildcard: intToIp(wildcard),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(firstHost),
    lastHost: intToIp(lastHost),
    totalHosts: total,
    usableHosts: usable,
  };
}

export interface PortInfo {
  port: number;
  proto: string;
  service: string;
  desc: string;
}

export const COMMON_PORTS: PortInfo[] = [
  { port: 20, proto: 'TCP', service: 'FTP-DATA', desc: 'File Transfer Protocol (data)' },
  { port: 21, proto: 'TCP', service: 'FTP', desc: 'File Transfer Protocol (control)' },
  { port: 22, proto: 'TCP', service: 'SSH', desc: 'Secure Shell / SFTP' },
  { port: 23, proto: 'TCP', service: 'Telnet', desc: 'Unencrypted remote login' },
  { port: 25, proto: 'TCP', service: 'SMTP', desc: 'Mail transfer' },
  { port: 53, proto: 'TCP/UDP', service: 'DNS', desc: 'Domain Name System' },
  { port: 67, proto: 'UDP', service: 'DHCP', desc: 'DHCP server' },
  { port: 68, proto: 'UDP', service: 'DHCP', desc: 'DHCP client' },
  { port: 80, proto: 'TCP', service: 'HTTP', desc: 'Web (unencrypted)' },
  { port: 110, proto: 'TCP', service: 'POP3', desc: 'Mail retrieval' },
  { port: 123, proto: 'UDP', service: 'NTP', desc: 'Network Time Protocol' },
  { port: 143, proto: 'TCP', service: 'IMAP', desc: 'Mail retrieval' },
  { port: 161, proto: 'UDP', service: 'SNMP', desc: 'Network management' },
  { port: 389, proto: 'TCP/UDP', service: 'LDAP', desc: 'Directory services' },
  { port: 443, proto: 'TCP', service: 'HTTPS', desc: 'Web over TLS' },
  { port: 445, proto: 'TCP', service: 'SMB', desc: 'Windows file sharing' },
  { port: 465, proto: 'TCP', service: 'SMTPS', desc: 'SMTP over TLS' },
  { port: 587, proto: 'TCP', service: 'SMTP', desc: 'Mail submission (STARTTLS)' },
  { port: 636, proto: 'TCP', service: 'LDAPS', desc: 'LDAP over TLS' },
  { port: 993, proto: 'TCP', service: 'IMAPS', desc: 'IMAP over TLS' },
  { port: 995, proto: 'TCP', service: 'POP3S', desc: 'POP3 over TLS' },
  { port: 3306, proto: 'TCP', service: 'MySQL', desc: 'MySQL / MariaDB database' },
  { port: 3389, proto: 'TCP', service: 'RDP', desc: 'Remote Desktop Protocol' },
  { port: 5432, proto: 'TCP', service: 'PostgreSQL', desc: 'PostgreSQL database' },
  { port: 6379, proto: 'TCP', service: 'Redis', desc: 'Redis key-value store' },
  { port: 8080, proto: 'TCP', service: 'HTTP-alt', desc: 'Alternate HTTP / proxies' },
  { port: 8443, proto: 'TCP', service: 'HTTPS-alt', desc: 'Alternate HTTPS' },
  { port: 27017, proto: 'TCP', service: 'MongoDB', desc: 'MongoDB database' },
];

export function lookupPort(query: string): PortInfo[] {
  const q = query.trim().toLowerCase();
  if (/^\d+$/.test(q)) {
    const n = Number(q);
    return COMMON_PORTS.filter(p => p.port === n);
  }
  return COMMON_PORTS.filter(p =>
    p.service.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
  );
}
