# Blog Article Series: Linux Internals & NAT

**Date:** 2026-08-05  
**Blog:** matrix-303.pages.dev  
**Style:** Prose-heavy, no code blocks, bold key terms on first mention, cross-references between articles, ~1500–2000 words each, "How X Works" / "Linux X" naming pattern

---

## Overview

Three new articles extending two existing clusters:

- **Linux cluster:** `the-architecture-of-linux` → `linux-file-permissions` → **[new]** `linux-processes-and-signals` → **[new]** `linux-users-and-groups`
- **Networking cluster:** `how-tcp-ip-works` → **[new]** `how-nat-works`

---

## Article 1: Linux Processes & Signals

**File:** `src/content/posts/linux-processes-and-signals.md`  
**Connects from:** `the-architecture-of-linux` (architecture introduced the kernel; this shows how it manages running programs)  
**Connects to:** `linux-users-and-groups` (processes run as users — forward reference at close)

### Structure

1. **What is a process?** The kernel's view: a program in memory with state. PCB (Process Control Block), PID. Distinction between a program (file on disk) and a process (running instance).

2. **Process lifecycle — fork and exec.** Every process comes from another: `fork()` copies the parent, `exec()` replaces the image. Why this two-step design. The `wait()` call — how a parent collects an exit status.

3. **The process tree.** `init`/`systemd` as PID 1, root of all processes. Everything else is a descendant. What this means for orphan adoption.

4. **Signals.** What a signal is: an asynchronous notification sent to a process. How the kernel delivers it. The two destinations: the process's signal handler, or the default action.

5. **Common signals and their meanings.**
   - `SIGTERM` (15): polite shutdown request — the process can catch and clean up
   - `SIGKILL` (9): unconditional kill — cannot be caught, blocked, or ignored; why it's the last resort
   - `SIGINT` (2): what Ctrl-C actually sends
   - `SIGHUP` (1): terminal hangup, conventionally used to reload config
   - `SIGSEGV`, `SIGFPE`: kernel-generated on invalid memory access / arithmetic error

6. **What can go wrong — zombie and orphan processes.**
   - **Zombie:** a process that has exited but whose parent never called `wait()` — it lingers in the process table consuming a PID
   - **Orphan:** a process whose parent exits first — adopted by PID 1, which calls `wait()` on its behalf

**Closing paragraph:** Forward reference — every process runs under a user identity. That's what the next article is about.

---

## Article 2: Linux Users & Groups

**File:** `src/content/posts/linux-users-and-groups.md`  
**Connects from:** `linux-file-permissions` (permission bits reference users/groups — the "who" was left implicit) and `linux-processes-and-signals` (processes run as a user)  
**Connects to:** `intro-to-cybersecurity` (privilege escalation as a security concept)

### Structure

1. **Users are numbers.** UID and GID. The username is a convenience; the kernel only works with numbers. `root` is UID 0 — not a name, a number with special meaning.

2. **Where users live.** `/etc/passwd` — the public record: username, UID, GID, home, shell. `/etc/shadow` — the private record: the actual password hash, and why it's separate (world-readable vs root-only).

3. **Groups.** Why groups exist: sharing access among multiple users without giving everyone the same UID. Primary group vs supplementary groups. `/etc/group`.

4. **sudo — not the same as being root.** `sudo` runs one command with elevated privilege. `/etc/sudoers` controls who may run what. Why this is better than logging in as root: audit trail, least privilege, the command is explicit.

5. **Real vs effective UID.** A process has both. `sudo` changes the effective UID without changing the real one. The kernel checks the effective UID for permission decisions.

6. **The setuid bit revisited.** Introduced in `linux-file-permissions` — here it gets its full explanation. When a setuid executable runs, the process's effective UID becomes the file owner's UID, not the caller's. How `passwd` can write to `/etc/shadow` even though you're not root.

7. **What can go wrong — privilege escalation.** A setuid binary with a vulnerability lets an attacker run arbitrary code as its owner (often root). Misconfigured `sudoers` rules grant too much. Writable files in a root-owned path. The common thread: anywhere the effective UID is elevated, a bug becomes a root hole.

**Closing paragraph:** Tie back to the security cluster — `intro-to-cybersecurity` named privilege escalation as a goal of attackers; this is the mechanism they target.

---

## Article 3: How NAT Works

**File:** `src/content/posts/how-nat-works.md`  
**Connects from:** `how-tcp-ip-works` (introduced IP addresses and ports — NAT manipulates both)  
**Connects to:** none yet (natural future: IPv6 as the long-term answer to the problem NAT solves)

### Structure

1. **The problem NAT solves.** IPv4 has ~4.3 billion addresses. The internet has more devices than that. In the 1990s this was a crisis. NAT is the workaround that bought the internet another thirty years.

2. **Private address ranges.** RFC 1918 reserved three blocks — `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` — that are never routed on the public internet. Every home network uses one. Why your router has two IP addresses: one private (facing your devices), one public (facing the internet).

3. **How NAT translates.** The router maintains a **translation table**: when a packet leaves your network, the router rewrites the source IP (and source port) and records the mapping. When a reply arrives, it looks up the mapping, rewrites the destination back to the original private IP and port, and forwards it inward.

4. **PAT — Port Address Translation.** The common form of NAT. One public IP, thousands of simultaneous connections, distinguished by port number. Your laptop on port 51234, your phone on port 51235 — both appear to the internet as the same public IP but different ports. The translation table keeps them separate.

5. **Connection tracking.** NAT is stateful: the router must remember every active mapping. What happens when a TCP connection closes: the entry is removed. What happens with UDP (which has no close): entries expire by timeout.

6. **What NAT breaks — the traversal problem.** NAT works well for outbound connections. Inbound connections fail: an incoming packet arrives at your router with a private IP as its destination, but the router has no translation table entry for an unsolicited packet. This is why you can't host a server at home without port forwarding configured explicitly. It's also why peer-to-peer applications (video calls, torrents, game matchmaking) require techniques like STUN and hole-punching to establish direct connections through NAT.

**Closing paragraph:** NAT is a workaround, not a solution. IPv6 gives every device a globally routable address and makes NAT unnecessary — but decades of NAT-dependent infrastructure mean the workaround is now load-bearing.

---

## Cross-Reference Map

| Article | References inward | References outward |
|---|---|---|
| linux-processes-and-signals | the-architecture-of-linux | linux-users-and-groups |
| linux-users-and-groups | linux-file-permissions, linux-processes-and-signals | intro-to-cybersecurity |
| how-nat-works | how-tcp-ip-works | (IPv6, future) |

---

## Writing Constraints

- No code blocks, no command listings — prose only
- Bold on first use of key terms
- Each article ends with a forward reference or reflective close
- Terminal command cross-references only where they already exist in the blog (e.g. `ports` command)
- Target length: 1500–2000 words per article
