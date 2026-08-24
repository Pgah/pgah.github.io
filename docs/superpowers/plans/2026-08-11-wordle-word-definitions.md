# Wordle Word Definitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the English definition of the day's word when the player finishes a Wordle game (win or loss).

**Architecture:** Add a `DEFINITIONS` record and `getDefinition()` export to `wordle.ts`. In `wordle.astro`, add a hidden `.wl-definition` card to the DOM and call `showDefinition()` inside `finishGame()`.

**Tech Stack:** TypeScript, Astro, Vitest

## Global Constraints

- All 365 words in `WORDS` must have an entry in `DEFINITIONS`.
- Keys in `DEFINITIONS` are uppercase strings matching the `WORDS` entries exactly.
- `getDefinition` returns `null` for any word not found — the card stays hidden.
- No external API calls — all definitions are bundled at build time.
- Definition card is shown on both win and loss.
- Styling uses existing CSS custom properties (`var(--fg-bright)`, `var(--fg-muted)`, `var(--fg-dim)`, `var(--bg-soft)`).

---

### Task 1: Add DEFINITIONS and getDefinition() to wordle.ts

**Files:**
- Modify: `src/lib/wordle.ts` (append after the `WORD_SET` declaration)
- Modify: `src/lib/wordle.test.ts` (add `getDefinition` import and tests)

**Interfaces:**
- Produces: `export function getDefinition(word: string): string | null`

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/lib/wordle.test.ts`:

```typescript
import {
  evaluateGuess, isValidGuess, buildShareText, getDailyWord,
  WORDS, getDefinition, type WordleState,
} from './wordle';

