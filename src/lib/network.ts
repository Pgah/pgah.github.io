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
  /** Short warning for inherently insecure / high-risk ports. */
  risk?: string;
}

export const COMMON_PORTS: PortInfo[] = [
  { port: 20, proto: 'TCP', service: 'FTP-DATA', desc: 'File Transfer Protocol (data)', risk: 'unencrypted — prefer SFTP/FTPS' },
  { port: 21, proto: 'TCP', service: 'FTP', desc: 'File Transfer Protocol (control)', risk: 'unencrypted — prefer SFTP/FTPS' },
  { port: 22, proto: 'TCP', service: 'SSH', desc: 'Secure Shell / SFTP' },
  { port: 23, proto: 'TCP', service: 'Telnet', desc: 'Unencrypted remote login', risk: 'unencrypted — use SSH instead' },
  { port: 25, proto: 'TCP', service: 'SMTP', desc: 'Mail transfer' },
  { port: 43, proto: 'TCP', service: 'WHOIS', desc: 'Domain/IP registry lookup' },
  { port: 53, proto: 'TCP/UDP', service: 'DNS', desc: 'Domain Name System' },
  { port: 67, proto: 'UDP', service: 'DHCP', desc: 'DHCP server' },
  { port: 68, proto: 'UDP', service: 'DHCP', desc: 'DHCP client' },
  { port: 69, proto: 'UDP', service: 'TFTP', desc: 'Trivial FTP', risk: 'no auth, unencrypted — avoid' },
  { port: 80, proto: 'TCP', service: 'HTTP', desc: 'Web (unencrypted)', risk: 'unencrypted — redirect to HTTPS' },
  { port: 88, proto: 'TCP/UDP', service: 'Kerberos', desc: 'Network authentication' },
  { port: 110, proto: 'TCP', service: 'POP3', desc: 'Mail retrieval', risk: 'unencrypted — use POP3S (995)' },
  { port: 123, proto: 'UDP', service: 'NTP', desc: 'Network Time Protocol' },
  { port: 137, proto: 'UDP', service: 'NetBIOS-NS', desc: 'NetBIOS name service', risk: 'legacy; info leak — do not expose' },
  { port: 139, proto: 'TCP', service: 'NetBIOS-SSN', desc: 'NetBIOS session', risk: 'legacy — do not expose to internet' },
  { port: 143, proto: 'TCP', service: 'IMAP', desc: 'Mail retrieval', risk: 'unencrypted — use IMAPS (993)' },
  { port: 161, proto: 'UDP', service: 'SNMP', desc: 'Network management', risk: 'default community strings leak data' },
  { port: 389, proto: 'TCP/UDP', service: 'LDAP', desc: 'Directory services', risk: 'unencrypted — use LDAPS (636)' },
  { port: 443, proto: 'TCP', service: 'HTTPS', desc: 'Web over TLS' },
  { port: 445, proto: 'TCP', service: 'SMB', desc: 'Windows file sharing', risk: 'ransomware/worm target — never expose to internet' },
  { port: 465, proto: 'TCP', service: 'SMTPS', desc: 'SMTP over TLS' },
  { port: 514, proto: 'UDP', service: 'Syslog', desc: 'System logging' },
  { port: 587, proto: 'TCP', service: 'SMTP', desc: 'Mail submission (STARTTLS)' },
  { port: 636, proto: 'TCP', service: 'LDAPS', desc: 'LDAP over TLS' },
  { port: 993, proto: 'TCP', service: 'IMAPS', desc: 'IMAP over TLS' },
  { port: 995, proto: 'TCP', service: 'POP3S', desc: 'POP3 over TLS' },
  { port: 1433, proto: 'TCP', service: 'MSSQL', desc: 'Microsoft SQL Server', risk: 'database — never expose directly' },
  { port: 1521, proto: 'TCP', service: 'Oracle', desc: 'Oracle database', risk: 'database — never expose directly' },
  { port: 2375, proto: 'TCP', service: 'Docker', desc: 'Docker daemon API', risk: 'unauthenticated = full host takeover — never expose' },
  { port: 3306, proto: 'TCP', service: 'MySQL', desc: 'MySQL / MariaDB database', risk: 'database — never expose directly' },
  { port: 3389, proto: 'TCP', service: 'RDP', desc: 'Remote Desktop Protocol', risk: 'brute-force/ransomware target — put behind VPN' },
  { port: 5060, proto: 'TCP/UDP', service: 'SIP', desc: 'VoIP signaling' },
  { port: 5432, proto: 'TCP', service: 'PostgreSQL', desc: 'PostgreSQL database', risk: 'database — never expose directly' },
  { port: 5900, proto: 'TCP', service: 'VNC', desc: 'Remote desktop', risk: 'often weak/no auth — tunnel over SSH' },
  { port: 6379, proto: 'TCP', service: 'Redis', desc: 'Redis key-value store', risk: 'no auth by default — never expose' },
  { port: 6667, proto: 'TCP', service: 'IRC', desc: 'Internet Relay Chat' },
  { port: 8080, proto: 'TCP', service: 'HTTP-alt', desc: 'Alternate HTTP / proxies' },
  { port: 8443, proto: 'TCP', service: 'HTTPS-alt', desc: 'Alternate HTTPS' },
  { port: 9200, proto: 'TCP', service: 'Elasticsearch', desc: 'Search/analytics engine', risk: 'no auth by default — never expose' },
  { port: 11211, proto: 'TCP/UDP', service: 'memcached', desc: 'Memory cache', risk: 'no auth; DDoS amplification — never expose' },
  { port: 25565, proto: 'TCP', service: 'Minecraft', desc: 'Minecraft game server' },
  { port: 27017, proto: 'TCP', service: 'MongoDB', desc: 'MongoDB database', risk: 'database — never expose directly' },
];

export function lookupPort(query: string): PortInfo[] {
  const q = query.trim().toLowerCase();
  const range = q.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    let lo = Number(range[1]);
    let hi = Number(range[2]);
    if (lo > hi) [lo, hi] = [hi, lo];
    return COMMON_PORTS.filter(p => p.port >= lo && p.port <= hi).sort((a, b) => a.port - b.port);
  }
  if (/^\d+$/.test(q)) {
    const n = Number(q);
    return COMMON_PORTS.filter(p => p.port === n);
  }
  return COMMON_PORTS.filter(p =>
    p.service.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
  );
}
