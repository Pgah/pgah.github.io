---
title: "How TLS Works"
date: 2026-07-20
description: "The padlock in your browser isn't decoration. It's the result of a cryptographic handshake — and understanding it changes how you think about trust, identity, and what 'secure' actually means."
tags: ["tls", "https", "cryptography", "networking", "fundamentals"]
---

Most people see the padlock in their browser and assume they're safe. They're right — but for entirely the wrong reasons. They trust the outcome without understanding the mechanism. The mechanism is what matters.

TLS is that mechanism. Every time your browser connects to an HTTPS site, a protocol runs underneath — before a single byte of your request is sent — that establishes encryption, verifies identity, and prevents tampering. This is what the padlock actually represents.

## What TLS Actually Is

TLS stands for Transport Layer Security. It's the successor to SSL (Secure Sockets Layer), a protocol from the 1990s that had fundamental design flaws. Most people still say "SSL" when they mean TLS. The distinction matters less in conversation than in configuration — if you're running SSL anywhere, you have a problem.

TLS operates between TCP and the application layer. It doesn't change what you send — it wraps it. HTTP becomes HTTPS. The protocol handles encryption, authentication, and integrity. The application above it sends and receives data as normal.

What TLS protects: the payload. The content of your requests and responses.

What TLS doesn't protect: the IP address of the server you're connecting to, which is visible in every packet. With SNI (Server Name Indication), the domain name is also sent in plaintext during the handshake — the server needs it to choose which certificate to present. Encrypted Client Hello (ECH) addresses this, but it isn't universally deployed yet.

## The Problem It Solves

Before understanding how TLS works, understand what it has to solve.

You're connecting to a server across a network you don't control. Packets pass through routers, ISPs, cables — none of which you own. Someone on any of those paths could read what you send, modify it in transit, or impersonate the server entirely.

TLS has to solve three distinct problems:

**Confidentiality** — nobody watching the network can read the data.

**Integrity** — nobody can modify data in transit without both sides detecting it.

**Authentication** — you're actually talking to the server you think you are, not an impostor.

Solving one or two of these isn't enough. A connection can be encrypted but unauthenticated — you're sending secrets to someone, you just don't know who. TLS solves all three.
