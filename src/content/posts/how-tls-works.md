---
title: "How TLS Works"
date: 2026-07-20
description: "The padlock in your browser isn't decoration. It's the result of a cryptographic handshake and understanding it changes how you think about trust, identity, and what 'secure' actually means."
tags: ["tls", "https", "cryptography", "networking", "fundamentals"]
---

Most people see the padlock in their browser and assume they're safe. They're right but for entirely the wrong reasons. They trust the outcome without understanding the mechanism. The mechanism is what matters.

TLS is that mechanism. Every time your browser connects to an HTTPS site, a protocol runs underneath before a single byte of your request is sent that establishes encryption, verifies identity, and prevents tampering. This is what the padlock actually represents.

## What TLS Actually Is

TLS stands for Transport Layer Security. It's the successor to SSL (Secure Sockets Layer), a protocol from the 1990s that had fundamental design flaws. Most people still say "SSL" when they mean TLS. The distinction matters less in conversation than in configuration if you're running SSL anywhere, you have a problem.

TLS operates between TCP and the application layer. It doesn't change what you send it wraps it. HTTP becomes HTTPS. The protocol handles encryption, authentication, and integrity. The application above it sends and receives data as normal.

What TLS protects: the payload. The content of your requests and responses.

What TLS doesn't protect: the IP address of the server you're connecting to, which is visible in every packet. With SNI (Server Name Indication), the domain name is also sent in plaintext during the handshake the server needs it to choose which certificate to present. Encrypted Client Hello (ECH) addresses this, but it isn't universally deployed yet.

## The Problem It Solves

Before understanding how TLS works, understand what it has to solve.

You're connecting to a server across a network you don't control. Packets pass through routers, ISPs, cables none of which you own. Someone on any of those paths could read what you send, modify it in transit, or impersonate the server entirely.

TLS has to solve three distinct problems:

**Confidentiality** nobody watching the network can read the data.

**Integrity** nobody can modify data in transit without both sides detecting it.

**Authentication** you're actually talking to the server you think you are, not an impostor.

Solving one or two of these isn't enough. A connection can be encrypted but unauthenticated you're sending secrets to someone, you just don't know who. TLS solves all three.

## The Handshake

When your browser connects to an HTTPS site, before any HTTP request is sent, a handshake happens. This is the cryptographic core where TLS establishes the secure channel.

Here's how TLS 1.2 works:

**ClientHello** The browser sends a list of supported TLS versions, cipher suites it understands (combinations of algorithms for key exchange, encryption, and hashing), and a random value.

In TLS 1.3, the ClientHello also includes key share data. The client makes an educated guess about which key exchange the server will pick and sends its public key material upfront eliminating a round trip.

**ServerHello** The server picks a TLS version and cipher suite from the client's list and sends its own random value. In TLS 1.3, the server's key share data is included here, and the connection is already half-encrypted at this point.

**Certificate** The server sends its certificate: proof of identity. The client uses this to verify it's talking to the right server. More on certificates in the next section.

**Key Exchange** In TLS 1.2 with RSA key exchange, the client generates a pre-master secret, encrypts it with the server's public key, and sends it. Only the server can decrypt it. Both sides derive the session key from this secret and the random values exchanged earlier.

In TLS 1.2 with DHE or ECDHE, key exchange uses Diffie-Hellman: both sides contribute values and arrive at a shared secret without either side sending it. TLS 1.3 removes RSA key exchange entirely only ephemeral Diffie-Hellman variants remain.

**Finished** Both sides send a Finished message: a hash of the entire handshake, encrypted with the derived session key. If either side receives a Finished message it can't verify, the connection aborts. This prevents tampering with the handshake itself.

TLS 1.2 requires two round trips before application data flows. TLS 1.3 requires one.

## The Certificate

The server's certificate is a file containing several things: the server's public key, the domain name(s) it's valid for, an expiration date, the name of the certificate authority (CA) that issued it, and the CA's cryptographic signature over all of it.

What the certificate proves: the server controls the private key matching the public key in the certificate. During the handshake, the server uses its private key to sign data the client can verify. If the signature checks out, the server has the key.

What the certificate doesn't prove on its own: that you should trust it. Anyone can generate a certificate and sign it themselves. The trustworthiness comes from who signed it and whether you trust them.

## The Trust Chain

Certificate authorities are third parties whose job is to verify that an entity controls a domain before issuing a certificate. The CA signs the certificate with its own private key. Your browser verifies that signature.

But why trust the CA? Because your browser and OS ship with a list of root CAs they consider trustworthy the root store. On Windows, this is managed by the OS. On macOS, by Keychain. Firefox maintains its own bundle independently of the OS.

In practice, root CAs don't sign end-entity certificates directly. They use intermediate CAs which they sign and intermediates sign your certificate. This is the chain: root → intermediate → end-entity. The browser verifies every link.

For a certificate to be trusted, the browser checks: the signature chain leads to a trusted root; no certificate in the chain has expired; the domain in the certificate matches the domain you're connecting to; none of the certificates have been revoked.

