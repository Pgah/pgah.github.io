---
title: "How NAT Works"
date: 2026-08-05
description: "IPv4 has around four billion addresses. The internet has more devices than that. NAT is the workaround that bought the internet thirty years — and it shapes every connection you make from home."
tags: ["nat", "networking", "ip", "fundamentals"]
---

The TCP/IP article established that every device on a network needs an IP address, and that a connection is uniquely identified by a four-tuple: source IP, source port, destination IP, destination port. That's true. But there's a problem that this picture glosses over: there aren't enough IP addresses for every device to have a globally unique one, and there haven't been for over a decade.

## The Address Exhaustion Problem

IPv4 addresses are 32 bits wide, which yields approximately 4.3 billion unique values. That number was large in 1981 when the address space was designed. It stopped being large when the internet began expanding beyond research institutions and into homes and mobile devices. **IANA**, the body responsible for allocating address blocks to regional registries, exhausted its free pool in February 2011. The regional registries followed in sequence over the next several years.

The internet didn't stop growing. The workaround that allowed it to keep growing is **Network Address Translation (NAT)** — a technique that allows many devices to share a single public IP address. Your home network probably has a dozen devices on it and exactly one public IP address. NAT is why this works.

## Private Address Space

**RFC 1918**, published in 1996, reserved three address ranges that are never routed on the public internet:

- `10.0.0.0 – 10.255.255.255`
- `172.16.0.0 – 172.31.255.255`
- `192.168.0.0 – 192.168.255.255`

Any router on the public internet that receives a packet with one of these addresses as its destination discards it. These ranges are for private use only. They can be reused in every home network, every office, every data center independently — your `192.168.1.5` and my `192.168.1.5` are completely separate addresses that happen to use the same number because they're in separate private networks.

Your home router has two IP addresses, one on each of its two faces. On the side facing your devices, it has a private IP — often `192.168.1.1` or `10.0.0.1` — acting as the gateway for your local network. On the side facing your ISP, it has a public IP assigned by the ISP, globally routable on the internet. The router is the boundary where NAT happens. Every device on your private network communicates with the internet through that one public address.

## How NAT Translates a Packet

When your laptop at `192.168.1.5:51234` sends a packet to a web server at `93.184.216.34:443`, the packet travels to your router. The router's NAT engine intercepts it and rewrites the source address: it replaces `192.168.1.5:51234` with the router's public IP and a chosen port, for example `203.0.113.1:40001`.

The router records this in its **NAT translation table**: there is now a mapping between `203.0.113.1:40001` (the public-side four-tuple) and `192.168.1.5:51234` (the private-side address). The rewritten packet continues to the web server.

The web server sees a connection from `203.0.113.1:40001`. It doesn't know `192.168.1.5` exists. When it replies, it sends the reply to `203.0.113.1:40001`. The router receives this reply, looks up `203.0.113.1:40001` in its translation table, finds the mapping, rewrites the destination from `203.0.113.1:40001` back to `192.168.1.5:51234`, and forwards the packet to your laptop.

Your laptop receives the reply as if the server had talked to it directly. The server sent a reply without knowing the actual destination. The router, holding the translation table entry, is the only one that knows the full picture — and it's doing this for every active connection on your network simultaneously.

## PAT: One IP, Thousands of Connections

The form of NAT used in home routers is more precisely called **PAT** (Port Address Translation) or **NAPT** (Network Address and Port Translation). It's "many-to-one" NAT: many private addresses mapped through a single public IP, distinguished by port number.

The TCP/IP article explained that a connection's four-tuple — source IP, source port, destination IP, destination port — uniquely identifies it. The router exploits this. By assigning a distinct source port on the public side to each private-side connection, it can route thousands of connections through one IP address. Your laptop connecting on private port 51234 becomes public port 40001; your phone connecting on private port 51235 becomes public port 40002; your TV connecting on private port 51236 becomes public port 40003. All three appear to the internet as `203.0.113.1`, but on different ports.

The translation table maps each public-side port back to the correct private address and port. The router maintains this mapping for every active connection, doing the same rewrite operation for every packet that flows in either direction.

## Connection Tracking

NAT is **stateful**: the router must remember every active mapping to function. It can't treat each packet independently, because knowing how to rewrite a packet requires knowing which connection it belongs to, and that requires state accumulated from previous packets.

