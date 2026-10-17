---
title: "How Load Balancing Works"
date: 2026-10-17
description: "A reverse proxy in front of more than one application server is already a load balancer by accident. This article is about doing that on purpose: the algorithms, the health checks, and the statelessness problem that makes it all work."
tags: ["load-balancing", "networking", "backend", "fundamentals"]
---

The [web servers article](/posts/how-web-servers-work) ended on an observation almost in passing: once a reverse proxy sits in front of more than one application server, it's already distributing requests across them, "round-robin, least-connections, or other strategies." That line does a lot of unstated work. Distributing requests across several machines that each present as a single logical service is its own problem, with its own failure modes, and it shows up again and again at every layer of a distributed system — in front of application servers, in front of database replicas, in front of entire clusters. This article is about what's actually inside that one sentence.

## Layer 4 vs Layer 7: What the Balancer Is Allowed to See

A load balancer's first design choice is how much of the request it looks at before deciding where to send it.

A **Layer 4** (transport-layer) balancer works at the TCP/UDP level: it sees source and destination IP and port, and that's it. It doesn't terminate the connection or parse anything above it — it forwards packets to a chosen backend and gets out of the way. This is fast and cheap, because there's nothing to parse, but it's also blind: it cannot route `/api/*` to one pool of servers and `/static/*` to another, because it never looks far enough into the stream to see a URL path.

A **Layer 7** (application-layer) balancer terminates the connection itself, reads the actual HTTP request — method, path, headers, cookies — and decides where to send it based on that content. This is exactly the reverse-proxy model from the web servers article: nginx accepts the client's connection, parses the request, and opens its own separate connection to whichever backend it picks. That extra layer of indirection costs more CPU per request than blindly forwarding packets, but it buys routing decisions a Layer 4 balancer structurally cannot make: send `/api/*` to the API fleet, send requests carrying a specific cookie to the backend that already has that user's session cached, send everything else to a pool of general-purpose web servers.

Most production setups don't pick one exclusively. A Layer 4 balancer (or an anycast IP, covered below) often sits at the very edge distributing raw connections across several identical Layer 7 proxies, each of which then makes the content-aware decision for the traffic it receives.

## Algorithms: How "Next" Gets Decided

Once the balancer has a pool of healthy backends, it needs a rule for picking one.

**Round-robin** is the simplest: backend 1, then 2, then 3, then back to 1, in a fixed rotation. It's trivial to implement and works well when every backend is equally capable and every request costs about the same amount of work — which is often true, and often not.

**Weighted round-robin** fixes the "equally capable" assumption by giving each backend a weight proportional to its actual capacity, so a bigger machine in a mixed fleet gets proportionally more requests instead of the same one-in-N share as a smaller one.

**Least-connections** fixes the "every request costs the same" assumption instead: it sends the next request to whichever backend currently has the fewest open connections, which naturally routes around a backend that's slow for any reason — a long-running query, a GC pause — without the balancer needing to know why it's slow. This is usually the better default than round-robin for workloads where request cost varies, which in practice is most of them.

**Consistent hashing** picks a backend as a function of something about the request itself — most often the client's IP or a session identifier — hashed into the same bucket every time. The payoff isn't load distribution quality; it's that the same client reliably lands on the same backend without the balancer needing to store a lookup table of who-goes-where. That property turns out to matter for the next problem.

## The Statelessness Problem: Sticky Sessions

The [HTTP article](/posts/how-http-works) covered statelessness as HTTP's defining property: the protocol carries no memory of a client between requests, and whatever memory an application needs, it reconstructs from a cookie on every single request. Load balancing is where that design choice stops being an abstract protocol detail and starts being a load-balancing constraint.

If an application server keeps any per-user state in its own process memory — a session object, an in-progress file upload, a WebSocket connection — then that user's *next* request has to land on the *same* server, or the state simply isn't there. A load balancer that routes purely by round-robin breaks this immediately: request two might land on a server that never saw request one.

**Session affinity** (commonly called **sticky sessions**) is the balancer's answer: pin a given client to the same backend for the duration of their session, typically by hashing their session cookie (consistent hashing again) or by having the balancer itself set a cookie recording which backend it chose. It works, but it reintroduces exactly the kind of state the stateless design was trying to avoid — if that one backend goes down, every session pinned to it goes down with it, and the fleet stops being as interchangeable as it looked.

The alternative, and the one that scales better, is pushing session state out of the application process entirely — into a shared store like Redis, or into the client itself as a signed token, the same idea the [databases article](/posts/how-databases-work)'s connection-pool pattern reflects at a different layer: don't keep expensive or important state somewhere only one process can see it. Once any backend can serve any request because none of them are holding private state, the balancer is free to use the simplest algorithm available, and a crashed backend costs nothing beyond its own in-flight requests.

## Health Checks: Knowing Who's Still Alive

An algorithm is only choosing well if it's choosing from backends that actually work. A **health check** is the balancer periodically asking each backend "are you fine?" — a simple TCP connection attempt, or an HTTP request to a dedicated `/health` endpoint that the application answers only if its own dependencies (its database connection, say) are also reachable.

A backend that fails enough consecutive checks gets marked unhealthy and pulled out of rotation immediately, without waiting for an actual client request to fail against it first. This is what makes a load-balanced fleet survive one machine crashing, mentioned but not explained in the web servers article: the balancer doesn't wait to be told a server is down, it notices on its own, on a short interval, and routes around it until it starts passing checks again.

The design tension is in how aggressive to make the check. Too infrequent, and real users hit a dead backend for the whole interval before it's pulled. Too aggressive, and a backend under heavy-but-legitimate load gets falsely marked dead over a slow-but-eventually-successful health check, making a capacity problem worse by shrinking the pool at exactly the moment it needed more of it, not less.

## Beyond One Proxy: DNS and Anycast

Everything above assumes one load balancer in front of many backends, but at large enough scale the balancer itself becomes the bottleneck, and the same distribution problem recurs one layer up.

**DNS-based load balancing** returns a different IP address to different clients (or rotates through several) for the same hostname, spreading traffic across multiple independent load-balancer front ends before a single packet is sent. It's coarse — DNS answers get cached by resolvers for the duration of their TTL, so it can't react to a backend dying in the next five seconds — but it's nearly free and works at a scale no single machine could handle alone.

**Anycast** goes further: the same IP address is announced from multiple physical locations over BGP, and ordinary internet routing sends each client to whichever announcing location is topologically closest, with no DNS lookup variance involved at all. This is how large CDNs and DNS providers answer from a location near the client without the client's resolver doing anything special — the network itself is the load balancer, one layer below anything discussed so far.

## The Same Shape, One More Layer

A load balancer doesn't solve a new problem — it's the C10K problem from the web servers article, recursed one level outward. There, the question was how one process serves many concurrent connections with a fixed set of threads or an event loop. Here, the question is how one logical service serves many concurrent requests with a fixed set of machines. The algorithm, the health check, and the statelessness requirement all exist for the same reason the event loop and the connection pool did: a finite resource, an unpredictable amount of demand, and a mechanism that has to keep working cleanly as individual pieces of that resource come and go.
