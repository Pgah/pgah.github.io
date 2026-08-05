---
title: "Linux Processes and Signals"
date: 2026-08-05
description: "A program sitting on disk does nothing. A process is what the kernel creates when it decides to run one — and signals are how the system talks to it while it does."
tags: ["linux", "processes", "signals", "fundamentals"]
---

A program is an inert collection of instructions sitting on disk. It occupies storage space and nothing else. A **process** is what the kernel creates when it decides to breathe life into that program — it allocates memory, sets up an execution context, and begins running the program's instructions on the CPU. One program can have zero processes, one process, or a hundred processes running simultaneously. They are fundamentally different things, and confusing them is the source of a great deal of confusion when something goes wrong at runtime.

## What a Process Actually Is

The kernel does not simply run a program and forget about it. For every running process, it maintains an internal data structure called the **Process Control Block**, or **PCB**. Think of the PCB as the kernel's complete dossier on a process: what memory it owns, which files it has open, the current state of the CPU registers it was using, its scheduling priority, and more. When the kernel switches from running one process to another — which happens many times per second — it saves the outgoing process's register state into its PCB and loads the incoming process's register state from its PCB. This is called a **context switch**, and it is how the illusion of simultaneous execution is maintained even on a single CPU core.

Every process is assigned a **PID**, a Process ID — a unique integer the kernel hands out sequentially. PID 1 is special and will be discussed shortly. Every process also knows the PID of the process that created it: the **PPID**, or Parent Process ID. That parent-child relationship is not merely bookkeeping; it is structural, determining how the system behaves when either side of that relationship dies.

At any given moment, a process is either running — actually executing on a CPU core right now — or waiting. Waiting means either blocking on I/O (a disk read, a network response) or waiting for a signal to arrive. There is also a stopped state, where the process is paused until told to resume. The **kernel scheduler** decides which runnable process gets CPU time next, for how long, and when to preempt it in favor of something else.

As the architecture article established, the kernel sits between hardware and everything else, mediating all access through a controlled interface. A process cannot touch memory outside what the kernel has allocated to it. It cannot directly access hardware. Everything goes through the kernel, and the PCB is what the kernel uses to keep those boundaries enforced.

## Fork and Exec: How Processes Are Born

With one exception, every process on a Linux system was created by another process. There is no other mechanism. The exception is PID 1, which the kernel creates directly during boot.

The system call that creates a new process is **`fork()`**. When a process calls `fork()`, the kernel makes a near-exact copy of it. The copy gets its own PID and its own PPID (pointing back to the original), but it inherits everything else: the same memory contents, the same open file descriptors, the same environment variables, the same position in the code. After `fork()` returns, two separate processes are running: the **parent** (the original) and the **child** (the copy). They are both executing the same code at the same point, and the only way to tell them apart is the return value of `fork()` — the parent receives the child's PID, the child receives zero.

Making a copy of yourself is not usually the goal. The goal is to run a different program. That is where **`exec()`** comes in. When a process calls `exec()` with the path to a program, the kernel loads that program and completely replaces the calling process's memory image with it. The PID stays the same; everything else — the stack, the heap, the code — is thrown away and rebuilt from the new program.

The standard way to launch a new program is therefore `fork()` followed by `exec()` in the child: fork a copy of yourself, then in the copy, replace yourself with the program you want to run. The parent continues its work; the new program runs in the child. This two-step sequence is at the heart of how shells work and how servers spawn worker processes.

There is a third system call that completes the picture: **`wait()`**. When a child process exits, it does not vanish immediately. It enters a half-dead state, still occupying an entry in the kernel's process table, holding its exit code and waiting for the parent to come and collect it. The parent calls `wait()` to retrieve that exit status. Only after `wait()` is called does the child's entry disappear entirely. This handoff is how the parent knows whether the child succeeded, failed, or was killed, and why `wait()` is not optional if you care about cleaning up after your children.

## The Process Tree

Because every process is born from another process, the entire set of running processes forms a tree. At the root of that tree is **PID 1**.

On modern Linux systems, PID 1 is almost always **`systemd`**, though older systems used a simpler program called `init`. Either way, PID 1 is the first process the kernel starts after the boot sequence. It is responsible for bringing up the rest of the system — starting services, mounting filesystems, setting up networking — and it never exits for as long as the system is running. Everything else on the system is a descendant of PID 1, directly or through many levels of indirection.

Every process has a PPID. Walk upward from any process by following PPIDs, and you will eventually reach PID 1. This is the tree. You can inspect it, you can trace lineage, and it matters in practice because permissions and certain behaviors propagate along these lines.

