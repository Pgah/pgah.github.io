---
title: "How Certificates & PKI Work"
date: 2026-08-31
description: "TLS uses certificates to prove identity, but never explains what's actually inside one, how it's requested, or what happens when it needs to be revoked before it expires. This is the machinery behind the padlock."
tags: ["pki", "certificates", "cryptography", "tls"]
---

The [TLS article](/posts/how-tls-works) covered the chain of trust at a high level: a certificate authority signs a certificate, the browser checks the signature against a trusted root, and if it checks out, the connection proceeds. That's enough to understand a handshake. It's not enough to understand PKI itself — what's actually encoded inside a certificate, how one gets issued, why revocation is harder than it sounds, and what changes when you run this system privately instead of trusting the public web CAs.

## What a Certificate Actually Contains

A TLS certificate is an **X.509** structure. Stripped to what matters, it's a public key plus a set of claims about that key, signed by whoever is vouching for the claims. `openssl x509 -in cert.pem -noout -text` will dump every field; the ones worth understanding individually:

**Subject** and **Issuer** — who the certificate is for, and who signed it. For a chain of trust, the Issuer of one certificate matches the Subject of the certificate above it, all the way to a self-signed root.

**Subject Alternative Name (SAN)** — the actual list of hostnames the certificate is valid for. Modern browsers ignore the legacy Common Name field entirely and check only the SAN list. A certificate with `SAN: DNS:example.com, DNS:www.example.com` is valid for both; a request for any other hostname fails validation even with an otherwise-perfect chain.

**Validity period** — `notBefore` and `notAfter`. Public certificates have gotten shorter over time specifically to limit the damage window of a key compromise; the industry has been moving toward periods measured in months rather than years.

**Key Usage / Extended Key Usage** — what the key is *allowed* to be used for, enforced by the client, not just documentation. `Key Usage: Digital Signature, Key Encipherment` and `Extended Key Usage: TLS Web Server Authentication` mean this certificate can authenticate a TLS server. A certificate without `serverAuth` in its EKU will be rejected by a browser for HTTPS use even if every other field is valid — this is how CAs prevent a code-signing certificate from also being usable as a web server certificate.

**Signature** — the issuer's signature over everything above, computed with the issuer's private key. This is what a client actually verifies: not "is this data plausible," but "did the private key matching this issuer's public key produce this exact signature over this exact data."

## Getting a Certificate Issued

The server doesn't hand its private key to anyone, including the CA. It generates a keypair locally and sends only the public half, wrapped in a **Certificate Signing Request (CSR)**, to the CA.

```
$ openssl req -new -newkey rsa:2048 -nodes \
    -keyout server.key -out server.csr \
    -subj "/CN=example.com"
```

This produces a private key that never leaves the machine, and a CSR containing the public key plus the requested subject and SAN fields. The CA's job is to verify the request is legitimate and then sign it, producing the certificate. What "verify" means depends on the certificate class:

**Domain Validation (DV)** — the CA confirms only that the requester controls the domain, typically by requiring a specific DNS TXT record or a file placed at a specific HTTP path. This is what Let's Encrypt automates entirely; it says nothing about who runs the domain, only that whoever requested the certificate can modify its DNS or web server.

**Organization Validation (OV)** — the CA additionally verifies the requesting organization is a real, registered legal entity before issuing.

**Extended Validation (EV)** — the strictest tier, involving manual verification of the organization's legal, physical, and operational existence. Browsers used to display the organization name prominently in the address bar for EV certificates; most have removed that UI because the distinction turned out not to communicate what users assumed it did — an EV certificate proves organizational identity was checked, not that the site is safe or the operator is trustworthy.

None of these tiers affect the strength of the encryption. A DV certificate and an EV certificate protect a connection identically; they differ only in what the CA verified before issuing.

## Revocation: CRL vs OCSP

A certificate's `notAfter` date handles expiration, but a private key can be compromised long before that date arrives. Revocation is how a CA says "this certificate should no longer be trusted, regardless of what it claims about itself."

