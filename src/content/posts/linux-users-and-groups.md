---
title: "Linux Users and Groups"
date: 2026-08-05
description: "The permission bits on a file say who can read it. But 'who' in Linux is a number — and the rules for how that number can change while a program runs are where most privilege escalation lives."
tags: ["linux", "users", "permissions", "security", "fundamentals"]
---

The file permissions article established that every file has an owner and a group, and that the permission bits decide what the owner, the group, and everyone else can do. It left one question implicit: what exactly is a user? Not a name — a number. The kernel doesn't operate on the string "alice"; it operates on an integer. That distinction matters more than it might seem.

## Users Are Numbers

The kernel doesn't know usernames. It works with **UIDs** (User IDs) and **GIDs** (Group IDs) — unsigned integers assigned to every user and group on the system. When the kernel checks whether you can read a file, it compares your UID against the file's owner UID and your GIDs against the file's group GID. Names don't enter into it.

**`root`** is UID 0. That's the whole of root's special status. The name "root" is a convention maintained by tools that display it; the actual power comes from the zero. Any process running with effective UID 0 has root's privileges regardless of what name it was invoked under. Any user account given UID 0 in the system database has root's privileges whether it's called "root" or anything else.

Every file, every process, every socket has an owner expressed as a UID. UIDs are system-local — UID 1000 on one machine has no relationship to UID 1000 on another machine, which matters when files cross systems via NFS or shared storage.

## /etc/passwd and /etc/shadow