Where trust breaks: a compromised or malicious CA. In 2011, DigiNotar a Dutch CA was breached. Attackers issued valid certificates for domains including google.com. Any browser trusting DigiNotar's root would accept these as legitimate. DigiNotar was removed from all root stores. The damage was done.

Certificate Transparency (CT) is the response. Since 2018, browsers require that publicly-trusted certificates appear in public CT logs. This doesn't prevent mis-issuance, but it makes it detectable after the fact.

## TLS 1.3: What Changed

The handshake section above treats TLS 1.2 as the baseline. TLS 1.3 changes it structurally. Step-by-step differences were noted inline; here's the consolidated picture.

**1-RTT by default** The client sends key share data in the ClientHello. The server responds with its key share in the ServerHello. Both sides derive the session key immediately. Application data follows in the next message. One round trip instead of two.

**0-RTT (early data)** On a resumed connection, TLS 1.3 allows the client to send application data in the very first message, before the handshake completes. Faster, but 0-RTT data is vulnerable to replay attacks. An attacker who captures that first message can resend it. Use only for idempotent requests.

**Forward secrecy is mandatory** TLS 1.3 removes RSA key exchange. Only ephemeral Diffie-Hellman variants are allowed. Session keys are derived from values discarded after the session ends. Someone who records your encrypted traffic today and obtains the server's private key years later still can't decrypt it. In TLS 1.2 with RSA key exchange, they could.

**Weak algorithms removed** RC4, 3DES, SHA-1 for signatures, and export-grade cipher suites are gone. TLS 1.3 has five cipher suites; all are strong. TLS 1.2 had hundreds of options, many of which existed only to be exploited.

**Downgrade protection built in** When a TLS 1.3 server downgrades to TLS 1.2 for compatibility, it embeds a sentinel value in the ServerHello's random field. A TLS 1.3 client that sees this knows a downgrade occurred and can abort the connection if unexpected.

## What Can Go Wrong

Understanding TLS means understanding where it fails.

**Downgrade attacks** An attacker in the middle manipulates the handshake to force both sides to negotiate an older, weaker version or cipher suite. POODLE (2014) exploited this against SSL 3.0. BEAST (2011) against TLS 1.0. The fix: disable old versions server-side. TLS 1.0 and 1.1 are deprecated. If your server still accepts them, it's a problem.

**Rogue certificates** A CA issues a valid certificate for a domain it shouldn't. This is how DigiNotar's breach played out. The certificate is cryptographically valid; the browser has no built-in mechanism to detect mis-issuance without CT logs. Browsers now enforce CT log inclusion for publicly-trusted certificates.

**Expired certificates** The connection fails with an error, and users click through the warning. Now you have an authenticated, encrypted connection to a server the user explicitly decided to distrust. Expiry is an operational failure with security consequences.

**MITM with an installed root** Corporate proxies, parental controls, and malware use the same technique: install a custom root CA in the device's root store, then intercept TLS connections by presenting their own certificates. The padlock shows green. The proxy reads everything. This is legitimate for enterprise security monitoring. It's also how certain malware families operate. The padlock tells you TLS is active it doesn't tell you whose root you're trusting.

## What Good TLS Looks Like

Knowing how TLS works means being able to evaluate whether a server is doing it right.

**Version** TLS 1.2 minimum. TLS 1.3 preferred. Disable TLS 1.0 and 1.1. Anything older is indefensible.

**Cipher suites** For TLS 1.2: ECDHE for key exchange, AES-128-GCM, AES-256-GCM, or ChaCha20-Poly1305 for encryption. No RC4, no 3DES, no CBC mode paired with SHA-1. For TLS 1.3: all five supported suites are acceptable; the protocol enforces this for you.

**Certificate** Valid chain to a trusted root, not expired, domain matches. Include the intermediate CA in the server response some servers omit it and rely on clients to fetch it, which fails in restricted environments.

**HSTS** HTTP Strict Transport Security. The server instructs the browser: for the next N seconds, only connect to this domain over HTTPS and reject any connection that fails TLS validation. This closes the window where an attacker intercepts the initial HTTP request before it redirects to HTTPS.

**OCSP Stapling** Certificate revocation tells browsers a cert is no longer valid before it expires. Without stapling, the browser contacts the CA directly leaking browsing behavior and adding latency. With stapling, the server includes a signed, time-limited OCSP response in the handshake. Faster and more private.

To check a server: `openssl s_client -connect domain:443` shows what gets negotiated. Replace `domain` with the actual hostname.

The padlock tells you one thing: TLS is running. It doesn't tell you which version, which cipher suites, whether the CA that signed the certificate is trustworthy, or whether someone has installed a root on your device.

Understanding TLS tells you all of that and more importantly, what it doesn't guarantee. A valid certificate means a server controls a private key. It means a CA vouched for the domain. It means your connection is encrypted and authenticated against a specific trust chain.

That's meaningful. It's not the same as safe.