**Certificate Revocation Lists (CRL)** are the older mechanism: the CA periodically publishes a signed list of every revoked certificate's serial number. A client checking revocation downloads the current CRL and checks whether the certificate's serial appears in it. The list only grows, and for a CA with a large user base it can become large enough that downloading it for every connection is impractical.

**Online Certificate Status Protocol (OCSP)** replaced this for most real-time checking: instead of downloading a whole list, the client asks the CA's OCSP responder about one specific certificate and gets back a signed "good," "revoked," or "unknown" answer. This is smaller per-check, but it means the CA learns which sites you're visiting and when — a privacy leak, and a latency and availability dependency on the CA's responder being reachable at connection time.

**OCSP stapling** — mentioned briefly in the TLS article — fixes both problems by having the *server* periodically query its own OCSP status and staple the signed response into the TLS handshake. The client gets the same freshness guarantee without contacting the CA itself, and without the latency of a live lookup on every connection.

Even with all of this, revocation checking is soft-fail in most browsers by default: if the OCSP responder is unreachable, the browser proceeds rather than blocking the connection, because a network hiccup shouldn't take down the entire web. This is a known, deliberate weakness — an attacker who can also block your OCSP traffic can often present a revoked certificate successfully.

## Running Your Own PKI

Public CAs solve trust for the open web, but plenty of infrastructure doesn't need or want a publicly trusted certificate. An internal API that only your own services call doesn't need Let's Encrypt; it needs a private CA whose root you control and distribute only to machines that should trust it.

The mechanics are identical to the public model — a root key signs intermediate keys, intermediates sign end-entity certificates — except the root is never submitted to a public root store. Instead, the root certificate is distributed directly to every client that needs to trust it, typically via configuration management, baked into a container image, or installed into the OS trust store during provisioning.

This is the foundation of **mutual TLS (mTLS)**: in normal TLS, only the server presents a certificate and the client verifies it. In mTLS, the client also presents a certificate, and the server verifies it against a CA it trusts before allowing the connection. This is common between internal services precisely because a private CA makes it practical to issue every service its own client certificate without paying a public CA per-certificate or exposing internal service names in public CT logs.

The tradeoff for running a private CA is that you now own everything a public CA owns: key security, issuance policy, revocation infrastructure, and the operational discipline to rotate the root without an outage. A compromised private root is exactly as catastrophic as a compromised public root — it just affects your infrastructure instead of the internet.

## Where This Differs From SSH's Trust Model

The [SSH article](/posts/how-ssh-works) described SSH's default trust model as **Trust On First Use (TOFU)**: no third party vouches for a host key, the client simply remembers whatever key it saw on the first connection and alerts if it ever changes.

PKI is the opposite design. Trust isn't established by memory of a prior connection; it's established by a signature chain to a party the client already trusted *before* the first connection ever happened. This is why a browser can validate a certificate for a server it has never contacted before, while SSH's TOFU model is specifically vulnerable during exactly that first contact. The cost of PKI's approach is the entire apparatus this article covers — issuance, validation, revocation, root distribution. The cost of TOFU is a blind first connection. Neither is strictly better; they're solving trust bootstrapping for different threat models, and it's worth noticing that SSH *can* run in a PKI-like mode too, using SSH certificates signed by a CA instead of raw host keys, precisely when TOFU's blind-first-connection weakness isn't acceptable at scale.

## What Actually Breaks

Nearly every real-world PKI failure traces back to one of a small number of causes. A private key leaves the machine it was generated on — checked into a public repository, left in a container image, logged somewhere it shouldn't be — and revocation becomes a race against however long it takes an attacker to use it. A CA is compromised or coerced into mis-issuing, as with DigiNotar, and the entire trust model for anyone still trusting that root is retroactively broken. An expired certificate goes unnoticed because nothing was monitoring `notAfter` dates, and a service goes down not because of an attack but because of an unwatched calendar.

None of these are cryptographic failures. The math behind X.509 signatures is not what fails in practice. What fails is key handling, issuance policy, and operational monitoring — which is exactly why understanding what's inside a certificate and how it gets there matters more than trusting the padlock to mean "safe."
