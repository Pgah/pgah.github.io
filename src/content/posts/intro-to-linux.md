---
title: "The Architecture to of Linux"
date: 2026-06-30
description: "Not the commands. The actual system — what it is, how it thinks, and why it works the way it does."
tags: ["linux", "beginner", "fundamentals"]
---

Most people learn Linux backwards. They memorize commands before they understand what's running those commands. They navigate directories without knowing what a directory actually is in this context. Then they hit something unexpected and have no idea why.

Let's fix that. Before a single command, understand the machine.

## What Linux Actually Is

Linux is a kernel. Not an operating system in the complete sense — a kernel. The kernel is the core layer that sits between your hardware and everything else. It controls memory, manages processes, handles hardware communication, and enforces security boundaries.

What most people call "Linux" is actually the kernel bundled with a collection of tools, libraries, and a shell. Ubuntu, Debian, Kali, Arch — these are all distributions. Same kernel underneath, different choices on top.

The kernel itself never talks to you directly. You never interact with it. Everything you do goes through layers that eventually reach it.

## The Two Worlds: Kernel Space and User Space

This is one of the most important concepts in Linux and almost nobody teaches it early enough.

The system is divided into two separate worlds:

**Kernel space** is where the kernel lives. Code here has unrestricted access to hardware, memory, everything. A bug in kernel space can crash the entire system. A vulnerability here is catastrophic.

**User space** is where everything else runs. Your browser, your terminal, your applications. Code here is sandboxed — it can't directly touch hardware. If it needs hardware access, it has to ask the kernel through a controlled interface.

Why does this matter for security? Because the boundary between these two worlds is the most important security boundary in the entire system. Breaking out of user space into kernel space — a privilege escalation — is one of the most serious things an attacker can do.

## Everything Is a File

Linux has a philosophy that sounds strange until it clicks: almost everything is treated as a file.

Your hard drive? A file. A running process? Has a file representation. A network socket? A file. Hardware devices? Files. System configuration? Files. Even running memory can be accessed through a file-like interface.

This isn't just philosophical. It means the same tools and concepts you use to work with text files apply across the entire system. Once you understand how files and permissions work in Linux, you understand how a huge portion of the system works.

## The Filesystem Hierarchy

Linux doesn't organize files by drive letter. Everything lives in a single tree rooted at `/` — called the root. Every other location is somewhere inside that tree.

The structure isn't arbitrary. Each directory has a defined purpose:

- **`/`** — The root. The top of everything.
- **`/bin`** and **`/usr/bin`** — Essential programs. The tools that make the system usable.
- **`/etc`** — System-wide configuration. If something controls how software behaves, it's probably here.
- **`/home`** — Where user data lives. Each user gets their own directory inside it.
- **`/root`** — The home directory for the root user, separate from `/home` by design.
- **`/var`** — Variable data. Logs, temporary files, things that change while the system runs.
- **`/proc`** and **`/sys`** — Not real files on disk. Virtual filesystems that expose live information about the running kernel and hardware.
- **`/tmp`** — Temporary files. Usually cleared on reboot.

When you're investigating a Linux system — your own or one you're testing — knowing what belongs in each location and what looks out of place is a fundamental skill.

## Processes

Every running program is a process. The kernel tracks every process, gives it resources, and decides when it runs.

When Linux boots, the kernel starts a single process — historically called `init`, today often `systemd`. Everything else on the system is a descendant of that first process. Processes create new processes by forking — splitting into a parent and a child.

This parent-child relationship matters. It's how permissions propagate, how signals travel, and how a process inherits its environment.

Every process has an owner. That owner determines what the process can do. A process running as a regular user is limited. A process running as root has no limits.

This is why one of the most basic questions in Linux security is always: *what user is this process running as, and does it need to be?*

## The Permission Model

Linux permissions are built around three concepts: **who**, **what**, and **which file**.

**Who** breaks into three categories: the file's owner, the file's group, and everyone else. Every file belongs to a user and a group.

**What** breaks into three actions: read, write, and execute. For a regular file, these mean what you'd expect. For a directory, execute means the ability to enter it — which is a subtlety that trips people up constantly.

These permissions are the first line of access control on any Linux system. A misconfigured permission on the wrong file is often all it takes for something to go wrong.

## The Shell

The shell is not Linux. The shell is a program — an interface that takes text input, interprets it, and runs other programs. It's replaceable. It's just software.

What matters is understanding that when you run something in a terminal, you're talking to the shell, and the shell is talking to everything else. The shell has a user, a working directory, and an environment. It inherits permissions. It can be scripted.

Understanding the shell as a layer — not as the system itself — changes how you think about everything you do in a terminal.

## Why This Foundation Matters

Security work on Linux is almost always about understanding where boundaries are and how they can be crossed. The kernel boundary. The permission boundary. The user boundary.

Without knowing that these boundaries exist and why, you're just running commands and hoping for results. With this foundation, you start to understand *why* an exploit works, *why* a misconfiguration matters, *why* the attacker did what they did.

The commands come next. The understanding comes first.
