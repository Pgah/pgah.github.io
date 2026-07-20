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

## The Handshake

When your browser connects to an HTTPS site, before any HTTP request is sent, a handshake happens. This is the cryptographic core — where TLS establishes the secure channel.

Here's how TLS 1.2 works:

**ClientHello** — The browser sends a list of supported TLS versions, cipher suites it understands (combinations of algorithms for key exchange, encryption, and hashing), and a random value.

In TLS 1.3, the ClientHello also includes key share data. The client makes an educated guess about which key exchange the server will pick and sends its public key material upfront — eliminating a round trip.

**ServerHello** — The server picks a TLS version and cipher suite from the client's list and sends its own random value. In TLS 1.3, the server's key share data is included here, and the connection is already half-encrypted at this point.

**Certificate** — The server sends its certificate: proof of identity. The client uses this to verify it's talking to the right server. More on certificates in the next section.

**Key Exchange** — In TLS 1.2 with RSA key exchange, the client generates a pre-master secret, encrypts it with the server's public key, and sends it. Only the server can decrypt it. Both sides derive the session key from this secret and the random values exchanged earlier.

In TLS 1.2 with DHE or ECDHE, key exchange uses Diffie-Hellman: both sides contribute values and arrive at a shared secret without either side sending it. TLS 1.3 removes RSA key exchange entirely — only ephemeral Diffie-Hellman variants remain.

**Finished** — Both sides send a Finished message: a hash of the entire handshake, encrypted with the derived session key. If either side receives a Finished message it can't verify, the connection aborts. This prevents tampering with the handshake itself.

TLS 1.2 requires two round trips before application data flows. TLS 1.3 requires one.
