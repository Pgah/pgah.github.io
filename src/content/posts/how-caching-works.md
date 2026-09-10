---
title: "How Caching Works"
date: 2026-09-10
description: "Caching is the same idea repeated at every layer of a system: keep a copy of something expensive closer to whoever needs it next. The hard part was never storing the copy — it's knowing when the copy has stopped being true."
tags: ["caching", "performance", "backend", "cdn"]
---

Every layer of a web stack eventually does the same trick: instead of redoing expensive work, keep the last result around and hand it out again. A browser keeps a copy of an image instead of re-downloading it. A CDN keeps a copy of a page instead of asking the origin server for it. A database keeps a copy of a query result instead of rereading disk. Different layers, same move — trade storage for the cost of recomputing or refetching something. The [web servers article](/posts/how-web-servers-work) ended on a recurring theme: a fixed, expensive resource and a request volume that eventually exceeds it. Caching is the other half of that story — not managing scarcity, but avoiding the expensive work in the first place, at the cost of a new problem that doesn't exist without it: the copy can go stale.

## The Browser Cache: Caching Closest to the User

The cheapest request is the one never sent. When a browser first fetches a resource, the [HTTP article](/posts/how-http-works) covered the header that decides what happens next: `Cache-Control`. A response like `Cache-Control: max-age=3600` tells the browser it can reuse this exact response for the next hour without asking the server anything at all — no request goes out, no round trip happens, the resource is just read from local disk.

Once that hour is up, the cached copy is **stale**, but stale doesn't necessarily mean useless. The browser can send a **conditional request** — `If-None-Match` with the resource's `ETag`, a hash-like identifier the server sent along with the original response. If the resource hasn't actually changed, the server replies `304 Not Modified` with no body at all, and the browser keeps using its existing copy. The round trip still happens, but the expensive part — transferring the file again — doesn't. This is the same distinction every caching layer below reimplements in its own vocabulary: a **fresh** cache entry needs no check, a **stale** one needs revalidation, and revalidation is cheaper than refetching.

## CDNs: Moving the Copy Closer to Geography

A browser cache only helps the same user who already loaded the resource once. A **CDN** (Content Delivery Network) solves a different version of the same problem: the first user in Tokyo shouldn't have to wait on a round trip to a server in Virginia, and neither should the thousandth.

A CDN is a network of **edge servers** distributed geographically, each capable of caching a copy of content close to whoever's requesting it. The first request for a resource in a given region is a **cache miss** — the edge server doesn't have a copy yet, so it fetches one from the **origin server** (the actual application server, wherever it lives), stores it, and returns it. Every subsequent request in that region is a **cache hit**: the edge server answers directly, and the origin never even sees the request. The same `Cache-Control` headers that govern the browser cache govern this layer too — a CDN respects `max-age` the same way, just for many users instead of one.

What a CDN adds beyond geography is a **cache key** — typically the URL, sometimes combined with specific headers like `Accept-Encoding` or a cookie. Two requests only get the same cached response if their cache keys match, which is why a page that varies by user (a logged-in dashboard) either can't be cached at the CDN layer at all, or needs a cache key that accounts for the variation. Getting the cache key wrong in either direction is a real failure mode: too broad, and one user's private page gets served to another; too narrow, and the cache hit rate collapses because nothing ever matches.

## Reverse Proxy and Server-Side Caching

The same idea shows up one layer further in, inside infrastructure the [web servers article](/posts/how-web-servers-work) already introduced. A reverse proxy like nginx or Varnish sitting in front of application servers can cache responses the same way a CDN does — `proxy_cache` in nginx, or Varnish's cache built specifically for this job — so that identical requests hitting the same server never reach the application code at all. This is the same mechanism as a CDN, just positioned one hop earlier: instead of avoiding a trip across the internet, it avoids a trip into the application server's routing, handler, and database logic.

The distinction between CDN and reverse-proxy caching is mostly about placement, not mechanism. A CDN's edge nodes are physically distributed to shorten network distance; a reverse-proxy cache sits right next to the application and shortens compute distance instead. Both answer the same request from memory or fast local storage instead of doing the expensive work again.

## Application-Level Caching: Caching a Computation, Not a Response

