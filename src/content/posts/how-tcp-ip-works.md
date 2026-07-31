---
title: "How TCP/IP Works"
date: 2026-07-31
description: "Every connection you make is built on two protocols working together — one that routes packets across networks that don't know each other, and one that turns an unreliable stream of packets into an ordered, guaranteed conversation."
tags: ["tcp", "ip", "networking", "fundamentals"]
---

People say "TCP/IP" as if it were one thing. It's two, and they do opposite jobs.

The slash hides a division of labor that explains almost everything about how the internet behaves. One protocol gets packets from one machine to another across networks that have never heard of each other and makes no promises they'll arrive. The other takes that unreliable delivery and builds an ordered, guaranteed conversation on top of it. Seeing where one ends and the other begins is what this is about.

## Two Protocols, One Name

**IP** (Internet Protocol) handles **addressing** and **routing**. Its job is to take a packet with a destination address and move it toward that address, one network hop at a time. That's all it does, and it does it on a **best-effort** basis: it will try to deliver your packet, but it guarantees nothing. Packets can be lost, duplicated, delayed, or arrive out of order. IP shrugs at all of this.

**TCP** (Transmission Control Protocol) handles **reliability** and **ordering**. It runs on top of IP and turns that unreliable packet delivery into something you can trust: a stream of bytes that arrives complete, in order, exactly once. Every guarantee you associate with "a connection" comes from TCP, not IP.

The separation is deliberate. IP stays simple so it can run anywhere and route across wildly different networks. TCP holds all the complexity of making that reliable. This is layering: each protocol does one job and trusts the layer below to do its own. Break the connection into these two responsibilities and most of its behavior stops being mysterious.

## IP: Getting Packets There

Every device on a network has an **IP address**. IPv4 addresses look like `140.82.121.4`; IPv6 addresses are longer and written in hex because the internet ran out of IPv4 addresses years ago. The address identifies where a packet should go.

IP breaks data into **packets**, each stamped with a source and destination address. A packet doesn't travel in a straight line. It moves through a series of **routers**, and each router makes one decision: given this destination, which neighbor do I forward this to? No single router knows the whole path. Each one knows only the next hop. The packet is passed hand to hand across networks operated by different companies in different countries until it reaches its destination.

This is why IP is best-effort. A router with a full queue drops packets. A link that goes down forces packets onto a longer path, so a later packet can overtake an earlier one and arrive first. A retransmission somewhere can produce a duplicate. IP does not detect or fix any of this. It moves packets and moves on. Making that chaos reliable is somebody else's problem — and that somebody is TCP.

## TCP: Making It Reliable

TCP takes your stream of bytes and cuts it into **segments**, each carried inside an IP packet. To rebuild the stream correctly on the far side, it adds machinery IP never had.

Every byte gets a **sequence number**. The receiver uses these to reassemble segments in the right order, no matter what order they arrive in, and to discard duplicates. When data arrives, the receiver sends back an **ACK** (acknowledgment) naming the next byte it expects. That acknowledgment is the heart of TCP: it's how the sender learns what got through.

If an ACK doesn't come back in time, the sender assumes the segment was lost and performs a **retransmission**. This is the guarantee — TCP keeps resending until the data is acknowledged, so nothing silently disappears.

Two more mechanisms keep the stream from overwhelming anyone. **Flow control** uses a **window** that tells the sender how much unacknowledged data the receiver can currently buffer, so a fast sender doesn't drown a slow receiver. **Congestion control** does the same thing for the network itself: TCP starts cautiously, speeds up while packets get through, and backs off sharply when it sees loss, treating loss as a signal that the network is overloaded. Most of the internet's ability to share limited capacity without collapsing comes from this single reflex.

## The Three-Way Handshake

Before any data flows, TCP establishes a connection, and it takes exactly three messages.

**1. SYN.** The client sends a segment with the **SYN** (synchronize) flag set and an initial sequence number. This says: I want to talk, and here's where my numbering starts.

**2. SYN-ACK.** The server replies with both **SYN** and **ACK** set. It acknowledges the client's sequence number and sends its own initial sequence number. This says: I heard you, I'm willing, and here's where my numbering starts.

**3. ACK.** The client acknowledges the server's sequence number. Now both sides know both starting points and both know the other is listening. The connection is **established**, and application data can flow.

This is the **three-way handshake**, and it's why every connection has a small fixed cost before the first useful byte moves — one full round trip. Closing is a similar exchange of **FIN** (finish) and **ACK** segments, letting each side signal it's done sending while still receiving. The connection is torn down as deliberately as it was set up.

## Ports and Sockets

An IP address gets a packet to a machine. A **port** gets it to the right program on that machine. Your laptop might hold a dozen connections at once — a browser, an email client, a music stream — all sharing one IP address. Ports keep them apart.

A connection is uniquely identified by four values: source IP, source port, destination IP, destination port. That four-tuple is a **socket** pair, and it's what lets one server on one port (`443` for HTTPS, `22` for SSH) handle thousands of simultaneous clients — each client's source port differs, so each connection is distinct. The `ports` command in this terminal lists the well-known ones and flags the dangerous ones to expose.

## UDP: The Alternative

TCP isn't the only thing that runs on IP. **UDP** (User Datagram Protocol) is the other common choice, and it's TCP with the guarantees removed. No handshake, no sequence numbers, no retransmission, no ordering. You send a **datagram** and hope it arrives.

That sounds worse until you notice what it buys: no setup round trip, no waiting for a lost packet to be resent, no head-of-line blocking. For anything where late data is worse than missing data, that's the right trade. A dropped frame in a video call or a game should just be skipped, not resent seconds later. And **DNS** uses UDP: standard queries go out over UDP port 53 because a lookup is a single small request and answer, and it's cheaper to just ask again than to set up a connection. The DNS article covered how that plays out. TCP guarantees delivery; UDP guarantees nothing and gets out of the way. Both are correct for different jobs.

## What Can Go Wrong

TCP/IP was designed for a cooperative network. Its trust assumptions have consequences.

**SYN floods.** An attacker sends a storm of SYN segments and never completes the handshake. Each half-open connection consumes server resources while it waits for an ACK that never comes. Enough of them and the server can't accept legitimate connections. This is a classic denial-of-service attack, mitigated with techniques like SYN cookies that avoid allocating state until the handshake completes.

**Sequence prediction and spoofing.** Because a connection is identified by its four-tuple and sequence numbers, an attacker who can guess the sequence numbers and forge a source IP can inject data into a connection or forge one outright. Modern stacks randomize initial sequence numbers heavily to make this impractical.

**RST injection.** A single forged segment with the **RST** (reset) flag can tear down a connection. An attacker positioned on the path — or a network operator doing censorship — can kill connections this way without touching the endpoints.

The common thread: TCP guarantees delivery and ordering, but it guarantees nothing about confidentiality or authenticity. It doesn't encrypt, and it doesn't verify who's really on the other end. That gap is exactly why TLS exists — it runs on top of TCP and adds the security TCP was never designed to provide. The TLS article picks up precisely where this one stops.

Every encrypted session, every page you load, every file you transfer begins with that three-message handshake and rides on packets that no single router fully understands. The reliability you take for granted is assembled, byte by byte, on top of a network that promises nothing.
