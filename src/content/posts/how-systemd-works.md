---
title: "How systemd Works"
date: 2026-08-11
description: "PID 1 isn't just the first process — it's the supervisor, the dependency manager, and the security boundary all at once. This is how systemd manages the transition from a running kernel to a functioning system."
tags: ["linux", "systemd", "processes", "fundamentals"]
---

When the kernel finishes loading, it has accomplished one thing: it is running. The hardware is initialized, memory management is set up, the scheduler is ready. But the system is not yet functional. There are no services, no network, no user-facing processes. Something has to start all of that, track it, restart it when it crashes, and shut it down cleanly when the machine powers off. That something is **systemd**, and it runs as PID 1.

## The Problem Before systemd

The original Unix init system — commonly called **SysV init** after System V Unix — was simple. It ran a series of shell scripts in sequence. To start a web server, it ran a script that started the web server. To start networking, it ran a script that configured the network. The scripts ran one after another, in a numbered order determined by their filenames.

The simplicity was also the limitation. Sequential startup is slow: if one service takes ten seconds to start, everything that follows it waits ten seconds, even if those services do not actually depend on it. Expressing dependencies was manual and fragile — administrators had to reason about correct startup order by choosing filenames carefully, and the system had no way to verify their reasoning. If a service crashed after startup, nothing noticed or restarted it. The init scripts themselves were shell code of varying quality, running as root, with no isolation between them.

systemd was designed to fix all of these problems simultaneously, and it did, at the cost of considerable complexity and considerable controversy.

## PID 1's Job

As the [processes article](/posts/linux-processes-and-signals) established, PID 1 is the first process the kernel creates directly during boot. It is the root of the process tree. Every other process on the system is a descendant of PID 1.

This position comes with a specific responsibility. When any process's parent dies, the kernel re-parents that process to PID 1. This means PID 1 is perpetually accumulating orphaned processes, and it must call `wait()` on each of them or they become zombies. A process that cannot handle this correctly should not be PID 1.

PID 1 also has one other unique property: if it exits, the kernel panics. There is no recovery path. The assumption is that the system has entered an irrecoverable state and the appropriate response is to stop. This is why systemd is not designed to exit under normal circumstances, and why the transition from "booting" to "running" to "shutting down" is managed entirely within PID 1 rather than by replacing it.

## Units: The Building Blocks

systemd does not manage services through shell scripts. It manages them through **unit files** — declarative configuration files that describe what something is, what it depends on, how to start and stop it, and when it should run.

Unit files live in two places. The directory `/lib/systemd/system/` holds unit files provided by packages. The directory `/etc/systemd/system/` holds unit files created by the administrator — and these take precedence. When you want to change how a service behaves without modifying the file that came with the package, you write a new file in `/etc/systemd/system/` with the same name, or drop an override file into a `.d/` subdirectory next to it.

Units come in several types, distinguished by their file extension. A **.service** unit describes a daemon or a one-shot process. A **.socket** unit describes a network or IPC socket that systemd listens on and uses to activate a service on demand. A **.timer** unit describes a scheduled task, replacing the historical role of cron for service-managed jobs. A **.mount** unit describes a filesystem mount point. A **.target** unit describes a synchronization point — a named group of other units — and replaces the old concept of runlevels.

## Service Units in Depth

A service unit file has three sections. The `[Unit]` section contains metadata and dependency declarations. The `[Service]` section describes how to run the service. The `[Install]` section describes how the unit should be enabled at boot.

A minimal service unit looks like this:

