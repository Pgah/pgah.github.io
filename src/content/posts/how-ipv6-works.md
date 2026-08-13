---
title: "How IPv6 Works"
date: 2026-08-14
description: "IPv6 has been the official answer to address exhaustion since 1998, and most of the internet still runs without it. It isn't IPv4 with longer addresses — it's a different set of assumptions about how hosts find each other."
tags: ["ipv6", "networking", "ip", "fundamentals"]
---

The [NAT article](/posts/how-nat-works) ended on an uncomfortable observation: the real fix for IPv4 address exhaustion was standardized in 1998, and the internet mostly kept using the workaround instead. That fix is **IPv6**. It is often described as "IPv4 with bigger addresses," which is true in the same way that a city is a village with more people. The size change is real, but what actually matters is everything that changed because of it — how hosts get configured, how routers handle packets, how neighbors find each other on a link, and what a firewall is now responsible for.

## The Size of the Address Space

An IPv4 address is 32 bits, giving roughly 4.3 billion values. An IPv6 address is 128 bits. That is not four times bigger; it is 2^96 times bigger — around 340 undecillion addresses, a 39-digit number.

Numbers at that scale stop being intuitive, so the useful way to think about it is structural rather than numeric. In IPv6, the smallest subnet handed to a normal network is a **/64** — meaning 64 bits identify the network and 64 bits identify the interface within it. A single one of those subnets contains 18 quintillion addresses, which is more than four billion times the entire IPv4 internet. And a residential customer is typically not given one /64; they are given a /56 or a /48, which is 256 or 65,536 of those subnets.

The design intent is that addresses stop being scarce enough to ration. Nobody counts them, nobody shares them, and no device needs to hide behind another device's address to reach the network.

## Reading an Address

IPv6 addresses are written as eight groups of four hexadecimal digits separated by colons, each group representing 16 bits:

`2001:0db8:0000:0000:0000:ff00:0042:8329`

Two rules make this readable. Leading zeros in a group can be dropped, and one run of consecutive all-zero groups can be replaced with a double colon. Applying both gives:

`2001:db8::ff00:42:8329`

The double colon may appear **only once** in an address, because the parser reconstructs the missing groups by counting how many are present — with two of them, the expansion would be ambiguous. The loopback address, IPv6's equivalent of `127.0.0.1`, compresses all the way down to `::1`, and the unspecified address is just `::`.

One practical consequence: because colons already appear in addresses, a URL has to wrap the address in square brackets so the port separator stays unambiguous — `http://[2001:db8::1]:8080/`. This trips up a lot of code that was written assuming addresses never contain colons, and it is one of the more common places IPv6 support quietly breaks in software.

## Types of Addresses

IPv4 has unicast, broadcast, and multicast. IPv6 removed broadcast entirely and expanded the rest.

**Global unicast** addresses are the publicly routable ones, currently allocated out of `2000::/3`. These are the IPv6 equivalent of a public IPv4 address, except that ordinary client devices routinely have them.

**Link-local** addresses, from `fe80::/10`, are the significant addition. Every IPv6-capable interface configures one automatically the moment it comes up, before any router is involved and regardless of whether the network is functioning. These addresses are valid only on the local link and are never routed. Much of IPv6's own machinery — neighbor discovery, router advertisements, routing protocol adjacencies — runs over link-local addresses, which means the protocol can bootstrap a working link without any external configuration existing yet.

**Unique local** addresses, from `fc00::/7` (in practice `fd00::/8` with a randomly generated global ID), are the analog of IPv4's RFC 1918 private ranges. They are not routed on the public internet and exist for networks that need stable internal addressing independent of whatever prefix the ISP is currently delegating. The random global ID makes accidental collisions during a merger unlikely, which was a chronic annoyance with everyone using `10.0.0.0/8`.

**Multicast** addresses, from `ff00::/8`, replace broadcast. Instead of interrupting every host on the segment, traffic goes to a group that interested hosts join: `ff02::1` reaches all nodes on the link, `ff02::2` reaches all routers. The replacement matters more than it sounds — an IPv4 ARP broadcast wakes every machine on the segment, while IPv6's equivalent targets a **solicited-node multicast** group derived from the last 24 bits of the address being looked up, so typically only the intended host's network card processes it.

## Getting an Address Without a Server

IPv4 hosts normally get their configuration from a DHCP server. IPv6 can use DHCPv6, but the default mechanism is **SLAAC** (Stateless Address Autoconfiguration), and it requires no server holding any state at all.

When an interface comes up, it forms its link-local address and sends a **Router Solicitation** to the all-routers multicast group. Any router on the link replies with a **Router Advertisement** containing the prefix in use on that link, the router's own link-local address as the default gateway, and flags describing how the host should configure itself. Routers also send these advertisements periodically without being asked.

The host takes the advertised /64 prefix, generates its own 64-bit interface identifier, concatenates the two, and now has a globally routable address. No server assigned it, no lease exists, and nothing needs to remember the allocation. This is what "stateless" means here.

Before using the address, the host runs **Duplicate Address Detection**: it sends a Neighbor Solicitation for its own prospective address and waits briefly. If anything answers, the address is in use and must not be claimed. Given a 64-bit host space, a collision essentially never happens — but the check is mandatory rather than optional, because "essentially never" is not the same as never.

