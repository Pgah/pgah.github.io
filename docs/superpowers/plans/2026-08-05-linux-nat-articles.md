# Linux Internals & NAT Article Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write three blog articles — Linux Processes & Signals, Linux Users & Groups, How NAT Works — that extend existing clusters and cross-reference each other.

**Architecture:** Each article is a standalone Markdown file in `src/content/posts/`. Articles are prose-only (no code blocks), use bold for key terms on first mention, and end with a forward reference to the next article. The three articles form two chains: Linux arch → processes → users/groups, and TCP/IP → NAT.

**Tech Stack:** Astro v6, Markdown (`src/content/posts/`), static output to Cloudflare Pages.

## Global Constraints

- No code blocks, no command listings — prose only
- Bold every key term on its **first** mention, not subsequent mentions
- Each article ends with a forward-looking or reflective closing paragraph
- Cross-reference existing articles by concept, not by file name (e.g. "The TCP/IP article showed…")
- Target length: 1500–2000 words per article
- Frontmatter: `title`, `date: 2026-08-05`, `description` (one compelling sentence), `tags` (array)
- File naming: `src/content/posts/<slug>.md` — slugs below
- Do not add comments to Markdown files

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `src/content/posts/linux-processes-and-signals.md` | Create | Article 1 |
| `src/content/posts/linux-users-and-groups.md` | Create | Article 2 |
| `src/content/posts/how-nat-works.md` | Create | Article 3 |

---

## Task 1: Linux Processes & Signals

**Files:**
- Create: `src/content/posts/linux-processes-and-signals.md`

**Interfaces:**
- Consumes: concepts from `src/content/posts/the-architecture-of-linux.md` (kernel, system calls)
- Produces: concepts used by Task 2 (process runs as a user — forward reference)

### Frontmatter

```markdown
---
title: "Linux Processes and Signals"
date: 2026-08-05
description: "A program sitting on disk does nothing. A process is what the kernel creates when it decides to run one — and signals are how the system talks to it while it does."
tags: ["linux", "processes", "signals", "fundamentals"]
---
```

### Sections and required content

