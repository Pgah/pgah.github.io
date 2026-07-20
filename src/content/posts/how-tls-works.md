---
title: "How TLS Works"
date: 2026-07-20
description: "The padlock in your browser isn't decoration. It's the result of a cryptographic handshake — and understanding it changes how you think about trust, identity, and what 'secure' actually means."
tags: ["tls", "https", "cryptography", "networking", "fundamentals"]
---

Most people see the padlock in their browser and assume they're safe. They're right — but for entirely the wrong reasons. They trust the outcome without understanding the mechanism. The mechanism is what matters.

TLS is that mechanism. Every time your browser connects to an HTTPS site, a protocol runs underneath — before a single byte of your request is sent — that establishes encryption, verifies identity, and prevents tampering. This is what the padlock actually represents.