The original method for generating the interface identifier, **EUI-64**, derived it from the interface's MAC address. That was deterministic and convenient, and it also embedded a hardware serial number into every packet a device sent, making a laptop trackable across every network it ever joined. **Privacy extensions** replaced this with randomly generated identifiers that rotate over time, and they are now the default on every mainstream operating system. A modern host typically holds several IPv6 addresses at once: a link-local one, a stable one, and a rotating temporary one used for outbound connections.

## Neighbor Discovery Replaces ARP

IPv4 resolves an IP address to a hardware address using **ARP**, a protocol that sits beside IP rather than on top of it. IPv6 folds that job into **NDP** (Neighbor Discovery Protocol), which runs over **ICMPv6**.

NDP handles more than address resolution. It covers router discovery, prefix discovery, next-hop determination, duplicate address detection, and **Neighbor Unreachability Detection** — an ongoing check of whether a neighbor that was reachable a moment ago still is. IPv4 had no real equivalent, which is why a machine could keep sending traffic to a stale ARP entry long after the destination stopped answering.

The consequence to remember is that ICMPv6 is not optional. In IPv4 it became common practice to block ICMP wholesale at the firewall, and the network kept working. Do the same to ICMPv6 and the link stops functioning: neighbors cannot be resolved, routers cannot be discovered, and path MTU discovery silently fails. IPv6 firewall rules have to permit the ICMPv6 types the protocol depends on, and getting this wrong produces failures that look like routing problems rather than filtering problems.

## A Simpler Header

The IPv6 header is fixed at 40 bytes. The IPv4 header was variable — 20 to 60 bytes — with options that routers had to parse on every hop.

Three removals stand out. There is **no header checksum**, because the link layer below and the transport layer above both already verify integrity, and recomputing a checksum at every hop was pure overhead. There are **no fragmentation fields**, because routers are forbidden from fragmenting IPv6 packets; if a packet is too large for the next link, the router drops it and returns an ICMPv6 "Packet Too Big" message, leaving the sender to discover the path MTU and adjust. And options moved out of the header entirely into **extension headers**, chained together with a Next Header field, so a router forwarding normally never touches them.

The result is a header a router can process in a fixed number of steps. IPv6 also guarantees a minimum MTU of 1280 bytes on every link, which gives path MTU discovery a floor it can rely on — as long as those ICMPv6 messages are allowed through.

## Living Alongside IPv4

There was never a switchover date, and there was never going to be one. The two protocols are not compatible: an IPv6-only host cannot talk directly to an IPv4-only server, because there is no way to express an IPv6 source address in an IPv4 packet.

The dominant strategy is **dual stack** — hosts run both protocols simultaneously, use IPv6 where it is available, and fall back to IPv4 where it is not. This works, at the cost of operating two networks with two sets of routing tables and two sets of firewall rules. Early dual-stack deployments produced a distinctive failure: a host with a broken IPv6 path would try IPv6 first, hang until the connection timed out, then retry over IPv4, making IPv6-enabled networks feel slower than IPv4-only ones. **Happy Eyeballs** fixed this by starting both attempts nearly in parallel and using whichever completes first, so a broken path costs milliseconds instead of seconds.

For networks that have gone IPv6-only — most large mobile carriers, among others — **NAT64** and **DNS64** bridge the gap. DNS64 synthesizes an IPv6 answer for an IPv4-only destination by embedding the IPv4 address inside a designated prefix; NAT64 then translates at the network edge. It is address translation again, which is a fitting irony, but this time it lives in one place at the carrier rather than in every home.

## What Changes for Security

The most important shift is that NAT is gone, and with it an accident that many networks had been depending on. NAT never was a firewall, but it behaved like one: inbound connections failed by default because no translation entry existed for them. Under IPv6, every host can have a globally routable address, and reachability is decided by firewall policy rather than by a side effect of address scarcity. A network that relied on NAT for inbound protection and then enables IPv6 without writing explicit rules has exposed every device on it.

Scanning changes shape too. Sweeping an IPv4 /24 takes seconds; sweeping a single IPv6 /64 is not possible in any practical sense. Attackers therefore stop scanning and start enumerating — mining DNS records, certificate transparency logs, and traffic logs for addresses that are known to exist. Obscurity is real here but narrow, and it does nothing for a host whose address has ever appeared in public data.

The link-local layer introduces its own exposure. Because SLAAC trusts Router Advertisements, anything on the segment that can send one can nominate itself as the default gateway, which is a straightforward path to intercepting traffic. Switches mitigate this with **RA Guard**, dropping advertisements from ports where no router should exist. And the most common real-world mistake is subtler than any of these: a dual-stack host with carefully maintained IPv4 firewall rules and an IPv6 stack nobody configured, quietly reachable over a path the rules never covered.

## The Long Transition

IPv6 is now roughly half of the traffic reaching the large content networks, carried mostly by mobile operators and residential ISPs that ran out of IPv4 addresses and had no alternative. That number rose slowly and mostly without anyone noticing, which is exactly what a successful protocol transition looks like from the outside.

What made it slow was never technical difficulty. It was that NAT worked well enough that no individual network operator felt urgency, while the cost of migrating was concrete and immediate. The internet solved its address shortage twice — once properly and once with a workaround — and then spent almost three decades letting the workaround carry the load. Both answers are still running, side by side, in every packet your machine sends.
