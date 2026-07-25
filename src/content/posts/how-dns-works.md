---
title: "How DNS Works"
date: 2026-07-25
description: "You type a name. The network only speaks in numbers. Between those two facts is a distributed system running on thousands of servers with no central authority, and it's queried before every connection you make."
tags: ["dns", "networking", "fundamentals", "security"]
---

Everyone calls DNS the phone book of the internet. That metaphor is wrong in ways that matter.

A phone book is static, centralized, and consulted once. DNS is distributed, hierarchical, cached, and queried billions of times per second across a system with no single point of control. Understanding why it works that way, and what that means for security and privacy, is what this is about.

## What DNS Actually Is

DNS stands for Domain Name System. Its job: translate human-readable names into IP addresses.

When you type `github.com`, your machine doesn't know where that is. The network only speaks IP addresses. Something has to bridge the gap between the name you type and the address the network needs. DNS is that thing.

The "system" part is important. DNS isn't a server. It's a protocol and a distributed database spread across thousands of servers worldwide, organized into a strict hierarchy, with rules about delegation, caching, and authority. No single organization controls all of it. That's by design.

## The Hierarchy

DNS is organized as a tree, read right to left.

At the top is the **root zone**, represented by a dot you almost never see. Below that are **top-level domains** (TLDs): `.com`, `.net`, `.org`, `.tr`, and hundreds more. Below TLDs are **second-level domains** like `github.com`. Below those, **subdomains**: `api.github.com`, `mail.github.com`.

Each level is managed by different organizations. ICANN oversees the root and accredits registrars. Verisign operates the `.com` TLD zone. GitHub controls `github.com` and its subdomains. When you register a domain, you get to add records in your zone without asking anyone above you.

This is **delegation**. Your registrar tells the `.com` servers: for `yourdomain.com`, ask these name servers. Those name servers are then authoritative for your zone. The hierarchy exists so queries can be routed without any single server needing to know everything.

The root zone is served by 13 named root server clusters (a through m). In practice, hundreds of physical servers worldwide use anycast routing to respond to those 13 addresses. There is no single root server. There are hundreds, all returning the same answers.

## A Query, Step by Step

You type `github.com` in your browser. Here's what happens.

**1. Local cache check.** Your OS checks its DNS cache. If it has a recent answer with a valid TTL, it returns it immediately. No network query needed.

**2. Stub resolver asks the recursive resolver.** Your OS has a configured DNS resolver, usually your router or your ISP's server, or one you've set manually like `8.8.8.8`. This is called the **recursive resolver**. Your machine sends it a question: what's the IP for `github.com`?

**3. Recursive resolver checks its own cache.** If it answered this recently, it returns the cached result. If not, it starts the resolution process from the top.

**4. Query the root.** The recursive resolver asks a root server: who handles `.com`? The root doesn't know the final answer. It returns a referral: ask the `.com` TLD servers. Here are their addresses.

**5. Query the TLD.** The recursive resolver asks the `.com` TLD server: who handles `github.com`? The TLD server returns another referral: ask GitHub's name servers. Here they are.

**6. Query the authoritative server.** The recursive resolver asks GitHub's authoritative name server: what's the IP for `github.com`? This server knows. It returns the answer.

**7. Return and cache.** The recursive resolver returns the answer to your machine and caches it for the duration of the TTL. Your OS caches it too. The browser connects to the IP.

The whole process takes 20-120ms on a cold start. Cached responses are essentially instant. Most queries you make in a browser session never leave the cache.

## Caching and TTL

Every DNS record has a **TTL** (Time To Live), measured in seconds. It tells resolvers how long to cache the answer before asking again.

TTL is a trade-off. Low TTL means changes propagate quickly but generate more queries and more latency. High TTL means fast, cached responses but slow propagation when you change something.

Common values: `300` (5 minutes) for records you change often, `3600` (1 hour) for stable records, `86400` (24 hours) for things like MX records on established domains that almost never change.

**Negative caching** also exists. If a domain doesn't have a record you queried for, that non-existence is cached too. Resolvers don't ask again until the negative TTL expires.

The practical implication: if you're about to change a DNS record for something important, lower the TTL well in advance. If you lower it from `86400` to `300`, you have to wait up to 24 hours for the old TTL to expire everywhere before the short TTL takes effect. Lower it, wait, then make the change.

## Record Types

DNS isn't only IP addresses. The system stores different types of records:

**A** maps a name to an IPv4 address. `github.com → 140.82.121.4`.

**AAAA** maps a name to an IPv6 address. Same idea, different address family.

**CNAME** creates an alias. `www.github.com → github.com`. The resolver follows the chain until it hits an A or AAAA. You can't use a CNAME at the zone apex (the root of your domain) because of conflicts with other records; some DNS providers work around this with proprietary flattening.

**MX** identifies mail servers for the domain. Has a priority value so multiple mail servers can be listed in failover order.

**NS** identifies the authoritative name servers for a zone. This is how delegation works: the `.com` TLD zone has NS records pointing to GitHub's name servers.

**TXT** stores arbitrary text. Used for SPF, DKIM, and DMARC records (email authentication), domain ownership verification, and anything else that needs to be publicly accessible without a dedicated record type.

**PTR** is reverse DNS: maps an IP address back to a name. Used by mail servers to check if an IP resolves to a name matching its claimed identity, and in network logging and diagnostics.