Not everything worth caching is an HTTP response. A handler that queries a database, joins a few tables, and formats the result is doing real work on every request — and if the underlying data doesn't change on every request, that work is often redundant. **Redis** and **Memcached** are in-memory key-value stores built for exactly this: caching the *result* of a computation, keyed by whatever identifies it, so the next request for the same thing skips straight to a memory read.

The dominant pattern here is **cache-aside** (also called lazy loading): a handler checks the cache first; on a hit, it returns the cached value directly; on a miss, it does the real work — queries the database, computes the value — then writes the result into the cache before returning it, so the next request hits. This puts the caching logic in the application rather than a proxy, which means it can cache anything, not just full HTTP responses: a user's permissions, an expensive aggregate query, a rendered template fragment.

The [databases article](/posts/how-databases-work) covered connection pools — a fixed, expensive resource shared across concurrent requests. An application cache sits in front of that same resource for a different reason: even an available connection still costs a real query, and a cache hit skips the database entirely, which is why a well-placed cache can matter more for database load than the size of the connection pool behind it.

## The Invalidation Problem

There's an old line in computer science: there are only two hard things — cache invalidation and naming things. Every layer above has the same easy story on the happy path (check the cache, return it if fresh) and the same hard question underneath: how does anything *know* when a cached copy has stopped being true?

**TTL** (time-to-live) is the simple answer — every entry above uses some form of it, whether it's `max-age` on an HTTP response or an expiry passed to a Redis `SET`. After a fixed duration, the entry is treated as stale regardless of whether the underlying data actually changed. This is easy to reason about and easy to get wrong in both directions: too long, and users see outdated data for longer than acceptable; too short, and the cache stops saving much work because everything expires before it's reused.

**Explicit invalidation** is the other approach: when the underlying data changes, the code that changed it also deletes or updates the corresponding cache entry. This keeps the cache accurate on a much tighter timeline than any TTL could, but it means every code path that writes data now has to remember which cache entries that write might have made stale — miss one, and the cache serves wrong data indefinitely, with no TTL to eventually correct it.

A third failure mode shows up specifically at scale: **cache stampede** (or thundering herd). A popular entry expires, and a burst of concurrent requests all get a cache miss at the same instant, all fall through to the expensive origin computation simultaneously, and the database or origin server gets hit with a spike of duplicate work it was never seeing while the cache was warm. The common mitigations are variations on the same idea: let only one request recompute the value while the others wait for it (a lock or "single-flight" pattern), or refresh popular entries slightly before they actually expire so a stampede never has room to start.

## Consistency Tradeoffs: How a Cache Is Written

Cache-aside reads through the cache, but where a cache sits relative to *writes* is its own design decision, with its own tradeoffs.

**Write-through** updates the cache and the underlying store in the same operation, before returning success to the caller. The cache is never stale immediately after a write, at the cost of every write paying the latency of both writes.

**Write-back** (or write-behind) updates the cache immediately and writes to the underlying store asynchronously, later. Writes are fast, but there's a window where the cache holds data the durable store doesn't have yet — a crash in that window loses the write, which makes this a poor fit for anything that has to survive a crash without loss.

**Cache-aside**, applied to writes, usually just invalidates the entry rather than updating it — delete the cache entry on write, let the next read repopulate it from the source of truth. This avoids the cache and the database ever disagreeing about a value's *content*, but it means the read immediately after a write is a guaranteed miss, paying full cost once before the entry is warm again.

None of these eliminate the core tension: a cache is, by definition, a second copy of something, and two copies of anything can briefly disagree. The choice between them is a choice about which kind of disagreement a system can tolerate — slightly slower writes, a small window of possible data loss, or a guaranteed miss right after every write.

## The Same Question, Asked at Every Layer

A browser cache, a CDN, a reverse proxy, and an in-memory key-value store look like four unrelated technologies, but they're four answers to one question: is this expensive thing still true, or does it need to be redone? Every layer picks its own unit of "expensive" — a file transfer, a network hop, a database query, a computation — and its own answer to when a copy stops being trustworthy. Once you can see caching as that one repeated question instead of four separate tools, a "why is this page showing old data" bug stops being mysterious and starts being a matter of walking the layers in order and asking, at each one, which cache is still holding the old answer.
