# How TLS Works — Blog Post Spec

**Date:** 2026-07-20  
**File:** `src/content/posts/how-tls-works.md`

---

## Overview

A blog post explaining how TLS/HTTPS works, written in the style of the existing posts on this blog: technical but accessible, chronological narrative, "everyone uses it but nobody looks inside" framing.

Scope: both the TLS handshake (protocol-level) and certificates/PKI trust chain, with TLS 1.2 and 1.3 covered in parallel, ending with attack scenarios and practical defense guidance.

---

## Frontmatter

```
title: "How TLS Works"
date: 2026-07-20
description: "The padlock in your browser isn't decoration. It's the result of a cryptographic handshake — and understanding it changes how you think about trust, identity, and what 'secure' actually means."
tags: ["tls", "https", "cryptography", "networking", "fundamentals"]
```

---

## Structure

### Opening (no header)
Hook: most people see the padlock and think they're safe — they're right, but for the wrong reasons. They know the outcome, not the mechanism. The mechanism is what matters.

### What TLS Actually Is
- Brief history: SSL → TLS, naming confusion
- Transport layer security: operates between TCP and the application
- What it protects (payload) and what it doesn't (IP headers, domain name in SNI, metadata)

### The Problem It Solves
Three distinct problems:
- **Confidentiality** — nobody watching the network can read the data
- **Integrity** — nobody can modify data in transit without detection
- **Authentication** — you're actually talking to the server you think you are

Mirrors the SSH post structure intentionally — the reader may have read that post first.

### The Handshake (TLS 1.2 baseline)
Chronological walkthrough of a browser connecting to an HTTPS site:
1. **ClientHello** — client sends supported TLS versions, cipher suites, a random value
2. **ServerHello** — server picks version and cipher suite, sends its own random value
3. **Certificate** — server sends its certificate (public key + identity claims)
4. **Key Exchange** — client and server establish a shared secret (RSA or DHE depending on cipher)
5. **Finished** — both sides confirm they computed the same keys; data can now flow

TLS 1.2 requires 2 round trips before any application data is sent.

### The Certificate
- What's inside: public key, domain name(s), issuing CA, validity window, signature
- What it proves: the server controls the private key that matches this public key
- What it doesn't prove on its own: that the CA who signed it is trustworthy

### The Trust Chain
- Certificates are signed by a CA — but why trust the CA?
- Root CA → Intermediate CA → End-entity cert (the chain)
- Root stores: browsers and OSes ship with a list of trusted root CAs
- The browser verifies: valid signature chain up to a trusted root, not expired, domain matches
- Where trust breaks: compromised CA, mis-issuance, rogue intermediates (DigiNotar incident is the textbook example)

### TLS 1.3: What Changed
The handshake walkthrough above covers TLS 1.2 as the baseline. TLS 1.3 changes the handshake at a structural level — differences are noted inline in each step above, but consolidated here:
- **1-RTT handshake** — one round trip instead of two; key exchange happens in the first ClientHello
- **0-RTT (early data)** — optional, allows data on first packet; replay attack risk, use carefully
- **Forward secrecy is mandatory** — ephemeral key exchange always; RSA key exchange removed entirely
- **Weak algorithms removed** — no RC4, no SHA-1, no 3DES; cipher suite list reduced from hundreds to 5
- **Simplified negotiation** — version negotiation moved to an extension to prevent downgrade attacks

### What Can Go Wrong
- **Downgrade attacks** — attacker forces negotiation to an older, weaker version (POODLE, BEAST); TLS 1.3 mitigates via downgrade sentinels
- **Rogue certificates** — CA mis-issues a valid cert for a domain it shouldn't; solved partially by Certificate Transparency logs
- **Expired certificates** — connection fails or user bypasses warning; both bad outcomes
- **MITM with installed root** — corporate proxies, malware; the padlock is green but the proxy reads everything
- **Weak cipher suites** — TLS 1.2 servers configured to still accept RC4 or export-grade ciphers

### What Good TLS Looks Like
Practical checklist — what to verify:
- TLS 1.2 minimum, TLS 1.3 preferred; disable 1.0 and 1.1
- Cipher suites: prefer ECDHE for key exchange, AES-GCM or ChaCha20 for encryption
- Certificate: valid chain, not expired, matches domain, issued by a known CA
- HSTS (HTTP Strict Transport Security): forces HTTPS for all future connections
- Certificate Transparency: verify cert is logged (browsers enforce this for publicly-trusted certs)
- OCSP stapling: faster revocation checking without leaking browsing behavior to CA

### Closing (no header)
Return to the padlock. The padlock tells you TLS is active. Understanding TLS tells you what that actually means — and more importantly, what it doesn't guarantee. The certificate can be valid and the connection can still be compromised. Knowing the mechanism is knowing the limits.

---

## Style Notes

- Same tone as existing posts: direct, no fluff, no jargon without explanation
- Bold for key terms on first introduction
- Inline `code` for protocol values, file names, command names only — no code blocks
- No diagrams; prose only
- Target length: 1000–1200 words
- TLS 1.2 vs 1.3: step-by-step differences noted inline in "The Handshake"; structural changes (round trips, removed ciphers, forward secrecy) consolidated in "TLS 1.3: What Changed"

---

## What This Post Is Not

- Not a configuration tutorial (no nginx/Apache config snippets)
- Not a comprehensive PKI reference
- Not a comparison of certificate providers