For TCP, tracking is natural. TCP has an explicit connection lifecycle — SYN, established, FIN, closed — and the router can track state transitions. When a TCP connection closes cleanly, the router removes the translation table entry. For connections that close uncleanly, a **timeout** cleans them up.

UDP has no connection concept. There's no handshake and no close message. The router handles UDP entirely through timeouts: if no packet matching a translation table entry arrives within a configured window (commonly 30 to 120 seconds), the entry is removed. This is why some applications that use UDP send periodic keepalive packets — not because the protocol requires it, but because they need to keep the NAT entry alive.

This statefulness has a memory cost. A router tracking 50,000 simultaneous connections is maintaining 50,000 table entries, updating them on every packet, and expiring them on timeouts. For a home router handling a few dozen devices, this is manageable. For carrier-grade NAT handling millions of subscribers, it becomes a significant engineering problem.

## What NAT Breaks: The Traversal Problem

NAT works well for **outbound** connections: your device initiates contact, the router creates a translation table entry when it sees the first packet leave, and subsequent reply packets flow back because the entry exists to route them. The server never needs to know or care about the private addresses behind the router.

**Inbound** connections fail by default. If a device on the internet attempts to connect to your public IP, the router receives the packet but finds no translation table entry matching that destination port. No outbound connection created one. The router drops the packet. Every device behind a NAT is effectively unreachable from the internet unless specific configuration says otherwise.

This is the purpose of **port forwarding**: a static rule configured in the router that says "incoming packets to public port 8080 should be delivered to `192.168.1.5:8080`." The rule pre-populates routing information that would normally be created dynamically by an outbound connection. Port forwarding lets you run a server behind NAT, but it requires manual configuration and means one private device owns that public port exclusively.

Peer-to-peer connections are harder still. When both parties are behind NAT — which is nearly universal today — neither can accept an unsolicited inbound packet from the other. **STUN** (Session Traversal Utilities for NAT) addresses this: both peers connect outward to a shared STUN server, which tells each peer the other's public IP and port number (the translated address visible from outside). The peers then attempt **hole-punching**: each sends a packet to the other's public address simultaneously, attempting to create a translation table entry on their own router before the other's packet arrives. If timed correctly, both routers create entries, and both packets flow through. Hole-punching works reliably for most consumer NAT configurations and fails in specific topologies, particularly symmetric NAT where the router assigns different public ports depending on the destination.

Video calling, multiplayer games, and file-sharing applications all implement some version of this or fall back to relaying traffic through a server when direct traversal fails.

## Double NAT

In many regions, ISPs deploy **CGNAT** (Carrier-Grade NAT) at the network level, placing their own NAT layer between the public internet and their customers. The result is double NAT: your devices are behind your router's NAT, and your router's public IP is itself a private address behind the ISP's NAT. From the public internet, your router's public IP is not routable.

Port forwarding on your own router has no effect under CGNAT because the ISP's NAT drops unsolicited inbound traffic at the outer layer regardless. The router's translation table entry is never reached. Anyone who has tried to self-host a server at home and found port forwarding inexplicably broken has often encountered CGNAT without knowing what to call it.

CGNAT multiplies the scale of the statefulness problem: instead of one router tracking tens of thousands of connections, a carrier-grade device tracks millions, with correspondingly higher requirements for memory, processing, and correct timeout behavior.

## Why NAT Persists

NAT is a workaround that became infrastructure. It solved an immediate crisis — IPv4 exhaustion — and in doing so shaped the internet's architecture for decades. Servers became easy to reach because they had stable public IPs; clients became invisible because they were behind NAT; peer-to-peer became a hard problem requiring dedicated protocols to solve.

The actual solution — **IPv6**, with 128-bit addresses providing enough unique values to assign a globally routable address to every device many times over — has existed since 1998. IPv6 makes NAT unnecessary: every device can have a public address, inbound connections work without port forwarding, and STUN and hole-punching are not needed. Adoption has been uneven; NAT's invisibility means users have no direct motivation to push for IPv6, and the operational cost of NAT has been absorbed so thoroughly that many networks treat it as a feature rather than a workaround. The workaround is still load-bearing.