## What Can Go Wrong

DNS was designed in the early 1980s for a cooperative, academic internet. Security wasn't a design consideration. That shows.

**Cache poisoning.** A recursive resolver caches what it's told. If an attacker can inject a false record into a resolver's cache before the legitimate answer arrives, every user of that resolver gets sent to the wrong IP for the duration of the TTL. In 2008, Dan Kaminsky discovered a fundamental flaw in how DNS transaction IDs worked that made this practical at scale. His attack could poison a recursive resolver's cache for any domain in seconds. The emergency fix was source port randomization, increasing the entropy an attacker had to guess. The structural fix is DNSSEC.

**DNS hijacking.** An attacker who controls a resolver or the path between you and one can return whatever answers they want. ISPs in some countries do this intentionally for filtering. Malware does it by changing your configured resolver to one the attacker controls. The result is indistinguishable from legitimate DNS at the protocol level: you get an answer, you connect to an IP. The answer just happens to be wrong.

**DNS amplification.** Certain DNS queries return much larger responses than the query itself. Attackers send queries with a forged source IP (the victim's address) to open resolvers. The resolvers send their large responses to the victim. The result is a DDoS amplification attack using DNS as the amplifier. The fix: rate limiting and restricting which clients a resolver responds to.

## DNSSEC

DNSSEC (DNS Security Extensions) adds cryptographic signatures to DNS records. An authoritative server signs its records with a private key. Resolvers verify the signatures using the corresponding public key, which is published in the DNS hierarchy itself.

The trust chain mirrors the DNS hierarchy. The root zone is signed. The root's public key is published and known. TLD operators sign their zone and publish their key signed by the root. Domain operators sign their zones and publish their keys signed by the TLD. A resolver doing DNSSEC validation verifies the entire chain from root to answer.

What DNSSEC solves: an attacker can't inject false records without breaking the signatures. Cache poisoning against a DNSSEC-signed domain fails because the forged record won't validate.

What DNSSEC doesn't solve: it doesn't encrypt queries. It doesn't protect privacy. It doesn't prevent blocking DNS responses entirely. It authenticates that the answer came from the legitimate zone operator. That's it, and that's important.

Why adoption is incomplete: DNSSEC is operationally complex. Key management requires generating keys, rotating them on schedule, maintaining the signing chain during rotation, and handling emergencies without breaking resolution. A mistake in the signing process breaks the domain for DNSSEC-validating resolvers. Many organizations decide the operational risk outweighs the benefit for their threat model. Roughly 30-40% of DNS queries globally are DNSSEC-validated. Coverage varies widely by country and infrastructure.

## Encrypted DNS: DoH and DoT

Standard DNS queries are sent in plaintext over UDP port 53. Anyone watching the network sees every domain you query. Your ISP, anyone on the same Wi-Fi, any router in the path.

This is a surveillance problem even when content is encrypted. The TLS article covered how HTTPS encrypts the payload of your requests. DNS reveals the domain names you're visiting even when the pages themselves are not readable. The metadata is exposed regardless.

**DNS over TLS (DoT)** wraps DNS queries in a TLS connection, using port 853. Query content is encrypted. That you're doing DNS at all is still visible because of the distinctive port.

**DNS over HTTPS (DoH)** sends DNS queries inside HTTPS on port 443. Encrypted and visually indistinguishable from normal HTTPS traffic. This is what Firefox and Chrome use when they implement their own DNS resolution, bypassing the OS resolver.

What both protect: individual queries are hidden from network observers between you and the resolver.

What neither changes: your resolver still sees every query you make. If you use `8.8.8.8`, Google has that data. If you use your ISP's DoH endpoint, your ISP has it. The observation moves; it doesn't disappear. Trusting a DoH provider requires the same analysis as trusting any service: who they are, what they log, what jurisdiction they operate in.

There's also a real tension with network management. Enterprise environments, parental controls, and security monitoring often rely on DNS visibility or interception to function. A browser doing DoH bypasses all of that. Some networks block known DoH endpoints for this reason. The privacy benefit to users is a control problem for network administrators. Both perspectives are legitimate and depend on context.

## What DNS Doesn't Protect

Even with DNSSEC and encrypted DNS, things are still visible.

The IP addresses you connect to remain visible even when DNS is encrypted, because TLS and the network layer are separate. Correlating IPs to domains is often straightforward. Many services consolidate on a handful of IPs; many IPs serve only one domain.

DNS queries reveal behavioral patterns. Knowing which domains are queried and when tells a lot about what someone is doing, without ever reading page content or URLs.

The TLS article noted that SNI (Server Name Indication) exposes the domain name you're connecting to in plaintext during the TLS handshake, even when DNS is encrypted. An observer who can't see your DNS queries often can still see your TLS connection initiation. Encrypted Client Hello (ECH) addresses this, but deployment is limited.

The resolver is a chokepoint. Whether or not the path between you and it is encrypted, the resolver knows everything you asked. DNS privacy requires an encrypted path and a resolver you have reason to trust. One without the other is partial at best.

DNS is foundational. Every connection starts with a name resolution. That makes it a persistent point of visibility, a common attack surface, and an infrastructure decision with real security implications.

The query you never think about is often the first one that matters.
