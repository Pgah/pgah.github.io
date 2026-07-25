---
title: "Linux File Permissions"
date: 2026-07-26
description: "The permission model in Linux dates to early Unix and is one of the most misunderstood parts of the system. The gaps in that understanding lead directly to the most common privilege escalation paths."
tags: ["linux", "security", "fundamentals", "permissions"]
---

The Linux architecture post covered what the system is: kernel space, user space, processes, the file abstraction. This post goes deeper into one specific part of that system: how access control works.

The Unix permission model is simple enough to learn in an afternoon and subtle enough that misconfigurations in it are one of the most reliable paths to privilege escalation. Both things are true simultaneously.

## What the Permission Model Does

Every file and process in Linux operates within an access control framework. The framework determines who can read, write, or execute what. It is enforced by the kernel, not by applications or shells.

Two concepts underpin everything: **identity** and **permissions**. Identity is who you are, represented as numeric user and group IDs (UID and GID). Permissions are what you are allowed to do, stored as bits on files and directories. The kernel checks your identity against the permissions on whatever you are trying to access and makes a binary decision: allowed or denied.

## The Unix Permission Model

This is called **Discretionary Access Control** (DAC). Discretionary because the owner of a resource decides who gets access to it.

Every file has an owner (a UID) and an associated group (a GID). It also has three sets of permission bits, one for each of three categories: **owner**, **group**, and **other**.

Each set contains three bits: **read (r)**, **write (w)**, and **execute (x)**.

When you try to access a file, the kernel determines which category applies to you. If your UID matches the file's owner UID, the owner bits apply. If your GID matches the file's group GID, the group bits apply. Otherwise, the other bits apply. Categories are checked in order and the first match wins: if you are the owner, only the owner bits matter even if the group bits would give you more access.

`ls -la` shows permissions in the format `-rwxrwxrwx`: the first character is the file type (`-` for regular file, `d` for directory, `l` for symlink), followed by three characters each for owner, group, and other.

`-rw-r--r--` means: owner can read and write, group can read, others can read. No execute for anyone.

`chmod` changes permission bits. `chown` changes the owner. Both require appropriate privilege.

Permissions on directories mean something slightly different. **Read** on a directory lets you list its contents. **Execute** (sometimes called search permission) lets you enter it and access files inside. **Write** lets you create and delete files in it. You can have a directory that you cannot list but can access if you know the exact filename, or one you can list but not enter.

## SUID, SGID, and the Sticky Bit

Beyond the nine basic permission bits, three special bits exist. Understanding them is essential because two of them are direct privilege escalation targets.

**SUID (Set User ID)**: when set on an executable file, the program runs with the file owner's UID rather than the caller's UID. If a root-owned binary has SUID set, anyone who executes it runs that program as root for the duration of the execution.

This exists because some operations legitimately require privileges that ordinary users should not permanently have. `passwd` is the canonical example: a regular user needs to update `/etc/shadow`, which only root can write. `passwd` is owned by root with SUID set. When you run it, it executes as root, enforces its own logic about what changes it will and won't make, and writes the new password hash. Controlled root access through a well-audited program.

SUID is also one of the first things an attacker looks for after gaining a foothold. If you can find a SUID binary with a vulnerability, unexpected behavior, or a path you can influence, you have a route to root. `find / -perm -4000 2>/dev/null` lists every SUID binary on the system.

**SGID (Set Group ID)**: on a file, the program runs with the file's group GID rather than the caller's GID. On a directory, new files created inside inherit the directory's group rather than the creator's primary group. The directory behavior is commonly used for shared project directories where all files should belong to a shared group regardless of who created them.

**Sticky bit**: on a directory, only the file owner or root can delete or rename files, even if the directory is world-writable. `/tmp` is the standard example: world-writable so any process can create temporary files, sticky so no process can delete another user's files. Without the sticky bit, world-write on a directory means anyone can delete anyone's files in it.

## Linux Capabilities

Traditional Unix has a binary privilege model: root or not root. Root can do everything. Non-root cannot do privileged things. If your process needs to do one privileged operation, such as binding to port 80 (ports below 1024 require privilege), the entire process needs root.

This is bad design. Giving a web server full root privileges so it can bind to port 80 means a compromised web server is a fully compromised machine.

Linux capabilities break root's privilege into discrete units. Each capability grants specific kernel-level privileges independently of others.