**Opening paragraph (no heading):** Distinguish a program (inert file on disk) from a process (the kernel's running instance of it). A program can have zero, one, or many processes running simultaneously. This distinction is what the whole article hangs on.

**## What a Process Actually Is**
- The kernel tracks every running process in a **Process Control Block (PCB)** — an internal data structure holding its state: memory mappings, open file descriptors, CPU register snapshot, scheduling information.
- Every process has a **PID** (Process ID), a unique integer the kernel assigns at creation. PID 1 is special (see below).
- A process is either running, waiting (for I/O or a signal), or stopped. The kernel scheduler decides who runs next.

**## Fork and Exec: How Processes Are Born**
- Every process except PID 1 comes from another process. There is no other way.
- **`fork()`** copies the calling process exactly: same memory, same file descriptors, same everything. The copy is the **child**; the original is the **parent**. After `fork()`, two processes are running the same code at the same point.
- **`exec()`** replaces the current process's memory image with a new program loaded from disk. The PID stays the same; everything else is overwritten. `fork()` then `exec()` together is the standard way to launch a new program: fork a copy, then replace the copy with the program you actually want.
- **`wait()`** is how a parent collects its child's exit status. When a child exits, it doesn't fully disappear — it waits in a half-dead state until the parent calls `wait()`. This handoff is what lets the parent know whether the child succeeded.

**## The Process Tree**
- `init` (or its modern replacement, **`systemd`**) runs as PID 1. It's the first process the kernel starts after boot. Everything else descends from it.
- Every process has a parent (**PPID**). This forms a tree. You can walk it from any process up to PID 1.
- When a parent dies before its children, those children become **orphans**. The kernel automatically re-parents them to PID 1, which is why `systemd` is designed to call `wait()` on everything. No orphan is truly abandoned.

**## Signals: Talking to a Running Process**
- A **signal** is an asynchronous notification sent to a process. It interrupts whatever the process is doing and delivers a small integer — the signal number.
- The kernel delivers signals on the process's behalf. The sender can be the kernel itself (for illegal operations), a terminal, or another process with permission.
- A process can install a **signal handler** — a function that runs when a specific signal arrives. For most signals, if no handler is installed, the kernel falls back to a default action (usually termination).
- Two signals cannot be handled, blocked, or ignored: **SIGKILL** and **SIGSTOP**. The kernel handles them directly, bypassing any handler the process installed.

**## Common Signals and What They Mean**
- **`SIGTERM` (15):** A request to terminate. The process receives it and can catch it — clean up open files, flush buffers, release locks, exit gracefully. This is the right first move when you want a process to stop.
- **`SIGKILL` (9):** Unconditional termination. The kernel kills the process immediately, no handler runs, no cleanup happens. Use this only when `SIGTERM` didn't work — you may leave files half-written or locks unreleased.
- **`SIGINT` (2):** What Ctrl-C sends. Identical in effect to `SIGTERM` for most programs, but semantically "the user interrupted this."
- **`SIGHUP` (1):** Originally "terminal hangup" — the signal sent when the controlling terminal disconnects. Servers conventionally treat it as "reload your configuration without restarting."
- **`SIGSEGV`:** The kernel sends this when a process accesses memory it isn't allowed to. The default action is a crash — this is what "segmentation fault" means.

**## What Can Go Wrong: Zombies**
- A **zombie process** is one that has exited but whose parent has never called `wait()`. The process is dead — it runs nothing, uses no CPU — but its PCB entry stays in the process table, holding its PID and exit status, waiting for the parent to collect them.
- A handful of zombies is harmless. Thousands of them exhaust the PID namespace: no new processes can be created.
- The fix is a parent that calls `wait()` correctly, or a parent that dies so PID 1 adopts and reaps the zombies.

**Closing paragraph:** Processes don't run in a vacuum — every process runs under an identity: a user. That identity determines what files it can open, what signals it can send to other processes, what it's allowed to do. That's what the next article is about.

### Steps

- [ ] **Step 1: Create the file with frontmatter and opening paragraph**

Write `src/content/posts/linux-processes-and-signals.md` with the frontmatter and opening paragraph only.

- [ ] **Step 2: Write sections What a Process Actually Is → The Process Tree**

Add the first three `##` sections following the content requirements above.

- [ ] **Step 3: Write sections Signals → Common Signals → Zombies → Closing**

Add the remaining sections and the closing paragraph.

- [ ] **Step 4: Verify word count is 1500–2000 words**

Count words. Expand thin sections if under 1500; trim repetition if over 2000.

- [ ] **Step 5: Verify cross-references are present**

The article must reference the Linux architecture article by concept at least once (e.g. "As the architecture article showed, the kernel sits between…"). The closing paragraph must forward-reference Linux users and groups.

- [ ] **Step 6: Commit**

```bash
git add src/content/posts/linux-processes-and-signals.md
git commit -m "feat: linux processes ve signals makalesi"
```

---

## Task 2: Linux Users & Groups

**Files:**
- Create: `src/content/posts/linux-users-and-groups.md`

**Interfaces:**
- Consumes: concepts from Task 1 (process has a UID), `src/content/posts/linux-file-permissions.md` (permission bits, setuid bit mentioned)
- Produces: concepts referenced by `intro-to-cybersecurity` (privilege escalation mechanism)

### Frontmatter

```markdown
---
title: "Linux Users and Groups"
date: 2026-08-05
description: "The permission bits on a file say who can read it. But 'who' in Linux is a number — and the rules for how that number can change while a program runs are where most privilege escalation lives."
tags: ["linux", "users", "permissions", "security", "fundamentals"]
---
```

### Sections and required content

**Opening paragraph (no heading):** The file permissions article established that every file has an owner and a group, and that the permission bits decide what the owner, the group, and everyone else can do. It left one question implicit: what exactly is a user? Not a name — a number.

**## Users Are Numbers**
- The kernel doesn't know usernames. It works with **UIDs** (User IDs) and **GIDs** (Group IDs) — unsigned integers.
- `root` is UID 0. That's it. The name "root" is a convention; the special power comes from the zero, not the name.
- Every file, every process, every socket has an owner expressed as a UID. The kernel compares numbers when checking permissions.

**## /etc/passwd and /etc/shadow**
- **`/etc/passwd`** is the public record: one line per user, colon-separated fields: username, placeholder, UID, GID, comment, home directory, shell. It's world-readable — any user can look up anyone else's UID.
- Passwords are not in `/etc/passwd`. They're in **`/etc/shadow`**, readable only by root. Each line holds the username and the **hashed** password (the actual password is never stored). The hash is the input to a one-way function; authentication works by hashing the input and comparing.
- The split exists because UID lookups need to be world-readable, but password hashes must not be.
- **`/etc/group`** maps group names to GIDs and lists their members.

**## Groups: Shared Access Without Shared Identity**
- A **group** lets multiple users share access to a resource without giving them the same UID.
- Every process has a **primary group** (set at login from `/etc/passwd`) and may have **supplementary groups** (listed in `/etc/group`). The kernel checks all of them when evaluating group permissions.
- A file owned by group `developers` with group-read permission is readable by anyone whose supplementary groups include `developers` — without those users sharing an owner.

**## sudo: Elevated Privilege Without Being Root**
- `sudo` runs one command with a different effective identity — usually root's. It's not "become root"; it's "run this one thing as root, then go back to being yourself."
- **`/etc/sudoers`** (edited via `visudo`) controls the rules: which users may run which commands as which identities. A well-written sudoers file grants the minimum necessary — a backup user who can run only the backup script as root, nothing else.
- Why not just log in as root? Because every command you run as root is equally dangerous. `sudo` creates an **audit trail** (it logs every invocation), requires you to state the command explicitly, and limits the blast radius of a mistake.

**## Real UID vs Effective UID**
- Every process carries two user identities: the **real UID** (who started the process — doesn't change) and the **effective UID** (what the kernel checks for permission decisions — can change).
- When you run `sudo somecommand`, the shell's real UID is still yours. The child process running `somecommand` has an effective UID of 0. The kernel sees root; you remain yourself.
- This distinction is why privilege separation is possible at all: a process can operate with elevated permissions for part of its work and drop back to a lower effective UID for the rest.

**## The Setuid Bit**
- The file permissions article introduced the **setuid bit** as a special permission flag. Here's what it actually does: when a setuid executable runs, the kernel sets the process's effective UID to the **file's owner**, not the caller's UID.
- The standard example: `passwd` is owned by root and has the setuid bit set. When you run it, your process's effective UID becomes 0 — root. That's the only reason `passwd` can write your new password hash to `/etc/shadow`, which is root-readable-only.
- The kernel enforces this. No special code in `passwd` is needed to claim root; the bit in the inode does it automatically at exec time.

**## What Can Go Wrong: Privilege Escalation**
- **Setuid vulnerabilities:** A setuid binary owned by root that has a bug — a buffer overflow, an unchecked input — gives an attacker code execution with root's effective UID. This is one of the most reliable paths to full system compromise.
- **Sudoers misconfiguration:** `ALL=(ALL) NOPASSWD: ALL` grants unconditional root to a user. More subtle: allowing `sudo vim` lets the user drop to a root shell from inside vim. Any command that can spawn a shell is effectively full root access.
- **Writable files in root-owned paths:** If a root-owned script sources a file you can write, you control what root runs. The setuid bit and `sudo` protect the entry point, but what the elevated process reads and executes matters just as much.
- The common thread: anywhere effective UID rises, any reachable vulnerability becomes a root hole. Minimizing setuid binaries and tightening sudoers rules are the two most direct mitigations.

**Closing paragraph:** The intro to cybersecurity article named privilege escalation as a primary attacker goal. This is the mechanism: find a path from your UID to effective UID 0 — through a setuid bug, a misconfigured sudo rule, or a writable file that root will execute. Knowing the mechanism is the first step to defending against it.

### Steps

- [ ] **Step 1: Create the file with frontmatter and opening paragraph**

Write `src/content/posts/linux-users-and-groups.md` with the frontmatter and opening paragraph only.

- [ ] **Step 2: Write sections Users Are Numbers → /etc/passwd → Groups**

Add the first three `##` sections.

- [ ] **Step 3: Write sections sudo → Real vs Effective UID → Setuid → Privilege Escalation → Closing**

Add the remaining sections and closing paragraph.

- [ ] **Step 4: Verify word count is 1500–2000 words**

Count words. Expand thin sections if under 1500; trim repetition if over 2000.

- [ ] **Step 5: Verify cross-references**

Must reference `linux-file-permissions` article by concept (setuid bit introduced there). Must reference `linux-processes-and-signals` by concept (effective UID of a process). Closing must reference `intro-to-cybersecurity`.

- [ ] **Step 6: Commit**

```bash
git add src/content/posts/linux-users-and-groups.md
git commit -m "feat: linux users ve groups makalesi"
```

---

## Task 3: How NAT Works

**Files:**
- Create: `src/content/posts/how-nat-works.md`

**Interfaces:**
- Consumes: concepts from `src/content/posts/how-tcp-ip-works.md` (IP addresses, ports, four-tuple socket)
- Produces: none (terminal article in networking cluster for now)

### Frontmatter

```markdown
---
title: "How NAT Works"
date: 2026-08-05
description: "IPv4 has around four billion addresses. The internet has more devices than that. NAT is the workaround that bought the internet thirty years — and it shapes every connection you make from home."
tags: ["nat", "networking", "ip", "fundamentals"]
---
```

### Sections and required content

**Opening paragraph (no heading):** The TCP/IP article established that every device on a network needs an IP address, and that a connection is uniquely identified by a four-tuple: source IP, source port, destination IP, destination port. That's true. But there's a problem: there aren't enough IP addresses for every device to have one.

**## The Address Exhaustion Problem**
- IPv4 addresses are 32 bits: ~4.3 billion unique values. IANA, the body that allocates them, exhausted its pool in 2011. Regional registries have been in various states of exhaustion since 2012.
- The internet kept growing anyway. The workaround is **Network Address Translation (NAT)** — a technique that lets many devices share a single public IP address.

**## Private Address Space**
- **RFC 1918** reserved three address ranges that are never routed on the public internet:
  - `10.0.0.0 – 10.255.255.255`
  - `172.16.0.0 – 172.31.255.255`
  - `192.168.0.0 – 192.168.255.255`
- These are the addresses you see inside homes, offices, and data centers. They're valid on private networks, invisible to the internet.
- Your home router has two IP addresses: one private (facing your devices, e.g. `192.168.1.1`) and one public (assigned by your ISP, facing the internet). The router is the boundary where NAT happens.

**## How NAT Translates a Packet**
- When your laptop (`192.168.1.5:51234`) sends a packet to a web server (`1.2.3.4:443`), the packet reaches your router. The router rewrites the source address: it replaces `192.168.1.5:51234` with its own public IP and a chosen port, say `203.0.113.1:40001`.
- The router records this mapping in its **NAT translation table**: `203.0.113.1:40001 ↔ 192.168.1.5:51234`.
- The web server sees the packet as coming from `203.0.113.1:40001`. When it replies, it sends to `203.0.113.1:40001`. The router receives the reply, looks up the translation table, rewrites the destination to `192.168.1.5:51234`, and forwards it to your laptop.
- Your laptop and the web server never know the other's real address. The router is the invisible intermediary.

**## PAT: One IP, Thousands of Connections**
- The form of NAT in home routers is more precisely called **PAT** (Port Address Translation) or **NAPT** — "many-to-one" NAT.
- Because a connection is distinguished by the four-tuple, the router can multiplex thousands of private connections through one public IP by assigning each a different source port on the public side. Your laptop on port 51234, your phone on port 51235, your TV on port 51236 — all appear to the internet as `203.0.113.1` but on different ports.
- The translation table maps each public-side port back to the correct private device and port. The router is running a stateful port-mapping service for every device on the network.

**## Connection Tracking**
- NAT is **stateful**: the router must remember every active mapping. For TCP connections, it can track the state (SYN, established, FIN) and remove entries when connections close cleanly.
- UDP has no connection concept — there's no handshake and no close. The router handles UDP by **timeout**: if no packet matching an entry arrives for a period (commonly 30–120 seconds), the entry is removed.
- This statefulness is why NAT routers have a memory limit on simultaneous connections. A home router tracking 10,000 simultaneous connections is doing real work.

**## What NAT Breaks: The Traversal Problem**
- NAT works well for **outbound** connections: your device initiates, the router creates a table entry, replies flow back.
- **Inbound** connections fail by default. If someone outside tries to connect to `203.0.113.1:80`, the router receives the packet but has no translation table entry for it — no outbound connection created one. It drops the packet. Your laptop is effectively invisible from the internet.
- This is why hosting anything at home requires **port forwarding**: a manually configured rule that says "incoming packets to public port 80 should be forwarded to `192.168.1.5:80` regardless of whether an outbound connection exists."
- Peer-to-peer connections — video calls, game matchmaking, file sharing — are harder. Both parties are behind NAT; neither can accept unsolicited inbound packets. The workaround is **STUN** (Session Traversal Utilities for NAT): both parties connect outward to a server, which tells each one the other's public IP and port. Then they try **hole-punching**: each sends a packet to the other's public address simultaneously, hoping the other's router creates a table entry before the packet arrives, allowing the reply through. It works most of the time and fails interestingly when it doesn't.

**## Double NAT**
- Many ISPs now place their own NAT between the internet and your router, creating **double NAT**: your device is behind your router's NAT, which is itself behind the ISP's NAT.
- Port forwarding on your router has no effect because the ISP's NAT still drops unsolicited inbound traffic at the outer layer. This is why CGNAT (Carrier-Grade NAT) frustrates anyone trying to self-host.

**Closing paragraph:** NAT is a workaround that became infrastructure. It solved an immediate crisis and in doing so shaped the internet's architecture for decades: servers became easy to reach, clients became invisible, and peer-to-peer became a hard problem requiring dedicated protocols to solve. The actual solution — **IPv6**, with a large enough address space to give every device a globally routable address — has existed since 1998 and makes NAT unnecessary. The workaround is still load-bearing.

### Steps

- [ ] **Step 1: Create the file with frontmatter and opening paragraph**

Write `src/content/posts/how-nat-works.md` with the frontmatter and opening paragraph only.

- [ ] **Step 2: Write sections Address Exhaustion → Private Address Space → How NAT Translates**

Add the first three `##` sections.

- [ ] **Step 3: Write sections PAT → Connection Tracking → Traversal Problem → Double NAT → Closing**

Add the remaining sections and closing paragraph.

- [ ] **Step 4: Verify word count is 1500–2000 words**

Count words. Expand thin sections if under 1500; trim repetition if over 2000.

- [ ] **Step 5: Verify cross-references**

Must reference the TCP/IP article by concept at least once (IP addresses, ports, four-tuple). IPv6 must be mentioned in the closing paragraph.

- [ ] **Step 6: Commit**

```bash
git add src/content/posts/how-nat-works.md
git commit -m "feat: how nat works makalesi"
```