describe('getDefinition', () => {
  it('returns a non-empty string for every word in WORDS', () => {
    for (const word of WORDS) {
      const def = getDefinition(word);
      expect(def).not.toBeNull();
      expect(typeof def).toBe('string');
      expect((def as string).length).toBeGreaterThan(0);
    }
  });

  it('is case-insensitive', () => {
    expect(getDefinition('proxy')).toBe(getDefinition('PROXY'));
  });

  it('returns null for an unknown word', () => {
    expect(getDefinition('ZZZZZ')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/lib/wordle.test.ts
```

Expected: FAIL — `getDefinition is not a function` or similar.

- [ ] **Step 3: Add DEFINITIONS and getDefinition() to wordle.ts**

Append the following after the `const WORD_SET = new Set<string>(WORDS);` line in `src/lib/wordle.ts`:

```typescript
export const DEFINITIONS: Readonly<Record<string, string>> = {
  CRACK: 'To break a cipher, password, or protection mechanism through analysis or brute force.',
  PROXY: 'A server that acts as an intermediary between a client and another server, masking the origin IP.',
  TOKEN: 'A string or object used to authenticate or authorize access, often short-lived and digitally signed.',
  PATCH: 'A software update that fixes a vulnerability, bug, or security flaw in an existing program.',
  FLOOD: 'An attack that overwhelms a target with excessive traffic or requests to cause denial of service.',
  SPOOF: 'To forge the source address or identity of a communication to impersonate a trusted entity.',
  SNIFF: 'To passively capture network packets in transit to extract credentials or sensitive data.',
  NONCE: 'A number used only once in a cryptographic protocol to prevent replay attacks.',
  CRYPT: 'A cryptographic module or function that encrypts and decrypts data using a key.',
  BLOCK: 'A fixed-size chunk of data processed together in block cipher encryption; also, to deny access.',
  CHAIN: 'A sequence of linked elements, such as a certificate chain or a blockchain of validated records.',
  SHELL: 'A command-line interface to an OS; a reverse shell gives an attacker interactive remote access.',
  PIVOT: 'To use a compromised host as a launchpad to attack other systems within the same network.',
  AUDIT: 'A systematic review of logs and configurations to verify security compliance and detect anomalies.',
  VIRUS: 'Malicious code that attaches itself to legitimate files and spreads when those files are executed.',
  WORMS: 'Self-replicating malware that spreads across networks without requiring user interaction.',
  STACK: 'A region of memory used for function call frames; a common target for buffer overflow attacks.',
  IPSEC: 'A suite of protocols that authenticates and encrypts IP packets to secure network communications.',
  ADMIN: 'An account with elevated privileges used to manage and configure a system or network.',
  AGENT: 'An autonomous program that operates on behalf of a user or system to perform tasks remotely.',
  ALERT: 'A notification from a security system triggered when a suspicious event or rule violation is detected.',
  ASSET: 'Any hardware, software, or data resource that has value to an organization and must be protected.',
  BRUTE: 'Brute force — systematically trying all possible combinations to crack a password or key.',
  CACHE: 'A fast temporary storage layer; a poisoned cache can redirect users to malicious content.',
  CREDS: 'Short for credentials — usernames, passwords, or tokens used to authenticate to a system.',
  CYBER: 'Relating to computers, networks, and information systems, especially in the context of security.',
  DEBUG: 'To find and remove errors from code; a debugger can also be used to analyze malware behavior.',
  DECOY: 'A fake system or resource used to lure and detect attackers, such as a honeypot.',
  EPOCH: 'A fixed reference point in time used as a starting point for timestamps in computing systems.',
  ERROR: 'An unexpected condition in a program that can reveal information or be exploited by an attacker.',
  EVADE: 'To bypass or circumvent security controls such as antivirus, firewalls, or intrusion detection.',
  EXFIL: 'Short for exfiltration — unauthorized transfer of data out of a compromised system or network.',
  FAULT: 'A hardware or software defect that can be intentionally triggered to bypass security mechanisms.',
  FORGE: 'To create a fraudulent copy of a signature, certificate, or message that appears legitimate.',
  FRAME: 'To construct false evidence that implicates an innocent party; also an OSI data-link unit.',
  GHOST: 'A hidden or dormant malware instance that evades detection by masking its presence.',
  GROUP: 'A collection of users or resources with shared permissions and access control rules.',
  GUARD: 'A security check or control that enforces policy before granting access to a resource.',
  HEIST: 'A coordinated, high-value cyber theft operation targeting financial or sensitive data assets.',
  HOOKS: 'Entry points in code or an OS that allow external code to intercept and modify behavior.',
  HYDRA: 'A fast, parallelized network login cracking tool; also a multi-headed botnet structure.',
  IMAGE: 'A disk or memory snapshot of a system used for forensics, deployment, or malware analysis.',
  INPUT: 'Data supplied by a user or external source; unsanitized input is the root cause of injection attacks.',
  LOGIN: 'The process of authenticating to a system using credentials to gain access.',
  MACRO: 'A scripted sequence of commands that can be embedded in documents to execute malicious code.',
  MITRE: 'A nonprofit that maintains the ATT&CK framework cataloguing known adversary techniques.',
  MUTEX: 'A mutual exclusion lock; malware uses mutexes as infection markers to avoid re-infecting a host.',
  NODES: 'Individual machines or devices in a network, each a potential target or pivot point.',
  NOISE: 'Irrelevant or misleading data in logs that obscures malicious activity from analysts.',
  OAUTH: 'An open authorization framework that allows third-party apps to access resources on a user\'s behalf.',
  OWNER: 'The principal that has full control over a resource, file, or object in an access control system.',
  PANIC: 'A kernel-level crash triggered by an unrecoverable error, which can be induced as denial of service.',
  PARSE: 'To analyze and interpret structured data; parsing flaws in XML or JSON can be exploited.',
  PERMS: 'Short for permissions — access control settings that define who can read, write, or execute a resource.',
  PHISH: 'A social engineering attack that uses deceptive emails or websites to steal credentials.',
  PLAIN: 'Plaintext — data in its unencrypted, human-readable form before or after encryption is applied.',
  PORTS: 'Logical endpoints on a host that network services listen on; open ports are common attack surfaces.',
  POWER: 'Control over system resources; privilege escalation attacks seek to gain elevated power.',
  PRIME: 'A prime number used in asymmetric cryptography algorithms like RSA to generate key pairs.',
  PROBE: 'An active or passive scan used to discover hosts, open ports, or services on a network.',
  QUEUE: 'A data structure for ordered message passing; insecure queues can leak data or allow injection.',
  RECON: 'Reconnaissance — gathering information about a target before launching an attack.',
  RELAY: 'A host or service that forwards traffic, potentially used to anonymize attacker origin.',
  RESET: 'A TCP reset packet that forcibly closes a connection; also wiping a device to factory state.',
  ROGUE: 'An unauthorized device, access point, or service operating within a network without permission.',
  ROOTS: 'Root-level access — the highest privilege tier on a Unix system that grants full control.',
  ROUTE: 'The path network packets travel between source and destination; route poisoning redirects traffic.',
  RULES: 'Policy-based conditions in a firewall or IDS that determine whether traffic is allowed or blocked.',
  SCOPE: 'The defined boundaries of a penetration test or security assessment that limit permitted actions.',
  SIGMA: 'An open standard for writing detection rules that can be converted to various SIEM query formats.',
  SOCKS: 'A proxy protocol that routes arbitrary TCP/UDP traffic through an intermediary server.',
  SPAWN: 'To create a new process; malware often spawns child processes to carry out malicious tasks.',
  SPRAY: 'Password spraying — trying one common password across many accounts to avoid lockout thresholds.',
  STAGE: 'A phase in a multi-step attack chain; also a staging server used to host payloads before delivery.',
  STATE: 'The current condition of a system or session; state confusion bugs can cause authentication bypass.',
  STEAL: 'To exfiltrate credentials, tokens, or secrets from memory or storage without authorization.',
  STDIN: 'Standard input stream in Unix; programs reading from stdin can be exploited via input injection.',
  TRACK: 'To monitor the activity or location of a user, process, or asset over time.',
  TRACE: 'A detailed log of function calls or network events used for debugging or forensic analysis.',
  TRUST: 'A relationship where one entity accepts claims or actions from another without full verification.',
  UNION: 'A SQL UNION attack that appends additional SELECT queries to extract data from a database.',
  USERS: 'Accounts on a system that represent individuals or services, each with assigned permissions.',
  VAULT: 'A secure, encrypted storage system for secrets such as API keys, passwords, and certificates.',
  VENOM: 'A hypervisor escape vulnerability (CVE-2015-3456) that allowed code execution on the host OS.',
  VHOST: 'A virtual host — serving multiple domains from one server, sometimes exploitable for bypass.',
  XPATH: 'An XML query language; XPath injection attacks manipulate queries to extract unauthorized data.',
  LINUX: 'An open-source Unix-like kernel widely used in servers, embedded systems, and security tools.',
  GRANT: 'To assign permissions or privileges to a user or role in an access control system.',
  MOUNT: 'To attach a filesystem to a directory tree; improper mount options can introduce security risks.',
  BREAK: 'To defeat or circumvent a cryptographic algorithm, protocol, or security control.',
  LAYER: 'An abstraction level in a protocol stack; defense in depth uses multiple independent layers.',
  REALM: 'A security domain within which authentication and authorization rules are enforced.',
  LOGIC: 'A logic bomb is code that executes a malicious action when a specific condition is triggered.',
  EMBED: 'To hide code or data inside another file or object; malware is often embedded in legitimate files.',
  FETCH: 'To retrieve a resource over the network; SSRF exploits unauthorized fetches to reach internal hosts.',
  FIELD: 'A named data element in a record or form; unsanitized fields are entry points for injection attacks.',
  RANGE: 'A span of IP addresses or ports; scanning a range reveals available targets on a network.',
  TRAIL: 'An audit trail is a chronological record of events used to reconstruct security incidents.',
  TRAPS: 'Security traps or honeypots designed to detect, deflect, and study unauthorized access attempts.',
  LOCAL: 'Referring to the local machine; local privilege escalation elevates rights on a host system.',
  MODEL: 'A threat model that identifies assets, threats, and mitigations for a system\'s security posture.',
  MODES: 'Cipher modes (e.g., CBC, GCM) that define how block algorithms process and protect data.',
  KNOWN: 'A known vulnerability is one that has been publicly disclosed and catalogued, such as in CVE.',
  CLOSE: 'To terminate a connection or session; failing to close resources can cause state reuse bugs.',
  CHECK: 'To validate input, state, or permissions; a missing check is a common source of vulnerabilities.',
  LEARN: 'Machine learning is used in security to detect anomalies and classify threats from behavior data.',
  CLONE: 'To duplicate a repository, identity card, or RFID credential for unauthorized use.',
  DEPTH: 'Defense in depth uses multiple independent security controls to slow or stop an attacker.',
  DRAIN: 'To continuously consume items from a queue or buffer, potentially causing resource exhaustion.',
  TRADE: 'The exchange of stolen data or access; insider trading of breached records is a key threat.',
  MIMIC: 'To impersonate a trusted system, process, or user to bypass authentication or deceive victims.',
  SPEAR: 'Spear phishing — a targeted social engineering attack tailored to a specific individual or org.',
  SNARE: 'A trap set to detect or catch attackers, similar to a honeypot or canary token.',
  ARMOR: 'Protective hardening applied to software or systems to resist reverse engineering and exploitation.',
  BYTES: 'The fundamental unit of digital data; analyzing raw bytes is central to malware and protocol analysis.',
  CLOUD: 'A shared pool of remotely accessed compute resources; misconfigurations are a leading attack vector.',
  CRAFT: 'To carefully construct a malicious payload, packet, or message to exploit a specific vulnerability.',
  CYCLE: 'A processor clock cycle; timing side-channel attacks exploit variations in operation cycle counts.',
  DELTA: 'The difference between two states or versions; security patches are often described as deltas.',
  DRAFT: 'An unfinalized document or protocol; draft standards may contain security flaws not yet reviewed.',
  ENTRY: 'An entry point in code or a network where input is accepted and where attacks are often initiated.',
  ENVOY: 'A proxy or intermediary that relays communication between services in a service mesh architecture.',
  EJECT: 'To forcibly remove a process, session, or device from a system, often as a defensive action.',
  ELUDE: 'To avoid detection by security controls through obfuscation, timing, or evasion techniques.',
  QUOTA: 'A resource limit imposed on a user or process; exhausting quotas can cause denial of service.',
  SEIZE: 'To take control of a domain, account, or resource through legal action or exploitation.',
  VIGOR: 'The strength or robustness of a security control or algorithm measured by resistance to attack.',
  WIPES: 'Secure data wiping that overwrites storage to make recovery of sensitive information impossible.',
  BLUFF: 'A social engineering tactic where an attacker deceives a target by feigning authority or knowledge.',
  LOOPS: 'Uncontrolled loops in code can cause CPU exhaustion and be triggered as a denial-of-service vector.',
  CHMOD: 'A Unix command to change file permissions, controlling read, write, and execute access.',
  CHOWN: 'A Unix command to change file ownership, determining which user and group control a file.',
  CNAME: 'A DNS record that aliases one domain to another; CNAME hijacking can redirect traffic to attackers.',
  UNAME: 'A Unix command that displays system info, useful for reconnaissance on a compromised host.',
  UMASK: 'A Unix setting that defines default permission bits subtracted when new files are created.',
  INODE: 'A data structure in a filesystem storing metadata about a file, excluding its name or content.',
  STEGO: 'Short for steganography — the practice of hiding data within images, audio, or other files.',
  POSIX: 'A family of IEEE standards defining a compatible interface for Unix-like operating systems.',
  ABUSE: 'Misuse of a legitimate system, API, or account in ways that violate policy or terms of service.',
  DUMPS: 'Memory or database dumps that capture raw data; credential dumps extract hashed passwords.',
  LOCKS: 'Synchronization primitives that prevent concurrent access; lock contention can cause system delays.',
  DROPS: 'Firewall rules or ACL entries that silently discard packets matching specified criteria.',
  EMAIL: 'An electronic messaging medium and a primary vector for phishing and malware delivery.',
  PAGES: 'Web pages served over HTTP/HTTPS; malicious pages can host exploits or credential-harvesting forms.',
  PIXEL: 'A tracking pixel is a tiny embedded image used to covertly monitor when an email or page is opened.',
  SNORT: 'An open-source network intrusion detection and prevention system using signature-based rules.',
  ENCAP: 'Encapsulation — wrapping data in protocol headers as it passes through network layers, e.g., in VPNs.',
  SWEEP: 'A network sweep that pings or probes a range of hosts to identify which are online and responsive.',
  FUZZY: 'Fuzzing — a testing technique that sends malformed or random input to find crashes and vulnerabilities.',
  EAVES: 'Eavesdropping — passively intercepting communications between parties without their knowledge.',
  ABORT: 'To terminate a running process or task before it completes, often used as a safety or error response.',
  ABOVE: 'At a higher protocol layer; a protocol above another depends on the services it provides.',
  ACTOR: 'A threat actor is an individual or group responsible for initiating a cyberattack or incident.',
  ADAPT: 'To modify behavior in response to new conditions; adaptive malware changes to avoid detection.',
  ADEPT: 'Highly skilled; security professionals must be adept at both attack and defense techniques.',
  ADOPT: 'To accept and integrate a new tool, standard, or practice into an existing security workflow.',
  AGILE: 'An iterative development methodology; secure SDLC integrates security into each Agile sprint.',
  ALARM: 'A triggered alert indicating a security event that requires immediate investigation or response.',
  ALIAS: 'An alternate name that maps to another identifier; command aliases can mask malicious executions.',
  ALIGN: 'To bring controls, policies, or architectures into conformance with a standard or framework.',
  ALLOW: 'A firewall or ACL rule that explicitly permits specified traffic or actions to proceed.',
  ALPHA: 'The first stage of software testing, conducted internally before external release or pen testing.',
  AMEND: 'To modify an existing policy, rule, or record; unauthorized amendments to logs indicate tampering.',
  ANGLE: 'An approach or attack vector — the specific path or method an attacker uses to reach a target.',
  ARENA: 'The domain or environment in which a security contest, red team, or threat actor operates.',
  ARGUE: 'In formal verification, to make a logical case that a system satisfies its security properties.',
  ARRAY: 'An ordered collection of elements in memory; buffer overflows often corrupt adjacent array data.',
  ARROW: 'In data flow diagrams, an arrow represents the direction of data movement between components.',
  ASIDE: 'A side channel — an unintended information path such as timing or power consumption that leaks secrets.',
  ATLAS: 'A comprehensive mapping or reference of attack techniques, systems, or infrastructure.',
  AUDIO: 'Sound data that can carry hidden messages via steganography or be used in voice phishing attacks.',
  AVOID: 'To prevent exposure to a known threat by removing the vulnerable component or changing behavior.',
  AWAIT: 'An async programming pattern; improper await handling can cause race conditions in security code.',
  AWARD: 'Recognition given for responsible disclosure or outstanding contributions to security research.',
  AWARE: 'Security awareness — the understanding of threats and safe practices required of all users.',
  BADGE: 'A physical or digital credential used to verify identity and control access to secured areas.',
  BASIC: 'Foundational; also HTTP Basic Authentication, which sends credentials in base64 over the wire.',
  BATCH: 'A set of jobs processed together; batch scripts can automate both attacks and defensive tasks.',
  BEACH: 'A beachhead — the initial foothold an attacker establishes inside a target network after compromise.',
  BEGIN: 'The start of a session or protocol handshake that may be vulnerable to hijacking or replay.',
  BENCH: 'A test environment where security tools and exploits are developed and evaluated safely.',
  BLADE: 'A server blade in a shared chassis; shared hardware increases the risk of side-channel leakage.',
  BLAME: 'Git blame identifies who last modified each line, helping locate who introduced a vulnerability.',
  BLANK: 'An uninitialized or null value; failing to check for blank input is a common security oversight.',
  BLAST: 'Blast radius — the scope of systems and data potentially affected by a vulnerability or breach.',
  BLAZE: 'A rapid, widespread propagation of malware or an attack that spreads quickly across a network.',
  BLEND: 'To mix malicious code with legitimate functionality to evade detection by security tools.',
  BLIND: 'Blind SQL injection or blind XSS — attacks where the output is not directly visible to the attacker.',
  BLINK: 'A rapid state change; a blinking indicator on a hardware device may signal tampering or malfunction.',
  BLOOM: 'A Bloom filter — a probabilistic data structure used in security to test set membership efficiently.',
  BOARD: 'A circuit board; physical access to boards enables hardware-level attack vectors and implants.',
  BONUS: 'Unexpected bonus functionality in software may hide backdoors or unintended features.',
  BOOST: 'To elevate privileges or increase capabilities, as in privilege escalation exploits.',
  BOOTH: 'An isolated environment used to safely demonstrate or test security tools at conferences.',
  BOUND: 'A memory access limit; out-of-bounds access causes buffer overflows and memory corruption.',
  BRAIN: 'The central processing logic; novel insight into attack or defense is called a security brainwave.',
  BRAND: 'An organization\'s identity; brand impersonation is used in phishing to deceive victims.',
  BRAVE: 'A privacy-focused web browser with built-in ad blocking and fingerprinting protection.',
  BRICK: 'To render a device permanently inoperable through a malicious firmware update or destructive wipe.',
  BRIEF: 'A concise summary of a threat intelligence report or security incident prepared for stakeholders.',
  BRING: 'BYOD (bring your own device) policies expand the attack surface to employee-owned hardware.',
  BROAD: 'Wide in scope; a broad attack targets many systems or users simultaneously rather than one target.',
  BRUSH: 'A brush with security failure is an incident that narrowly avoided causing serious harm.',
  BUILD: 'The compiled artifact of source code; a compromised build pipeline can inject malware into software.',
  BUILT: 'Pre-compiled and assembled; built-in security features are controls integrated at design time.',
  BURST: 'A sudden spike in traffic or resource usage that may indicate a DDoS attack or exfiltration event.',
  BUYER: 'A consumer of stolen data, exploits, or access credentials in underground cybercriminal markets.',
  CABLE: 'Physical networking medium; unsecured cables enable packet sniffing or network tapping attacks.',
  CARGO: 'Data being transported across a network; intercepted cargo is the target of man-in-the-middle attacks.',
  CARRY: 'A carrier protocol may embed malicious payloads within otherwise legitimate traffic.',
  CATCH: 'An exception handler in code; missing catch blocks can expose stack traces and internal details.',
  CAUSE: 'The root cause of a vulnerability or breach, identified during incident response and forensic analysis.',
  CEASE: 'To stop an operation or process; a cease-and-desist may be issued against malicious infrastructure.',
  CHARM: 'A deceptive quality used in social engineering to build false trust and manipulate a target.',
  CHART: 'A visual representation of data; security dashboards use charts to display threat metrics.',
  CHASE: 'To actively hunt a threat actor across logs, networks, and systems during incident response.',
  CHEAT: 'To bypass intended rules; cheat engines for games are often bundled with credential stealers.',
  CHESS: 'A metaphor for strategic security — anticipating opponent moves and planning several steps ahead.',
  CHEST: 'A repository of high-value data; a treasure chest of secrets is a prime target for attackers.',
  CHIEF: 'The CISO (Chief Information Security Officer) is the senior leader responsible for security strategy.',
  CHILD: 'A subprocess spawned by a parent process; malware often spawns child processes to evade detection.',
  CHUNK: 'A segment of data; splitting data into chunks is used both in protocols and in covert exfiltration.',
  CIVIC: 'Relating to public infrastructure; civic systems like voting machines are high-value attack targets.',
  CIVIL: 'Relating to civil law; cybercrime may result in civil liability in addition to criminal prosecution.',
  CLAIM: 'An assertion about identity or permissions in a JWT or token; forged claims enable unauthorized access.',
  CLAMP: 'To restrict or limit; rate clamping prevents resource exhaustion by throttling excessive requests.',
  CLASH: 'A conflict between two security policies or access control rules that produces unintended behavior.',
  CLASS: 'A category of attack, vulnerability, or malware grouped by shared characteristics or behavior.',
  CLEAN: 'Free from malware or compromise; a clean system has passed all integrity and security checks.',
  CLEAR: 'To securely erase data from memory or storage so it cannot be recovered by an attacker.',
  CLERK: 'A low-privileged user account; compromising a clerk account is the first step in many attack chains.',
  CLICK: 'Clickjacking — a UI attack that tricks users into clicking hidden elements on a malicious web page.',
  CLIMB: 'To escalate privileges step by step, moving from low-level access toward administrative control.',
  CLING: 'To remain persistent on a system; malware clings via registry entries or scheduled tasks.',
  CLOCK: 'A system clock; time manipulation attacks desynchronize clocks to exploit timestamp-based controls.',
  COAST: 'The attack surface boundary; hardening the coast means reducing exposed entry points on a system.',
  COLON: 'A punctuation character used in URLs and protocols that must be properly encoded to avoid injection.',
  COLOR: 'Team colors: red (attack), blue (defense), purple (combined), white (judge) in security exercises.',
  COMET: 'A codename for a threat actor group; named threat actors are tracked by intelligence researchers.',
  COUNT: 'To enumerate or tally items; counting requests is used in rate limiting to prevent abuse.',
  COURT: 'Legal proceedings related to cybercrime; digital evidence must be preserved carefully for court use.',
  COVER: 'To conceal activity or identity; cover traffic hides malicious communications within normal traffic.',
  CRANE: 'A tool for moving containers; in DevSecOps, container orchestration tools must be secured carefully.',
  CRASH: 'A system failure caused by an error or attack; crashes can sometimes be exploited for code execution.',
  CRAWL: 'To systematically traverse a website to map its structure, used by both search engines and attackers.',
  CREAM: 'The best or top tier; cream-of-the-crop exploits are zero-days with high reliability and impact.',
  CREST: 'CREST is an accreditation body for penetration testers and incident responders.',
  CRIME: 'A cyberattack that violates the law; cybercrime includes hacking, fraud, and data theft.',
  CRISP: 'Clear and unambiguous; crisp security policies leave no ambiguity that an attacker could exploit.',
  CROSS: 'Cross-site scripting (XSS) — an attack that injects malicious scripts into pages viewed by others.',
  CROWD: 'A large group; crowdsourced threat intelligence aggregates findings from many researchers.',
  CROWN: 'Crown jewels are the most critical data or assets an organization must protect above all else.',
  CRUSH: 'To decisively defeat an attack or shut down malicious infrastructure through defensive action.',
  CURVE: 'An elliptic curve — a mathematical structure used in ECC cryptography for key exchange and signing.',
  DAILY: 'Occurring each day; daily log reviews and patch cycles are fundamental security hygiene practices.',
  DANCE: 'A protocol handshake sequence; the TLS dance negotiates cipher suites and authenticates both parties.',
  DEALT: 'Handled or distributed; when a breach is dealt with, the incident response plan is fully executed.',
  DEBIT: 'An unauthorized debit is the result of payment card fraud or financial account takeover.',
  DECAY: 'Key decay means shortening the validity period of cryptographic credentials over time.',
  DELAY: 'A time lag introduced intentionally; delays can indicate denial of service or evasion activity.',
  DENSE: 'Highly packed or complex; dense obfuscated code hides malware logic from static analysis tools.',
  DEPOT: 'A central distribution point; a compromised package depot can poison many downstream software users.',
  DETER: 'To discourage attacks through strong controls, legal consequences, or visible security measures.',
  DEVIL: 'In threat modeling, the devil\'s advocate identifies worst-case scenarios and overlooked attack paths.',
  DIARY: 'A personal log; threat actors may keep operational diaries later used as evidence in prosecutions.',
  DIGIT: 'A single numeric character; digit-only PINs have a small keyspace that is easily brute-forced.',
  DIODE: 'A one-way data link device used in industrial systems to ensure data only flows outward.',
  DIRTY: 'Untrusted or potentially malicious; dirty input must be sanitized before use in security code.',
  DITCH: 'To discard an insecure approach; ditching weak algorithms is part of cryptographic agility.',
  DODGE: 'To avoid detection or blocking by changing behavior, signature, or routing.',
  DONOR: 'An entity that provides resources; a donor account may be used to fund attacker infrastructure.',
  DOUBT: 'Uncertainty about security; when in doubt, apply the principle of least privilege.',
  DOZEN: 'Approximately twelve; a dozen vulnerabilities in one codebase indicates poor security hygiene.',
  DRAMA: 'A high-profile security incident that draws media attention and public scrutiny.',
  DRAWN: 'Attracted or pulled; drawn-in victims are lured by social engineering and phishing tactics.',
  DREAM: 'An aspirational security posture where all risks are mitigated and zero trust is fully enforced.',
  DRESS: 'To format or prepare data; attackers dress up malicious payloads to bypass content filters.',
  DRIFT: 'Configuration drift — the gradual deviation of system settings from their secure baseline.',
  DRILL: 'A security drill or tabletop exercise that rehearses incident response procedures with the team.',
  DRINK: 'Drinking from the firehose describes the challenge of processing massive volumes of security logs.',
  DRIVE: 'A storage device; drive encryption protects data at rest from unauthorized physical access.',
  DROVE: 'Threat actors drove lateral movement through the network after establishing initial access.',
  DROWN: 'A cryptographic attack exploiting SSLv2 weaknesses to decrypt TLS sessions (CVE-2016-0800).',
  DUSTY: 'Outdated or neglected; dusty systems with no updates are high-risk targets for known exploits.',
  DWELL: 'Dwell time — the period an attacker remains undetected inside a network after initial compromise.',
  EAGER: 'Highly motivated; an eager threat actor moves quickly after initial access, increasing detection risk.',
  EAGLE: 'A codename sometimes used for government surveillance programs or elite cyber units.',
  EARLY: 'Detecting a threat early in the kill chain limits the attacker\'s ability to achieve objectives.',
  EARTH: 'Ground-level or physical access; earth-level attacks include hardware implants and physical intrusion.',
  EIGHT: '8 characters is the historical minimum recommended length for a password, though 12+ is now standard.',
  ELBOW: 'An over-the-shoulder or elbow attack allows visual theft of credentials as someone types.',
  ELDER: 'A legacy system; elder systems often run unsupported software with known, unpatched vulnerabilities.',
  ELECT: 'To choose or vote; election systems are critical infrastructure that must be protected from interference.',
  ELITE: 'A highly skilled attacker or defender; elite threat actors use custom zero-day tools and novel methods.',
  EMPTY: 'A null or uninitialized state; empty input validation gaps allow injection or unexpected behavior.',
  ENACT: 'To put a policy or control into effect; enacted security policies must be enforced and audited.',
  ENEMY: 'A hostile threat actor; knowing the enemy\'s tactics and motivations informs defensive strategy.',
  ENJOY: 'Attackers enjoy persistent access while remaining undetected, maximizing dwell time and data theft.',
  ENTER: 'To gain access to a system; the entry point is the first stage of the attack chain.',
  EQUAL: 'Equivalent in privilege; no user should have more access than needed — enforce least privilege.',
  EQUIP: 'To provision a system or team with the tools and defenses needed to operate securely.',
  ERASE: 'To permanently remove data; secure erase overwrites storage to prevent forensic recovery.',
  ESSAY: 'A written analysis of a vulnerability, threat, or security topic presented as research.',
  EVENT: 'A security event is any observable occurrence in a system or network relevant to security monitoring.',
  EVERY: 'Every endpoint must be monitored to close gaps in visibility and ensure comprehensive coverage.',
  EXACT: 'Precise matching; exact string comparison prevents partial-match bypasses in access control checks.',
  EXCEL: 'A spreadsheet application; malicious Excel macros are a common malware delivery method.',
  EXIST: 'Checking whether a file or resource exists can reveal information about system state to an attacker.',
  EXPEL: 'To remove an attacker or unauthorized user from a system during or after incident response.',
  EXTRA: 'Unnecessary permissions beyond what is needed violate the principle of least privilege.',
  FABLE: 'A fabricated or fictional story; security fables warn of threats that may not be fully accurate.',
  FAINT: 'A deceptive maneuver; a faint attack distracts defenders while the real attack occurs elsewhere.',
  FAITH: 'Blind faith in vendors or partners is a risk without supply chain security verification.',
  FANCY: 'APT28 / Fancy Bear — a Russian state-sponsored threat actor known for large espionage campaigns.',
  FATAL: 'A critical error that causes immediate program termination, sometimes exploitable for denial of service.',
  FAVOR: 'Threat actors seek favors from insiders through bribery or social engineering to gain access.',
  FEAST: 'Attackers feast on poorly secured databases, harvesting credentials and sensitive data at scale.',
  FENCE: 'A boundary or perimeter control; fencing off sensitive systems limits attacker lateral movement.',
  FEVER: 'Alert fever refers to an overwhelming volume of security alerts that causes analysts to miss real threats.',
  FIBER: 'Optical fiber cable used for high-speed networking; fiber tapping is a physical interception technique.',
  FIGHT: 'Active defense — taking offensive countermeasures to disrupt or counter an attacker\'s operations.',
  FINAL: 'The last stage of validation; a final review before deployment catches last-minute security flaws.',
  FIRST: 'First access is achieved through phishing, exploitation, or credential theft to begin an attack.',
  FIXED: 'A patched or resolved vulnerability; a fixed CVE has a published remediation available.',
  FLAME: 'A highly sophisticated state-sponsored malware platform discovered in 2012 targeting Middle Eastern systems.',
  FLANK: 'To attack from an unexpected direction; flanking bypasses the primary perimeter defenses.',
  FLASH: 'Flash memory used in firmware; unsigned flash updates can install persistent malicious firmware.',
  FLASK: 'A lightweight Python web framework; Flask apps without security middleware are prone to injection.',
  FLEET: 'A large group of managed systems; fleet management tools must be secured against supply chain attacks.',
  FLESH: 'The human element; people are the most exploitable layer and the primary target of social engineering.',
  FLICK: 'A rapid switch or toggle; flicking a feature flag can enable or disable security controls instantly.',
  FLING: 'To transmit data rapidly; attackers fling large volumes of stolen data out of a network quickly.',
  FLINT: 'A small trigger that starts a larger attack chain, like a malicious macro that downloads a payload.',
  FLOAT: 'A floating-point number; floating-point precision errors can cause logic flaws in security checks.',
  FLOCK: 'A group of devices or agents; a flock of bots forms a botnet used for DDoS and spam campaigns.',
  FLOOR: 'The minimum security baseline all systems must meet; anything below the floor is unacceptable risk.',
  FLUID: 'Adaptable and changing; fluid attack techniques evolve to bypass static signatures and fixed rules.',
  FLUSH: 'To clear a cache or buffer; incomplete flushes can leave sensitive data accessible in memory.',
  FLUTE: 'A covert tunnel used to route traffic through a firewall, bypassing network inspection.',
  FOCAL: 'The primary point of focus; the focal target of an attack is the highest-value asset being pursued.',
  FOCUS: 'Concentrated attention; threat actors focus resources on high-value targets with weak defenses.',
  FORCE: 'To override security controls; brute force systematically tries all possible inputs to gain access.',
  FORTH: 'Moving forward; a set-forth recovery plan in incident response defines remediation steps.',
  FORTY: 'WEP\'s 40-bit encryption (RFC 4772) is considered insecure and long since deprecated.',
  FORUM: 'An online community; underground forums are marketplaces where attackers trade tools and stolen data.',
  FOUND: 'A found vulnerability is one identified through testing, research, or bug bounty programs.',
  FRAUD: 'Deception for financial gain; cyber fraud includes phishing, account takeover, and card skimming.',
  FRESH: 'New or uncompromised; a fresh instance is a clean system free of prior configuration or infection.',
  FRONT: 'A front company or domain is used to disguise malicious infrastructure and hide attacker identity.',
  FROST: 'A stealthy persistence mechanism; frost-level implants survive reboots and remain cold to scanners.',
  FROZE: 'A suspended or frozen process or account is temporarily disabled, preventing further action.',
  FRUIT: 'The outcome or payload of an attack; attackers harvest the fruit of months of patient persistence.',
  FULLY: 'Completely; a fully patched system has all known vulnerabilities remediated with available updates.',
  FUNDS: 'Money; threat actors seek funds through ransomware, financial fraud, and cryptocurrency theft.',
  FUNNY: 'Anomalous or suspicious; a funny log entry that doesn\'t fit normal patterns warrants investigation.',
  GAMER: 'Gamers are targeted by credential stealers and malware embedded in pirated games and cheat software.',
  GAUGE: 'Security teams gauge risk by combining likelihood and impact assessments into a risk score.',
  GAVEL: 'A court gavel; security incidents that reach legal proceedings require careful forensic evidence.',
  GENIE: 'A genie metaphor describes unintended AI or automation behavior that escapes intended constraints.',
  GENRE: 'A category or type; malware genres include ransomware, spyware, adware, and trojans.',
  GIANT: 'A large organization; giants are high-profile attack targets but also have large security teams.',
  GLAND: 'A data gland is a leak point from which sensitive information unintentionally escapes a system.',
  GLARE: 'Operating under the glare of public scrutiny forces threat actors to use stealthier techniques.',
  GLASS: 'A glass-box (white-box) test gives the penetration tester full knowledge of the system\'s internals.',
  GLEAM: 'A faint signal or anomaly in logs that, on closer inspection, reveals the presence of an attacker.',
};

export function getDefinition(word: string): string | null {
  return DEFINITIONS[word.toUpperCase()] ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/lib/wordle.test.ts
```

Expected: all tests PASS including the three new `getDefinition` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wordle.ts src/lib/wordle.test.ts
git commit -m "feat: add word definitions and getDefinition() to wordle.ts"
```

---

### Task 2: Add definition card UI to wordle.astro

**Files:**
- Modify: `src/pages/wordle.astro`

**Interfaces:**
- Consumes: `getDefinition(word: string): string | null` from `../lib/wordle`

- [ ] **Step 1: Add getDefinition to the import in wordle.astro**

In `src/pages/wordle.astro`, find the import line:

```typescript
import {
  evaluateGuess, isValidGuess, loadState, saveState,
  getDailyWord, dayIndex, buildShareText, todayStr,
  type GuessResult, type WordleState,
} from '../lib/wordle';
```

Replace it with:

```typescript
import {
  evaluateGuess, isValidGuess, loadState, saveState,
  getDailyWord, dayIndex, buildShareText, todayStr,
  getDefinition, type GuessResult, type WordleState,
} from '../lib/wordle';
```

- [ ] **Step 2: Add the definition card element to the HTML**

In `src/pages/wordle.astro`, find the `<div class="wl-msg" ...>` element:

```html
<div class="wl-msg" id="msg" role="status" aria-live="polite"></div>
```

Add the definition card immediately after it:

```html
<div class="wl-msg" id="msg" role="status" aria-live="polite"></div>

<div class="wl-definition" id="definition" hidden>
  <strong class="wl-def-word"></strong>
  <span class="wl-def-text"></span>
</div>
```

- [ ] **Step 3: Add showDefinition() function and call it from finishGame()**

In the `<script>` block, find the `finishGame` function:

```typescript
function finishGame(won: boolean): void {
  if (won) {
    setMsg(`çözüldü — ${state.guesses.length}/6 🎉`);
  } else {
    setMsg(`kaybettin — kelime: ${target}`);
  }
  renderStreak();
  shareBtn.hidden = false;
}
```

Replace it with:

```typescript
function showDefinition(): void {
  const def = getDefinition(target);
  if (!def) return;
  const el = document.getElementById('definition')!;
  el.querySelector('.wl-def-word')!.textContent = target;
  el.querySelector('.wl-def-text')!.textContent = def;
  el.hidden = false;
}

function finishGame(won: boolean): void {
  if (won) {
    setMsg(`çözüldü — ${state.guesses.length}/6 🎉`);
  } else {
    setMsg(`kaybettin — kelime: ${target}`);
  }
  renderStreak();
  shareBtn.hidden = false;
  showDefinition();
}
```

- [ ] **Step 4: Add CSS for the definition card**

In the `<style>` block, find the `.wl-msg` rule:

```css
.wl-msg {
  min-height: 1.4rem;
  color: var(--fg-bright);
  text-align: center;
}
```

Add the following immediately after it:

```css
.wl-definition {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border: 1px solid var(--fg-muted);
  padding: 0.75rem 1.25rem;
  max-width: 28rem;
  width: 100%;
}

.wl-def-word {
  color: var(--fg-bright);
  font-size: 1rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.wl-def-text {
  color: var(--fg-dim);
  font-size: 0.85rem;
  line-height: 1.5;
}
```

- [ ] **Step 5: Verify in the browser**

Run the dev server:

```
npm run dev
```

Open `http://localhost:4321/wordle`. Play a game to completion (win or lose). The definition card should appear below the result message with the word in bright text and the definition in dimmer text. Test that a restored finished game (reload the page after completing) also shows the definition.

- [ ] **Step 6: Commit**

```bash
git add src/pages/wordle.astro
git commit -m "feat: show word definition card after wordle game ends"
```

---

## Self-Review

**Spec coverage:**
- Definition for all 365 words ✓ (Task 1, DEFINITIONS object)
- `getDefinition` exported ✓ (Task 1)
- Card shown on win and loss ✓ (Task 2, `finishGame` calls `showDefinition`)
- Restored games show definition ✓ (`restore()` calls `finishGame()` which calls `showDefinition()`)
- No external API calls ✓ (all definitions hardcoded)
- Styling uses CSS custom properties ✓

**Placeholder scan:** No TBDs, no "implement later", no "similar to" references. All code blocks are complete.

**Type consistency:** `getDefinition(word: string): string | null` — defined in Task 1, consumed in Task 2 as `getDefinition(target)` where `target` is already typed as `string`.