What happens when a parent process dies while its children are still running? The children become **orphan processes**. Their parent is gone, their PPID is now stale. The kernel handles this automatically: it re-parents orphaned processes to PID 1. This is one reason `systemd` is designed to call `wait()` on any process that ends up under its care. No orphan accumulates forever without someone collecting it. The tree stays consistent.

## Signals: Talking to a Running Process

A process spends most of its life ignoring the outside world and doing its work. But sometimes something needs to interrupt it — the user hits Ctrl-C, the system is shutting down, the process has done something illegal. This is what **signals** are for.

A signal is an asynchronous notification delivered to a process. "Asynchronous" means it can arrive at any point, regardless of what the process is currently doing. The signal is represented as a small integer — the signal number — and when it arrives, it interrupts the process's normal execution flow.

The kernel is the one that delivers signals, even when one process is sending a signal to another. The sender makes a system call, the kernel validates that the sender has permission to signal the target, and then delivers it. An unprivileged process cannot arbitrarily signal a process owned by a different user.

When a signal arrives, one of three things happens. If the process has registered a **signal handler** — a function to run when that specific signal arrives — the kernel suspends normal execution and runs the handler, then resumes. If no handler is registered, the kernel falls back to the signal's default action, which for most signals means terminating the process. The third option is that the process has told the kernel to ignore that signal, in which case it is discarded entirely.

Two signals break all of these rules: **SIGKILL** and **SIGSTOP**. These cannot be handled, blocked, or ignored. The kernel processes them directly, bypassing any handler the process may have installed. There is no defense against either of them.

## Common Signals and What They Mean

Understanding the signals you will encounter in practice is essential. They are not interchangeable.

**SIGTERM**, signal number 15, is the standard way to ask a process to exit. It is a request, not a command. The process receives it, and if it has a handler, it can catch it and do cleanup work: flushing write buffers, closing database connections, releasing locks, writing a final log entry, and then exiting cleanly. This is the correct first approach when you want a process to stop. Most well-written server software handles SIGTERM gracefully.

**SIGKILL**, signal number 9, is not a request. It is immediate, unconditional termination, enforced by the kernel. No handler runs. No cleanup code executes. The process is simply gone. Files that were in the middle of being written may be left incomplete. Locks may never be released. SIGKILL exists for situations where SIGTERM has failed or the process is not responding, but it should never be the first tool you reach for.

**SIGINT**, signal number 2, is what the terminal sends when you press Ctrl-C. For most programs, the effect is the same as SIGTERM, but the semantic meaning is different: it signals that the user has explicitly interrupted the program from an interactive session. Well-written interactive programs may handle SIGINT differently from SIGTERM — for example, by canceling the current operation rather than exiting entirely.

**SIGHUP**, signal number 1, originally meant "terminal hangup" — sent when the terminal a process was connected to disconnected. On modern systems, that meaning is vestigial. By convention, server and daemon processes treat SIGHUP as an instruction to reload their configuration without restarting, applying changes while continuing to serve requests.

**SIGSEGV** is the signal the kernel sends when a process attempts to access memory that does not belong to it — reading or writing an address outside what has been mapped to it, or writing to memory that is mapped read-only. The name stands for "segmentation violation." The default action is process termination, and the diagnostic you see as a result is the familiar "segmentation fault." A segfault is not random; it means the process did something specific that violated memory boundaries, and it is almost always a bug in the program.

## What Can Go Wrong: Zombies

A **zombie process** is one that has exited but whose parent has never called `wait()` to collect its exit status. The process is fully dead — it is not running, it is not using CPU, it has released its memory and file descriptors. But its entry in the kernel's process table remains, holding its PID and exit status, waiting for a parent that never comes.

A handful of zombies is normal and harmless — a child exits and a moment passes before the parent calls `wait()`. The problem is a parent that never calls `wait()` at all. When zombies accumulate in large numbers, they exhaust the PID namespace and new processes cannot be created.

The fix is a parent that calls `wait()` correctly. If the parent itself dies, its zombie children are re-parented to PID 1, which will collect them. The only scenario where zombies become a serious problem is a long-running parent with a bug.

## A Foundation for Identity

Processes do not run in a vacuum. Every process runs under an **identity** — a user account whose permissions it inherits. That identity determines which files the process can open, which signals it is allowed to send to other processes, and what resources are available to it. The kernel enforces these identity-based limits at every system call boundary, the same boundary described in the architecture article as the line between user space and kernel space.

Understanding how processes work is the necessary foundation for understanding what happens when a process is asked to do something it has no right to do. The next piece of that picture is the system of users and groups that defines those rights — who can do what, to what, and why the kernel allows it.
