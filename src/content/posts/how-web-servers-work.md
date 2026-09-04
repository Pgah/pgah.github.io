---
title: "How Web Servers Work"
date: 2026-09-04
description: "A web server is a process that never stops listening. Everything else — routing, concurrency, reverse proxies — exists to answer one question at scale: what happens between a socket accepting a connection and a response leaving it?"
tags: ["web-servers", "http", "backend", "fundamentals"]
---

Strip away the frameworks and a web server is a strange kind of program: it has no fixed input and no natural end. It starts, opens a socket, and then waits — sometimes for milliseconds, sometimes for hours — for a stranger's TCP connection to arrive. The [HTTP article](/posts/how-http-works) covered what flows through that connection once it's open: a request, a response, a stack of headers. This one is about the process on the other end — the thing that has to be listening before any of that conversation can happen, and that has to keep listening for the next one immediately after.

## Listening: A Socket Waiting for Work

A web server's first act is to bind a **socket** to a port — 80 for HTTP, 443 for HTTPS — and call `listen()` on it. From that moment, the operating system queues incoming TCP connection attempts on that port and hands them to the process one at a time through `accept()`. This is the layer beneath everything: the TCP three-way handshake from the TCP/IP article has already completed by the time `accept()` returns a usable connection. The web server didn't do that work — the kernel did — but it's the one that has to call `accept()` in the first place, and how often it calls it, and what it does between calls, is most of what distinguishes one web server's design from another's.

A single `accept()` returns one connection. A production server needs to do this thousands of times a second without letting a slow connection block the next one from being accepted. That constraint — stay responsive to new connections while an unknown number of existing ones are still being served — is the problem every concurrency model described below exists to solve.

## Static vs Dynamic: Two Different Jobs Wearing One Name

"Web server" covers two genuinely different jobs that got the same name for historical reasons. A **static** request asks for a file that already exists on disk — an image, a stylesheet, a prebuilt HTML page — and the server's job is to read it and write its bytes back over the socket, as fast as the disk and network allow. There's no computation involved beyond that, which is why static file serving is the one job a bare web server like nginx does natively and extremely fast.

A **dynamic** request asks for something that has to be computed — a page assembled from a database query, a JSON response from an API. Nginx and Apache don't generate that themselves; they hand the request off to an **application server** — a separate process running your actual code (Node, Django, Rails, a Java servlet container) — get a response back, and forward it to the client. The historical name for that handoff is **CGI** (Common Gateway Interface), the original 1990s protocol for "web server, run this external program and send me what it prints." Modern equivalents (WSGI in Python, Rack in Ruby, the reverse-proxy handoff in Node setups) are faster and longer-lived than spawning a fresh process per request, but the shape of the handoff — web server receives, delegates, forwards the result — hasn't changed.

## The Request Lifecycle

Put the pieces in order and a single request's path through the system looks like this: the kernel accepts a TCP connection and hands it to the server process. The server reads bytes off the socket until it has a complete HTTP request — the request line, headers, and body described in the HTTP article — and parses it. **Routing** matches the request's method and path against a table of handlers: `GET /users/42` might match a pattern like `GET /users/:id` and dispatch to the code registered for it. That handler runs — reads a database row, renders a template, whatever the application does — and produces a response: a status line, headers, a body. The server writes that response back over the same socket, and either closes the connection or, far more often today, keeps it open for the next request.

That last detail matters more than it looks. **Keep-alive** connections let a client send multiple requests over one TCP connection instead of paying for a new handshake every time, which is why a server has to track many open-but-idle connections simultaneously, not just many active requests. A connection sitting open with nothing being sent on it still costs a file descriptor and some memory, even while doing no work at all — and that idle cost is exactly what the concurrency model has to be built to absorb cheaply.

## The C10K Problem and Three Ways to Answer It

In the late 1990s, "how does a single server handle ten thousand concurrent connections" was an open problem — the **C10K problem** — because the obvious approach didn't scale, and the alternatives took years to become the default.

