---
title: "Cron & systemd Timers"
date: 2026-09-07
description: "Two mechanisms exist on every modern Linux system for running something later: an old daemon that just fires shell commands on a schedule, and a newer one that treats a scheduled job as a full systemd unit. The difference is not cosmetic."
tags: ["linux", "systemd", "automation", "cron"]
---

Every long-running Linux system eventually needs something to happen without a human triggering it: a backup at 3 AM, a log rotation every hour, a certificate renewal check once a day. Two mechanisms handle this. **cron** has done it since the 1970s and is still the first thing most people reach for. **systemd timers** do the same job but as first-class systemd units, inheriting everything the [systemd article](/posts/how-systemd-works) described — dependency ordering, structured logging, resource control. Neither is obsolete. Understanding what each one actually gives you is what makes the choice deliberate instead of habitual.

## Cron: The Original Mechanism

The **cron daemon** wakes up once a minute, reads a set of schedule files called **crontabs**, and for any line whose schedule matches the current minute, forks and executes the command. That's the entire model — a timer loop and a table of "at this time, run this."

A crontab line has five time fields followed by a command:

```
# minute hour day-of-month month day-of-week   command
0        3    *             *     *             /usr/local/bin/backup.sh
*/15     *    *             *     *             /usr/local/bin/check-disk.sh
```

Each user can have their own crontab, edited with `crontab -e` and stored under `/var/spool/cron/`. These run as that user, with that user's environment and permissions. System-wide jobs live in `/etc/crontab` and `/etc/cron.d/`, where an extra field specifies which user the job runs as — necessary because there is no implicit owner the way a per-user crontab has one. The `/etc/cron.daily/`, `/etc/cron.hourly/`, and similar directories are a convention, not a cron feature: a single `/etc/cron.d` entry runs `run-parts` against each directory on the matching schedule, executing every script it finds inside.

## What Cron Doesn't Do

Cron's simplicity is also its ceiling, and the gaps matter more as a system grows.

There is no dependency tracking. A cron job scheduled for 3:00 AM runs at 3:00 AM whether or not the database it depends on is actually up. There is no concept of "run this after that other job finishes" beyond chaining commands manually inside the script itself.

There is no logging by default. A cron job's stdout and stderr are, historically, mailed to the crontab owner via the local mail system — which on most modern servers is not configured to deliver anywhere, so the output silently disappears. Diagnosing why a cron job failed often means redirecting output to a file by hand, in every crontab line, and remembering to do so.

There is no catch-up for missed runs. If the machine is powered off at 3:00 AM, that day's backup simply never happens. Cron has no memory of what it failed to run while the system was down.

There is no resource control. A cron job runs as an ordinary forked process, subject to whatever the shell and the kernel default to — no CPU or memory ceiling unless the script itself sets one up.

None of these are bugs. Cron was built to run shell commands on a schedule, and it does that reliably. The gaps show up specifically when a scheduled job is important enough that you need to know it ran, need it to wait for a dependency, or need it to survive downtime — which is exactly the set of concerns systemd already solves for services.

## systemd Timers: A Timer Is a Unit

A **systemd timer** is not a separate scheduling daemon bolted onto systemd — it's a `.timer` unit, paired with a `.service` unit of the same name, both managed through the same unit model described in the systemd article.

```ini
# backup.service
[Unit]
Description=Nightly backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup.sh
```