**`/etc/passwd`** is the public record of users on the system. One line per user, seven colon-separated fields: username, password placeholder, UID, primary GID, a comment field (often the user's full name), home directory, and login shell. It's world-readable — any user on the system can open it and look up anyone else's UID and home directory.

The password field in `/etc/passwd` is almost always an `x`. Passwords aren't stored there. They live in **`/etc/shadow`**, which is readable only by root (and on some systems, by a dedicated `shadow` group). Each line in `/etc/shadow` holds the username and the **hashed** password — the result of running the password through a one-way cryptographic function. The actual password is never stored anywhere. Authentication works by hashing whatever was typed and comparing the result against the stored hash. If they match, the password is correct.

The split exists because of a simple tension: UID lookups need to be world-readable so that tools like `ls` can display file owners by name, but password hashes must not be public. On systems old enough to have stored hashes in `/etc/passwd`, any user could run an offline dictionary attack against every account on the machine.

**`/etc/group`** maps group names to GIDs and lists their members. It's also world-readable, for the same reason `/etc/passwd` is.

## Groups: Shared Access Without Shared Identity

A **group** provides a way to give multiple users shared access to a resource without merging their identities. Rather than making a file world-readable or giving every developer the same account, you create a group, add the relevant users, and set the file's group ownership and group-read bit.

Every process has a **primary group**, set at login from the GID field in `/etc/passwd`. It may also have **supplementary groups** — additional group memberships listed in `/etc/group`. The kernel checks all of them when evaluating group permissions. A file owned by group `developers` with group-read permission is accessible to any process whose supplementary group list includes the `developers` GID, regardless of what their UID is.

Groups are also how services are isolated. A web server process that runs as user `www-data` in group `www-data` can be granted access to configuration files by adding `www-data` to the appropriate group — without giving it any broader privilege.

## sudo: Elevated Privilege Without Being Root

**`sudo`** runs a single command with a different effective identity, typically root's. It doesn't make you root; it runs one specific invocation as root and then returns your process to its original identity. The distinction matters because it makes every privileged action explicit, logged, and bounded.

**`/etc/sudoers`** controls which users may run which commands as which identities. It should always be edited through **`visudo`**, which validates the syntax before writing the file — a syntax error in sudoers can lock everyone out of sudo, including root, requiring recovery from a live environment. A well-configured sudoers file follows the principle of least privilege: a backup operator can run only the backup script as root, nothing else. A deployment user can restart a specific service. No one is granted blanket root access unless they genuinely need it.

Why not just log in as root? Because running as root permanently means every command you type, every script that runs, every program you start inherits root's effective UID. A typo, a bug, a malicious package — any of them can do anything to any file on the system without restriction. `sudo` creates an **audit trail** (every invocation is logged with the user, command, and timestamp), forces you to name the command explicitly, and limits the blast radius of any mistake to the duration of that one command.

## Real UID vs Effective UID

Every process carries two user identities simultaneously. The **real UID** is set at login and records who started the process — it doesn't change during the process's lifetime. The **effective UID** is what the kernel actually checks when making permission decisions — and it can change.

When you run a command through `sudo`, your shell's real UID remains yours. The child process that runs the command has an effective UID of 0. The kernel grants root permissions to that process because its effective UID is 0; you remain accountable because the real UID is logged. When the command finishes, the elevated effective UID disappears with it.

This distinction is what makes privilege separation possible. A process can start with elevated effective UID, perform whatever action requires it, then drop back to a lower effective UID for everything else. The network daemon that needs to bind to port 80 (which requires root) can do so at startup, then drop its effective UID to an unprivileged user before accepting any connections. The rest of its lifetime runs without root, minimizing what an attacker can do if they compromise it.

As the processes article showed, every process has a parent. The UID it starts with is inherited from that parent, modulated by the mechanisms discussed here: the effective UID can be elevated by sudo or by the setuid bit, and it can be voluntarily dropped when no longer needed.

## The Setuid Bit

The file permissions article introduced the **setuid bit** as a special permission flag, separate from the read/write/execute bits. Its effect is straightforward: when a setuid executable is run, the kernel sets the new process's effective UID to the **file's owner UID**, not the caller's UID. The caller's real UID remains theirs.

The canonical example is `passwd`. It's owned by root and has the setuid bit set. When you run it, the kernel starts a process with your real UID but an effective UID of 0 — root. That's the only reason `passwd` can open `/etc/shadow`, which is readable only by root, and write your new password hash into it. Without the setuid bit, `passwd` would fail with a permission error the moment it tried to open `/etc/shadow`.

The kernel enforces this automatically at exec time. No special code in `passwd` asks for root; the bit in the inode does it. The setuid bit on a root-owned file is, from the kernel's perspective, a standing instruction: "when this file is executed, grant the process root's effective UID."

The **setgid bit** works identically but for the effective GID — running the program sets the process's effective GID to the file's group owner.

## What Can Go Wrong: Privilege Escalation

**Setuid vulnerabilities** are among the most reliable paths to root on a Linux system. A setuid binary owned by root that has a bug — a buffer overflow that lets an attacker control execution, an unchecked input that causes it to run an arbitrary command, a race condition in how it opens files — gives an attacker code execution with effective UID 0. The setuid bit that allows `passwd` to write `/etc/shadow` is the same mechanism that turns a buggy setuid binary into a root shell.

**Sudoers misconfiguration** is the more common path in practice. `ALL=(ALL) NOPASSWD: ALL` grants unconditional, passwordless root to a user — indistinguishable from just giving them the root password. More subtly: `sudo vim` lets the user execute `:!bash` inside vim, dropping into a shell with root's effective UID. Any program that can spawn a shell, interpret commands, or write to arbitrary files is effectively full root access when granted via sudo. Editors, interpreters, `less`, `find`, `awk`, `perl` — they all have known escapes. Granting `sudo /usr/bin/find` is not a limited grant.

**Writable files in privileged execution paths** complete the picture. If a root-owned cron job or startup script sources a configuration file that a non-root user can write to, that user controls what root executes. The setuid bit protects the entry point; what the elevated process reads and runs matters just as much.

The common thread: wherever effective UID rises, any reachable vulnerability becomes a root hole. Minimizing the number of setuid binaries, auditing sudoers for overly broad grants, and ensuring root-executed scripts don't read from user-writable locations are the three most direct mitigations.

The intro to cybersecurity article named privilege escalation as a primary attacker goal without explaining the mechanism. This is the mechanism: find a path from your UID to effective UID 0 — through a setuid bug, a misconfigured sudo rule, or a writable file that root will execute. Understanding it precisely is the first step to defending against it.