**Process-per-connection** is the obvious approach: fork a new operating system process for every incoming connection. Apache's original **prefork** model works this way (with a pool of pre-forked workers to avoid the fork cost per request). It's simple and extremely robust — one connection's process crashing can't corrupt another's memory — but each process carries real overhead in memory and context-switching cost, so it stops scaling well somewhere in the low thousands of concurrent connections.

**Thread-per-connection** is the same idea with threads instead of processes: cheaper to create and switch between than full processes, sharing memory within one process. It scales further than prefork but still hits a wall — thousands of threads still means thousands of stacks in memory and a scheduler doing real work to time-slice between them, most of which are just sitting idle waiting on a slow client or a slow database.

**The event loop** is the answer that actually solved C10K. Instead of one thread per connection, a single thread (or a small, fixed pool of them) holds many connections open at once and uses an OS mechanism — `epoll` on Linux, `kqueue` on BSD — to ask the kernel "which of these hundred sockets actually have data ready right now?" instead of checking each one or blocking a whole thread on each. The thread only does work on a connection when there's actually something to do; an idle keep-alive connection costs almost nothing beyond the memory to track it. Nginx and Node.js are both built this way, and it's the direct reason nginx can hold tens of thousands of idle keep-alive connections that would sink a prefork model outright. The trade-off is that a single slow, CPU-bound handler blocks the one thread processing everyone else's events — which is why event-loop servers push slow computation onto worker threads or separate processes rather than doing it inline.

None of these three eliminated the others. Modern deployments frequently combine them: an event-loop reverse proxy in front of a pool of prefork or threaded application workers, each model doing the part it's actually good at.

## Reverse Proxies: A Server in Front of the Server

A **reverse proxy** — usually nginx — sits between the internet and your actual application servers, forwarding requests to them and returning their responses to the client, who never talks to the application server directly. This isn't redundant layering for its own sake; it separates two jobs that want different designs. The reverse proxy, built on an event loop, is extremely good at holding open thousands of slow client connections, serving static files straight from disk, and terminating TLS once at the edge instead of in every application process. The application servers behind it can then be simpler — no need to handle slow clients or raw socket management — and there can be several of them.

That last point is what makes a reverse proxy a **load balancer** almost for free: with more than one application server behind it, the proxy distributes incoming requests across them — round-robin, least-connections, or other strategies — which is also how a fleet of servers survives one of them crashing: the proxy just stops sending it traffic. The reverse proxy becomes the one thing exposed to the internet, and everything behind it can scale horizontally without the client ever knowing more than one machine exists.

## Where the Database Fits

A dynamic handler that needs data doesn't get a free pass on the concurrency problem — it hands it straight to the layer below. The [databases article](/posts/how-databases-work) covered what a database guarantees once you're connected to it; opening that connection is itself expensive enough that no server opens a fresh one per request. Instead, application servers keep a **connection pool** — a fixed set of already-open database connections, checked out by a handler for the duration of one request and returned immediately after. A request that needs the database blocks (or, in an event-loop server, yields) until a pool connection is free, which means the pool size becomes a real ceiling on how many concurrent database-touching requests a server can actually serve — sized too small and requests queue behind a scarce resource, sized too large and the database itself buckles under more concurrent queries than it can run well.

This is the same shape as the C10K problem one layer up: a fixed, expensive resource (a database connection, a thread, a process) shared across a much larger number of requests than there are resources to go around, and the entire design of the layer above exists to schedule that sharing without anyone waiting longer than they have to.

## It's All the Same Problem, Repeated at Every Layer

A web server is not a single mechanism — it's a socket that never stops accepting, a router that dispatches to a handler, a concurrency model that decides how many of those can run at once, and increasingly a proxy in front of several more servers doing the same thing. Every layer of it is a variation on the same question: a fixed amount of some expensive resource — a thread, a process, a database connection, a CPU core — and a request volume that's rarely predictable and always eventually exceeds it. The event loop, the connection pool, the load balancer are three different answers written at three different layers to that one recurring question. Once you can see that repetition, a "why is this endpoint slow under load" question stops being about the framework and starts being a question of which of these resources is the one actually running out.
