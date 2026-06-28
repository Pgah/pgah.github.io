---
title: "Introduction to Networking"
date: 2026-06-28
description: "How data actually moves. What the OSI model really means. And why you can't skip this."
tags: ["networking", "beginner", "fundamentals"]
---

Every security course tells you to learn networking first. Most people nod, skim a diagram of the OSI model, and move on. Then they hit a wall six months later and realize they skipped the foundation.

Don't do that. Let's actually understand this.

## Why Networking Matters More Than You Think

When you type a URL into a browser, somewhere between 5 and 20 things happen before you see a webpage. DNS resolves the domain. TCP handshakes happen. HTTP requests fly across the world and come back in milliseconds.

If you don't understand this, you can't understand why attacks work. You can't read traffic. You can't defend a system you don't understand.

## The OSI Model — Actually Useful

Everyone hates the OSI model until it saves them in a troubleshooting session. Here's what actually matters:

- **Layer 1 — Physical**: Cables, signals, Wi-Fi. Bits on a wire.
- **Layer 2 — Data Link**: MAC addresses, switches, frames. Your local network.
- **Layer 3 — Network**: IP addresses, routing, packets. How data crosses networks.
- **Layer 4 — Transport**: TCP and UDP. Reliability vs speed.
- **Layer 7 — Application**: HTTP, DNS, FTP. What your apps speak.

You don't need to memorize all 7 layers. You need to understand what layer you're operating at — and why it matters.

## TCP vs UDP

**TCP** is reliable. It does a three-way handshake (SYN, SYN-ACK, ACK), guarantees delivery, and retransmits lost packets. Use it when you can't afford to lose data — web browsing, file transfers, SSH.

**UDP** is fast. No handshake, no guarantees, no retransmission. Use it when speed matters more than perfection — video streaming, DNS queries, VoIP.

From a security perspective: TCP's handshake is the basis of the SYN flood attack. UDP's lack of connection state makes it useful for amplification attacks. Understanding the protocol means understanding the attack.

## IP Addresses and Subnets

Every device on a network has an IP address. There are two types:

- **Public IP**: Visible on the internet. Your router has one.
- **Private IP**: Only visible inside your network. Your laptop has one (usually `192.168.x.x` or `10.x.x.x`).

Subnetting lets you divide a network into smaller pieces. A `/24` subnet gives you 254 usable hosts. A `/30` gives you 2. You don't need to be a subnetting wizard, but you need to understand what a subnet mask is and why `192.168.1.0/24` means all addresses from `192.168.1.1` to `192.168.1.254`.

## DNS — The Internet's Phone Book

When you visit `google.com`, your computer doesn't know where that is. It asks a DNS server to resolve the domain name into an IP address.

The chain looks like this:

1. Your computer checks its local cache.
2. It asks your router.
3. Your router asks your ISP's DNS resolver.
4. That resolver works up the chain until it finds the authoritative DNS server for the domain.
5. You get an IP address back. Connection begins.

DNS is critical from a security perspective. DNS spoofing, DNS hijacking, and DNS tunneling are all real attack vectors. Know how DNS works before you touch anything involving domains.

## Ports and Protocols

A port is just a number that tells your OS which application should handle incoming traffic. Some you need to know cold:

| Port | Protocol | What it does |
|------|----------|--------------|
| 22   | SSH      | Secure remote shell |
| 53   | DNS      | Domain name resolution |
| 80   | HTTP     | Web traffic (unencrypted) |
| 443  | HTTPS    | Web traffic (encrypted) |
| 3306 | MySQL    | Database |
| 8080 | HTTP-alt | Often dev servers or proxies |

An open port is an open door. A misconfigured service behind that port is an open door with a broken lock.

## What to Do Next

Reading about networking only gets you so far. Open Wireshark and watch your own traffic. Run `nmap` against a home lab machine. Set up a small network with two virtual machines and watch packets move between them.

The goal isn't to memorize. The goal is to build intuition — to look at a packet capture and immediately understand what's happening.

That intuition is what separates someone who knows tools from someone who knows what's actually going on.

Build the foundation. Everything else sits on top of it.