```ini
[Unit]
Description=My Web Server
After=network.target

[Service]
ExecStart=/usr/bin/myserver --config /etc/myserver.conf
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

The `Type=` directive in `[Service]` tells systemd what to expect after running `ExecStart`. `Type=simple` (the default) means systemd considers the service started as soon as the process starts. `Type=forking` means the original process will fork and then exit, and systemd waits for that exit and then tracks the child. `Type=notify` means the service will send a signal over a special socket when it is ready, which lets systemd know the service is actually up and not merely started.

The `Restart=` directive controls what systemd does when the process exits. `Restart=on-failure` means systemd will restart the service if it exits with a non-zero status or is killed by a signal. `Restart=always` means it restarts regardless of how it exited, including clean exits. `RestartSec=` sets how long to wait before restarting, which matters if the service needs a moment before it can successfully start again.

This built-in supervision is what SysV init lacked. A crashed service does not require a separate watchdog process or manual intervention. systemd notices and acts.

## Dependencies and Ordering

The distinction between dependencies and ordering is one of the most important things to understand about systemd, and one of the most commonly confused.

`Requires=` declares a hard dependency. If unit A has `Requires=B`, then starting A will also start B, and if B fails or stops, A will be stopped as well. `Wants=` is the same idea but weaker: if B fails, A is not affected. Most services should use `Wants=` rather than `Requires=`, because it is more resilient — if a non-essential dependency fails to start, it does not bring down everything that depended on it.

`After=` and `Before=` control ordering, but they do not imply dependency. If A has `After=B`, systemd will not start A until B has finished starting. But if B is not in the current transaction — not being started — `After=B` has no effect. This is a frequent source of confusion: `After=network.target` means "start after the network target if it is being started," not "start only if the network is up." The combination you almost always want is both: `Wants=B` and `After=B`.

**Target units** replace the old runlevel concept. `multi-user.target` is roughly equivalent to runlevel 3 — a fully functional, non-graphical system. `graphical.target` adds the display manager. `network.target` is a synchronization point that other units can declare ordering against. They are not services themselves; they are named milestones in the startup sequence that let other units anchor their ordering relationships.

## Socket Activation

Socket activation is one of systemd's cleverer ideas. Instead of starting a service at boot and having it listen on a port, systemd opens the socket itself and waits. When the first connection arrives, systemd starts the service and hands it the already-open socket. Until that first connection, the service process does not exist.

This has several benefits. Boot time is faster because services are not started until they are needed. Ordering problems are reduced: a client can connect to a socket before the service is fully started, because systemd's socket is already listening. The connection will wait in the kernel's socket buffer until the service processes it.

From a security perspective, socket activation also enables a natural form of privilege separation: the socket can be created with specific permissions and ownership before the service process starts, without requiring the service itself to run as root just to bind to a privileged port.

## The Journal (journald)

Traditional Unix systems logged to plain text files in `/var/log/`. `journald` does not. It logs to a binary format, and for reasons that are not merely aesthetic.

A structured binary log can store metadata alongside each log entry: the exact timestamp as a monotonic clock value, the PID of the process that logged it, the UID and GID, the systemd unit name, the priority level, and arbitrary key-value pairs the process itself can attach. A plain text log file stores whatever string the program decided to write. The metadata in a structured log is not guessable from the string; it is recorded by the kernel at the moment of logging.

`journalctl` is the tool for querying the journal. `journalctl -u nginx` shows only logs from the nginx unit. `journalctl -b` shows logs from the current boot; `journalctl -b -1` from the previous boot. `journalctl -p err` shows only entries at error priority and above. `journalctl --since "1 hour ago"` filters by time. The binary format is what makes these queries fast on a large log set.

The security implication is double-edged. The journal's binary format is harder to forge than plain text — appending a fake log line requires writing the binary format correctly, not just editing a file. But it also means the journal is a single location that, if deleted or corrupted, loses all structured log history. The `Storage=volatile` setting in `/etc/systemd/journald.conf` keeps the journal only in RAM, which means logs are lost on reboot — useful for systems where disk writes are expensive or where privacy is a concern, but a serious problem for post-incident analysis.

## systemd Security Features

systemd unit files can declare security restrictions that the kernel enforces for the duration of the service's execution. These are not application-level security measures; they are kernel-enforced policies that the service process itself cannot override.

`PrivateTmp=yes` gives the service its own private `/tmp` directory, isolated from the system's shared `/tmp`. A service running with this setting cannot read or write files that other services placed in `/tmp`, and nothing else can read files the service places there. This prevents a class of attacks where one process leaves something in `/tmp` expecting a privileged process to act on it.

`ProtectSystem=strict` mounts the entire filesystem read-only for this service, except for explicitly allowed paths. A compromised service cannot modify system binaries even if the process's credentials would otherwise permit it.

`NoNewPrivileges=yes` prevents the process from gaining additional privileges through mechanisms like setuid binaries. Even if the process executes a setuid-root binary, it does not gain root. This is one of the most impactful single directives — it fundamentally limits what a compromised service can do with the rest of the system.

`CapabilityBoundingSet=` restricts which Linux capabilities the service process can hold. As the [file permissions article](/posts/linux-file-permissions) established, capabilities are fine-grained subdivisions of root's privileges. A service that only needs to bind to a privileged port needs `CAP_NET_BIND_SERVICE` and nothing else. Stripping everything else means a compromise of that service cannot be leveraged to, for example, load kernel modules or trace other processes.

Together, these directives define a **security sandbox** — not a separate execution environment, but a set of kernel-enforced restrictions that reduce the blast radius of a compromise before it happens.

## The Attack Surface

systemd's privileged position as PID 1 makes it a high-value target. It runs as root, it has access to everything, and it never exits.

**D-Bus** is the IPC mechanism through which most of the system communicates with systemd. When you run `systemctl restart nginx`, `systemctl` does not directly restart anything — it sends a D-Bus message to systemd, which carries out the action. The D-Bus interface is access-controlled: certain operations require root, others are available to members of specific groups, and others are available to any local user. Understanding these policies matters for understanding who can do what without `sudo`.

**sudoers misconfiguration** is one of the most reliable privilege escalation paths on Linux systems, and systemd is frequently involved. Allowing a user to run `systemctl start` or `systemctl stop` on arbitrary units — rather than specifically named ones — effectively grants root. A user who can create a unit file and then start it controls what executes as root. The `/etc/systemd/system/` directory is writable only by root for exactly this reason.

**Persistence via unit files** is a standard post-exploitation technique. An attacker who achieves code execution can write a unit file to `/etc/systemd/system/` and enable it, ensuring their payload survives reboots. Detection requires monitoring that directory for new or modified files and auditing which units are enabled — `systemctl list-units --type=service --state=enabled` is a starting point. The journal may have a record of who touched what and when, which is one reason incident responders care about log preservation before anything else on the compromised system.

systemd is not a single program with a single purpose. It is an API surface for system lifecycle management: starting, stopping, supervising, logging, and sandboxing everything that runs on a Linux system. Understanding it means understanding what each mechanism does, who can reach it, and what the kernel will and will not allow when something goes wrong.
