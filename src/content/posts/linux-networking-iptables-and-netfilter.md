---
title: "Linux Networking: iptables & netfilter"
date: 2026-08-17
description: "Every packet that touches a Linux box passes through a kernel framework most people never see directly. iptables is the interface. netfilter is the machine underneath it — and it's why your server's firewall, NAT, and connection tracking all live in the same place."
tags: ["linux", "networking", "iptables", "security"]
---

The [architecture article](/posts/the-architecture-of-linux) established that the kernel mediates everything a process does, including every packet that enters or leaves the machine. The [NAT article](/posts/how-nat-works) described what your router does to a packet's addresses without saying what mechanism actually performs that rewrite on a Linux box. Both threads meet in the same place: **netfilter**, the kernel's packet-filtering framework, and **iptables**, the userspace tool most commonly used to configure it.

## Netfilter: Hooks in the Packet Path

Netfilter is not a firewall. It's a set of five fixed points — **hooks** — built into the kernel's network stack, each one a place where a packet can be intercepted, inspected, and acted on as it moves through the machine:

- **PREROUTING** — every packet, immediately after it arrives on a network interface, before the kernel decides where it's going.
- **INPUT** — packets whose destination is this machine, after the routing decision.
- **FORWARD** — packets destined for somewhere else, being routed through this machine.
- **OUTPUT** — packets generated locally, before they leave.
- **POSTROUTING** — every outbound packet, right before it hits the wire.

A packet from the network destined for a local process passes PREROUTING, then INPUT. A packet this machine is forwarding to another host passes PREROUTING, then FORWARD, then POSTROUTING, never touching INPUT or OUTPUT at all. A packet a local process is sending out passes OUTPUT, then POSTROUTING. Which hooks a packet passes through is entirely determined by where it came from and where it's going — and that's what makes it possible to write rules that apply only to forwarded traffic, or only to traffic destined for this host, without the two ever overlapping.

Kernel modules can register callbacks at any of these hooks. iptables is one such module — the one that lets you configure those callbacks from userspace as rules instead of C code.

## iptables: Tables and Chains

iptables organizes rules into **tables**, and each table into **chains** that correspond to the netfilter hooks. The three that matter day to day:

- **filter** — the default table, for deciding whether a packet is allowed through. Has `INPUT`, `FORWARD`, and `OUTPUT` chains.
- **nat** — for rewriting source or destination addresses. Has `PREROUTING` (for destination rewrites, since those must happen before routing) and `POSTROUTING` (for source rewrites, since those must happen after routing decides the packet is actually leaving).
- **mangle** — for altering packet headers other than addresses, such as TTL or type-of-service fields. Present at all five hooks.

This is the direct answer to what the NAT article left open: the router's `MASQUERADE` behavior — rewriting a private source address to the router's public address — is an `nat` table rule attached to `POSTROUTING`. The connection tracking table the NAT article described is netfilter's **conntrack**, the same subsystem filter and nat rules both read from when they match on connection state.

Each chain holds an ordered list of rules. A packet is tested against each rule in sequence until one matches. Rules that don't match are skipped; the packet falls through to the next.

## Rules and Targets

A rule has two parts: a **match** (what to look for) and a **target** (what to do when it matches). A minimal example:

```
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
```

`-A INPUT` appends this rule to the filter table's INPUT chain (the default table is assumed). `-p tcp --dport 22` matches TCP packets addressed to port 22. `-j ACCEPT` is the target: let the packet through.

Common targets:

- **ACCEPT** — let the packet continue past this chain.
- **DROP** — discard the packet silently. The sender gets no response and eventually times out.
- **REJECT** — discard the packet, but send back an explicit error (e.g., ICMP port unreachable). The sender fails fast instead of waiting on a timeout.
- **MASQUERADE** — rewrite the source address to the outgoing interface's address, the target behind NAT on a router with a dynamic public IP.
- **LOG** — record the packet to the kernel log and fall through to the next rule; useful for debugging without changing behavior.

When a packet reaches the end of a chain with no rule matching, the chain's **default policy** decides its fate — typically `ACCEPT` or `DROP`. A chain with policy `DROP` and no explicit `ACCEPT` rules blocks everything; this is the standard way to build a deny-by-default firewall.

## A Basic Firewall

A common baseline for a server that should accept SSH and HTTPS but nothing else unsolicited:

```
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -j DROP
```

Read in order: loopback traffic is always allowed (many local services rely on it). Packets belonging to an already-established connection, or related to one, are allowed — this is conntrack again, letting reply traffic back in without a separate rule for every possible source. New connections to ports 22 and 443 are allowed. Everything else falls through to the final rule and is dropped.

The `ESTABLISHED,RELATED` rule matters more than it looks. Without it, you'd need a matching outbound-allow rule for every reply packet a connection generates, which is what made stateless packet filters painful to configure correctly before connection tracking existed.

## Order Is the Whole Model

Because a packet is tested against rules in sequence and stops at the first match, **rule order determines behavior** as much as the rules themselves. A `DROP` rule placed before an `ACCEPT` rule for the same traffic makes the `ACCEPT` rule unreachable. This is a common source of firewall bugs: a rule that looks correct in isolation, placed in the wrong position in the chain, silently does nothing.

This also explains why the default-policy pattern above appends the catch-all `DROP` last: appending puts it at the end of the chain, so every explicit `ACCEPT` rule gets a chance to match before the default takes over.

## nftables: The Successor

Since Linux 3.13, the kernel has shipped **nftables**, a newer framework intended to eventually replace iptables. It uses the same netfilter hooks underneath but replaces the fixed table/chain structure with a more flexible rule syntax and a single unified tool (`nft`) instead of separate binaries for IPv4, IPv6, ARP, and bridging. Most current distributions ship `iptables` as a compatibility layer translated onto nftables rather than the original kernel module.

The concepts carry over directly: hooks, chains, ordered rule matching, and default policies all mean the same thing in nftables. iptables remains worth knowing because it's still what's documented in most existing infrastructure, most tutorials, and most running production configs — but the packet-path model it teaches is the same one nftables, and netfilter itself, actually implement.
