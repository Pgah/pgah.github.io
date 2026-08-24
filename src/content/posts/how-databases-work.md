---
title: "How Databases Work"
date: 2026-08-23
description: "A database isn't a smarter file. It's a system built around one promise — your data survives, stays consistent, and can be found fast — and everything from indexes to transactions exists to keep that promise."
tags: ["databases", "backend", "fundamentals", "sql"]
---

You could store your application's data in a JSON file and write to it with every request. For a while, it would even work. Then two requests would write at the same time and one write would silently vanish, or the process would crash mid-write and leave the file half-written and unparseable, or a page listing "all users older than 30" would mean scanning the entire file, every time, for every request. A database isn't a fancier place to put data. It's a system built specifically to make those failures not happen — and almost every feature a database has traces back to one of those three problems.

## What a Database Actually Is

A database's job is to hold data and guarantee three things about it that a plain file does not: it survives crashes, it stays consistent under concurrent access, and it can be queried without reading everything.

**Durability** means once the database confirms a write, that write is not lost — not to a crash, not to a power cut, not to the process being killed mid-operation. **Concurrency control** means multiple clients can read and write the same data at the same time without corrupting it or silently overwriting each other's changes. **Efficient querying** means asking "find the rows where X" doesn't require reading every row, no matter how large the table gets. A file system gives you none of these for free. A database is the accumulated engineering built to provide all three.

## Rows, Tables, Schema

The relational model — the one behind PostgreSQL, MySQL, SQLite, and most databases people mean when they just say "database" — organizes data into **tables**, each table a fixed set of named, typed columns, each row one record matching that shape. A `users` table might have columns `id` (integer), `email` (text), `created_at` (timestamp). Every row in it has all three, always in that shape.

This fixed shape is the **schema**, and it's not bureaucracy — it's a guarantee. Because the database enforces the schema, code reading from `users` never has to check whether `email` exists on this particular row or guess what type it is. A `NOT NULL` constraint means a query never has to handle "what if this field is missing." A foreign key from `orders.user_id` to `users.id` means the database itself refuses to let an order reference a user that doesn't exist — that rule is enforced once, in one place, instead of in every piece of application code that touches orders.

## Indexes: Why Queries Are Fast

Without help, finding "the user with email X" means reading every row in the table and checking each one — a **full table scan**. On a table with ten rows that's instant. On a table with fifty million rows, it's a query that takes seconds and gets slower every day the table grows.

An **index** is a separate structure the database maintains alongside the table, built to make one kind of lookup fast. Most indexes are a **B-tree**: a balanced, sorted tree structure where finding any single value takes roughly the same small number of steps regardless of table size — for a table with a million rows, a B-tree lookup takes about 20 comparisons instead of a million. Create an index on `email` and `WHERE email = 'x@example.com'` stops scanning the table and instead walks the tree straight to the matching row.

This isn't free. An index has to be updated on every `INSERT`, `UPDATE`, or `DELETE` that touches its column, and it takes its own disk space — a table with five indexes pays a small write-cost tax five times on every insert to keep all five current. Indexing is a trade: pay a little on every write, so that one specific kind of read is fast instead of linear. Index the columns you actually filter and sort on; indexing everything just slows down every write for indexes nothing ever uses.

## Transactions and ACID

A **transaction** is a group of operations the database treats as a single unit: either all of them take effect, or none of them do. Transferring money between two accounts is the standard example — subtract from one row, add to another. If the process crashes after the subtraction but before the addition, the money must not simply disappear. Wrapping both statements in a transaction is what makes that guarantee possible.

The guarantees a transaction provides are usually named **ACID**:

**Atomicity** — the transaction happens completely or not at all. A crash mid-transaction leaves no partial effect; the database rolls back to the state before it started.

**Consistency** — a transaction can only move the database from one valid state to another, respecting every constraint (foreign keys, `NOT NULL`, uniqueness) it has defined. A transaction that would violate a constraint is rejected outright.