`CAP_NET_BIND_SERVICE`: bind to ports below 1024.
`CAP_NET_ADMIN`: configure network interfaces, routes, firewall rules.
`CAP_SYS_PTRACE`: trace arbitrary processes (this is how debuggers work).
`CAP_SYS_ADMIN`: a broad capability that covers many administrative operations; often called "mostly root" because of how much it allows.
`CAP_KILL`: send signals to any process regardless of UID.
`CAP_CHOWN`: change file ownership arbitrarily.

Around 40 capabilities exist in total.

A process can hold capabilities without being root. `setcap` assigns capabilities to a binary. `getcap` reads them. `capsh --print` shows the capabilities of the current process.

This is the principle of least privilege applied to kernel-level operations: a program gets only what it actually needs. A DNS server needs `CAP_NET_BIND_SERVICE` to bind to port 53. That is all it needs. Not root. Not `CAP_SYS_ADMIN`.

Capabilities matter in security assessments for the same reason SUID does: a process with a broad capability and an exploitable vulnerability gives an attacker that capability. Finding a service running with `CAP_SYS_ADMIN` is roughly as interesting as finding a SUID root binary.

## ACLs

The three-category Unix permission model is often insufficient. You need to give a specific user read access to a file without changing its owner or group, and without making it world-readable.

POSIX ACLs (Access Control Lists) extend the model. An ACL can contain named entries for specific users and groups beyond the owner/group/other triplet.

`setfacl -m u:alice:r file` gives the user `alice` read access to `file` regardless of what group she is in. `getfacl file` shows all ACL entries. `ls -la` shows a `+` after the permission bits when ACLs are present.

ACLs layer on top of the Unix permission model. The traditional bits still exist and still apply. The kernel evaluates both. An effective permission calculation involves both the regular bits and the ACL mask.

Most environments use ACLs sparingly. They add complexity to reasoning about who can access what. Used precisely, they solve real problems. Used carelessly, they create permission configurations that are difficult to audit.

## MAC: SELinux and AppArmor

DAC has a fundamental weakness: it grants trust based on identity. If a process runs as root, it can access anything root can access. If a process runs as a user with broad file permissions, it can access all of those files. A compromised process inherits every permission its identity holds.

Mandatory Access Control (MAC) adds a second enforcement layer, independent of DAC and enforced by the kernel. Under MAC, even root is subject to policy restrictions.

**SELinux** (Security-Enhanced Linux) labels every file, process, socket, and system resource with a security context: a structured string like `system_u:object_r:httpd_exec_t:s0`. Policy rules define which contexts can interact with which. An Apache process running with context `httpd_t` can only access files labeled with contexts that policy allows `httpd_t` to access. A vulnerability in Apache that leads to code execution doesn't give an attacker file access beyond what SELinux permits for that context.

SELinux is the default MAC system on RHEL, CentOS, and Fedora. It is powerful and comprehensive. It is also operationally complex. Writing and maintaining SELinux policy is a discipline of its own. The common misconfiguration is setting SELinux to permissive mode, which logs policy violations but allows everything. Permissive mode defeats the protection entirely. If SELinux is in permissive mode on a production system, it is providing no security benefit.

**AppArmor** is path-based rather than label-based. Profiles define which file paths a program can access and what it can do: which paths it can read, write, execute, and which network operations it can perform. Default on Ubuntu and Debian. Easier to configure than SELinux, less expressive.

A confined application under AppArmor can only access the paths explicitly permitted in its profile. An exploit that gets code execution in a profiled application is constrained to those permitted paths.

## What This Means in Practice

Privilege escalation on Linux follows a small number of recurring patterns.

A SUID binary with exploitable behavior: a buffer overflow, a path traversal, an argument that invokes a shell, an unsafe use of a library. The result is code execution as the binary's owner, typically root.

Writable files or directories that a privileged process will read, execute, or otherwise consume. A cron job running as root that sources a writable config file. A service that executes a script in a world-writable directory.

Overly permissive capabilities on a service with a vulnerability. A process with `CAP_SYS_ADMIN` or `CAP_NET_ADMIN` that can be exploited gives access to those capabilities.

MAC disabled or permissive, removing the secondary enforcement layer.

The permission model is well-designed for what it was designed to do. The failures are almost always in how it is applied: SUID binaries that should not be SUID, directories with permissions broader than necessary, services running with more privilege than their function requires, MAC enforcement turned off because it was generating denials.

Auditing permissions is straightforward: find SUID and SGID binaries, check file permissions on sensitive paths, review which processes hold which capabilities, verify MAC is enforced and not permissive. The commands are simple. Acting on what you find is what requires judgment.