```ini
# backup.timer
[Unit]
Description=Run backup.service nightly

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

`systemctl enable --now backup.timer` starts the timer; when it fires, systemd starts `backup.service`. The service does the work, the timer only decides when. This split matters: `backup.service` can also be started manually with `systemctl start backup.service` for a one-off run, entirely independent of its schedule, because it's just a service like any other.

## Two Kinds of Schedule

`OnCalendar=` expresses wall-clock schedules, like cron's fields but with a more readable calendar syntax: `*-*-* 03:00:00` means every day at 3 AM, `Mon *-*-* 09:00:00` means every Monday at 9 AM, `*-*-01 00:00:00` means the first of every month at midnight. `systemd-analyze calendar "Mon *-*-* 09:00:00"` will print the next several times a given expression fires, which is useful for checking an expression before trusting it.

`OnBootSec=`, `OnUnitActiveSec=`, and their relatives express relative schedules instead: "15 minutes after boot," or "every hour since this timer last activated." This is a category cron cannot express at all — cron only knows wall-clock time, so "run every 6 hours starting from whenever the system last booted" has no direct cron equivalent without extra scripting. A timer can combine both kinds of trigger; whichever fires first runs the service.

## Catching Up on Missed Runs

`Persistent=true` is the direct answer to cron's missed-run problem. When set, systemd records the last time the timer fired, using the unit's own state. If the timer was supposed to fire while the machine was off, it fires once, immediately, the next time the system boots and reaches this unit — instead of silently skipping to the next scheduled time.

This is not a general feature of cron jobs, and it's not something you can retrofit onto a cron line. It exists because a systemd timer is a persistent, stateful unit that systemd tracks across boots, not a row re-evaluated fresh every minute.

## Everything Else a Unit Gets for Free

Because a timer's job runs as a systemd service, it gets everything the systemd article described for any other service, without extra configuration:

**Logging** goes to the journal automatically. `journalctl -u backup.service` shows exactly when the job ran, what it printed, and what its exit code was — no mail transport to configure, nothing to redirect by hand.

**Dependency ordering** works the same as it does for any unit. `After=postgresql.service` and `Wants=postgresql.service` on `backup.service` mean the backup will not start until the database is actually up, not just at whatever time was guessed when the crontab line was written.

**Resource control** applies through the same cgroup-based directives as any service. `MemoryMax=`, `CPUQuota=`, and the sandboxing directives from the systemd article — `PrivateTmp=`, `ProtectSystem=strict`, `NoNewPrivileges=` — all apply to a timer-triggered service exactly as they would to a long-running daemon.

## The Security Angle

Cron's attack surface is a file permissions problem. `/etc/crontab`, `/etc/cron.d/`, and the per-user spool directories are only supposed to be writable by root and the owning user respectively — but on a misconfigured system, a world-writable or group-writable crontab entry is a direct path to running arbitrary commands as whoever owns that crontab. If that owner is root, it's a privilege escalation primitive: write a line, wait up to a minute, and code runs as root. Auditing which crontabs exist and who can write to them (`ls -la /etc/cron.d/`, checking spool directory permissions) is standard practice in a Linux security review for exactly this reason.

systemd timers inherit the same category of risk at the unit-file level — a writable `.timer` or `.service` file in `/etc/systemd/system/` is just as dangerous as a writable crontab, for the same reason the systemd article flagged unit-file persistence as a post-exploitation technique. But timers also inherit the mitigation: the same sandboxing directives that constrain a normal service constrain a timer-triggered one. A backup job that only needs to read specific directories and write to one destination can run with `ProtectSystem=strict` and a narrow `ReadWritePaths=`, something a bare cron job has no equivalent mechanism for expressing.

## When to Reach for Which

Cron remains the right tool for a simple, portable scheduled command — a script that doesn't depend on anything else being up, where a missed run because the machine was off is inconsequential, and where the target might not even be a systemd-based system. Its syntax is universally understood and its footprint is minimal.

systemd timers are the right tool once a scheduled job's correctness starts to matter: when it depends on another service, when a missed run needs to be caught up rather than silently skipped, when you need an actual log of whether it ran and what happened, or when you want the same sandboxing applied to a scheduled job that you'd apply to any other service. The job is not fundamentally different — it's still a command that runs on a schedule. What changes is whether that command gets treated as a full member of the system systemd already supervises, or as a line in a file that a separate, much simpler daemon reads once a minute.