**Isolation** — concurrent transactions don't see each other's uncommitted, in-progress changes. What isolation actually guarantees is configurable, and it's subtle enough to earn its own section below.

**Durability** — once a transaction commits, it survives a crash a moment later. This is the same durability promise from the top of this article, and transactions are the boundary it's attached to.

## How a Write Actually Survives a Crash

Durability sounds simple to promise and is genuinely hard to deliver, because writing to disk is slow and randomly scattering writes across a large table's on-disk layout is slower still. Fsyncing every changed page to its final location on every single commit would make databases far too slow to use.

The mechanism nearly every database uses instead is the **write-ahead log (WAL)**: before any change is made to the actual table data on disk, a compact record of that change is appended to a log file, and *that* append is what gets flushed to disk and confirmed durable. The log is sequential — pure appending, no seeking around the disk — which is fast. The actual table pages get updated in memory and written to their final locations later, in the background, in whatever order is efficient.

If the process crashes between the log write and the table update, nothing is lost: on restart, the database replays the log from the last confirmed point and reapplies any changes that hadn't made it to the table files yet. Durability doesn't come from every write reaching its final destination immediately — it comes from a fast, sequential record of intent that's guaranteed to survive, which the database can always replay from.

## Isolation Levels

The "I" in ACID looks like a single guarantee. In practice, most databases let you choose how strict it is, because full isolation — behaving as if every transaction ran one at a time with nothing else happening — is expensive, and many applications don't need it for every query.

A few concrete failure modes explain why this is configurable rather than fixed. A **dirty read** happens when a transaction reads a row another transaction has changed but not yet committed — if that other transaction then rolls back, the first transaction acted on data that never actually existed. A **non-repeatable read** happens when a transaction reads the same row twice and gets two different values, because another transaction committed a change in between. A **phantom read** happens when a transaction re-runs the same filtered query twice and gets a different set of rows, because another transaction inserted or deleted a matching row in between.

Isolation levels — `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`, roughly in order of strictness — each rule out a different subset of these anomalies, at a cost: stricter isolation means more locking or more work resolving conflicts, and lower throughput under concurrent load. `READ COMMITTED` is a common default precisely because it prevents dirty reads, the most dangerous anomaly, while still allowing enough concurrency to perform well. Picking an isolation level is picking a specific point on the trade-off between "what can concurrent transactions see of each other" and "how much do they slow each other down."

## SQL vs NoSQL

Everything above describes the relational model, but it isn't the only one. **NoSQL** is an umbrella term for databases that trade away some relational guarantees — a fixed schema, joins across tables, sometimes strict transactions — for something else: horizontal scale across many machines, flexibility in what shape a record can take, or raw throughput on simple key-based access.

A **document store** (like MongoDB) stores flexible, nested JSON-like records instead of fixed rows — useful when different records genuinely have different shapes and enforcing one schema would just mean fighting it. A **key-value store** (like Redis) trades away querying by anything other than a key, in exchange for being extremely fast at exactly that one operation. A **wide-column store** (like Cassandra) is built to scale writes across many machines by relaxing how strongly consistent those machines have to be with each other at any given instant.

None of these are strictly better than relational — they're different points on the same trade-offs this article has been describing throughout: consistency versus availability, schema rigidity versus flexibility, query power versus raw scale. The right choice depends on which guarantees the application actually needs and which it can afford to relax.

## Why the Model Matters

None of this is trivia about a tool. Every time an application is slow because a query does a full table scan, that's a missing index. Every time "the payment went through twice" or "the transfer lost money," that's a missing or misused transaction. Every time two people editing the same record stomp on each other's changes, that's an isolation question. The database was never a black box that data goes into — it's a specific set of engineering trade-offs, and the moment you can name which trade-off you're hitting, the bug stops being mysterious and becomes a known problem with a known fix.
