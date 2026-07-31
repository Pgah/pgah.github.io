---
title: "How HTTP Works"
date: 2026-08-01
description: "Every web page you load is a conversation in plain text: a request, a response, and a stack of headers doing the real work. It's simpler than you think and more consequential than it looks."
tags: ["http", "https", "web", "networking", "fundamentals"]
---

The protocol that carries the entire web is just text you could type by hand.

That's not an exaggeration. Strip away the browser and the encryption and HTTP is a plain-text conversation: you send a request, you get a response, both readable by a human. The simplicity is the point, and it's also deceptive — the whole web is built on it, which means its quirks and gaps become everyone's quirks and gaps. Understanding what's actually in that conversation changes how you read everything from a slow page to a security header.

## What HTTP Actually Is

**HTTP** (Hypertext Transfer Protocol) is a **request/response** protocol. The client asks for something, the server answers. That's the entire shape of it. There's no ongoing dialogue; each exchange is one question and one answer.

It's also **stateless**. Every request stands alone — the server, by default, remembers nothing about the last one. Any sense of continuity (that you're logged in, that you have a cart) is reconstructed on every single request from information the client sends along. This one design choice shapes an enormous amount of how the web works.

And it runs on **TCP**. Before a browser can send an HTTP request, it needs the target's IP address (a **DNS** lookup, covered in the DNS article) and an open TCP connection (the three-way handshake, covered in the TCP/IP article). By the time HTTP enters the picture, the name has been resolved and the connection is established. HTTP is the content flowing through a pipe that other layers already built.

## The Request

An HTTP request is a few lines of text. The first line carries the **method**, the **path**, and the version — something like `GET /index.html HTTP/1.1`.

The **method** states intent. `GET` retrieves a resource. `POST` submits data. `PUT` replaces a resource, `DELETE` removes it, and there are others. The distinction matters beyond convention: `GET` is meant to be **safe** (it shouldn't change anything) and methods like `PUT` and `DELETE` are meant to be **idempotent** (doing them twice has the same effect as doing them once). Caches, proxies, and browsers rely on these promises, which is why a `GET` should never quietly modify data.

After the first line come the **headers** — key-value pairs of metadata — and then, optionally, a **body** carrying the actual payload (the contents of a form, a file, a chunk of JSON). A `GET` usually has no body; a `POST` usually does.

## The Response

The server answers with the same shape in reverse. The first line is the status line: the version, a **status code**, and a short reason phrase, like `HTTP/1.1 200 OK`.

Status codes are grouped by their first digit, and knowing the classes tells you more than memorizing individual numbers. **2xx** means success — `200 OK` is the everyday case. **3xx** means redirection — `301` moved permanently, `304 Not Modified` telling the browser its cached copy is still good. **4xx** means the client got it wrong — `404 Not Found`, `403 Forbidden`, `401 Unauthorized`. **5xx** means the server got it wrong — `500 Internal Server Error`, `503 Service Unavailable`. When something breaks, the first digit tells you which side to look at.

Then, as in the request, come headers and an optional body — usually the HTML, image, or data you actually asked for.

## Headers Do the Real Work

The method and status get the attention, but **headers** are where most of HTTP's real behavior lives.

`Host` tells the server which site you want, which is what lets one server at one IP address host hundreds of different domains — it reads the `Host` header to decide which one you meant. `Content-Type` declares what the body is (`text/html`, `application/json`, `image/png`) so the recipient knows how to parse it. `Cache-Control` governs whether and how long a response can be stored, quietly determining how much of the web you never actually re-download.

And `Cookie` / `Set-Cookie` are how a stateless protocol pretends to have state. The server sends `Set-Cookie` with a token; the browser sends it back in the `Cookie` header on every subsequent request. That returned token is what reconstructs "you're logged in" on a protocol that remembers nothing on its own. `Authorization` carries credentials the same way. The statelessness never goes away — the client just re-proves who it is, request after request.

## HTTPS: HTTP Over TLS

**HTTPS** is not a different protocol. It's HTTP running inside a **TLS** connection. The requests, responses, methods, and headers are all exactly the same. The only change is that before any of that plain text flows, the client and server complete the TLS handshake the TLS article walked through, and everything after is encrypted.

What that protects is the HTTP payload: your paths, your headers, your cookies, the body. What it doesn't hide is what the lower layers already exposed — the destination IP address, and the domain name leaked in the TLS **SNI** field during the handshake. An observer can't read your request, but they can often still tell which site you're talking to. Encryption moves the boundary of what's visible; it doesn't erase it.

## HTTP/2 and HTTP/3

The version numbers aren't cosmetic — each one solves a real problem in the one before.

**HTTP/1.1** sends requests as text over a TCP connection, largely one at a time per connection. If the first response is slow, the ones behind it wait. This is **head-of-line blocking**, and it's why old sites opened many parallel connections just to load faster.

**HTTP/2** fixes it with **multiplexing**: many requests and responses share one connection at once, interleaved as independent streams, using a compact binary framing instead of plain text. One slow response no longer blocks the others — at the HTTP layer. But HTTP/2 still rides on TCP, and TCP delivers strictly in order, so a single lost packet stalls every stream on that connection until it's retransmitted. The blocking moved down a layer instead of disappearing.

**HTTP/3** finishes the job by leaving TCP behind. It runs on **QUIC**, a protocol built on **UDP** (the connectionless alternative from the TCP/IP article), with its own streams that are independent all the way down — a lost packet stalls only the stream it belonged to. QUIC also folds the connection and encryption setup together, cutting the round trips before the first byte. The web spent two decades making a text protocol from the early 1990s carry things it was never designed for, and these versions are the accumulated fixes.

## What Can Go Wrong

Plain HTTP sends everything readable. Anyone on the path — the coffee-shop Wi-Fi, a router in between — can read your requests and, worse, modify responses in flight, injecting content into pages you never asked to change. That single fact is why HTTPS is now the default and browsers mark plain HTTP as insecure.

Even over HTTPS, the flexibility of headers is an attack surface. **Header injection** can smuggle in extra headers or split responses. A stolen `Cookie` is a stolen session, which is why session cookies should be marked `Secure` (HTTPS only) and `HttpOnly` (unreadable to scripts). And servers push back with security headers of their own: **HSTS** (HTTP Strict Transport Security) forces every future connection to HTTPS, and **CSP** (Content Security Policy) restricts what a page is allowed to load, limiting the damage of injected content. These are opt-in — a site is only as protected as its headers say it is.

A readable text protocol, a request and a response, a stack of headers doing the quiet work — and underneath it a name resolved, a connection handshaked, a session encrypted. Every page you load is all of these layers cooperating, each trusting the one below to have done its job. HTTP is the one you can actually read, which is exactly why it's worth reading.
