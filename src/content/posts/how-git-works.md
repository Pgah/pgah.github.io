---
title: "How Git Works: Objects, Refs, and the DAG"
date: 2026-08-20
description: "Most people learn Git as a sequence of commands to memorize. Underneath, it's a content-addressable object store with four object types and a graph of commits. Understand that, and the commands stop being magic."
tags: ["git", "fundamentals", "version-control"]
---

Most people learn Git as a ritual: `add`, `commit`, `push`, repeat, and when something goes wrong, search the error message and paste in whatever fixes it. That works until it doesn't — until a rebase conflicts, a detached HEAD shows up, or a merge produces something nobody expected. At that point, memorized commands run out, because the commands were never the actual system. Underneath them is a small, consistent data model. Learn that model and the commands stop being incantations and start being obvious.

## Git Is a Database, Not a File Tracker

The mental model most people carry — "Git saves diffs between versions of my files" — is wrong. Git does not store diffs. Every time you commit, Git stores a complete snapshot of every tracked file as it exists at that moment. Diffs are computed on the fly, for display, by comparing two snapshots. They are never the underlying storage format.

What Git actually is, at its core, is a **content-addressable key-value store**. You give it content; it gives you back a key derived from that content's hash. Everything else — commits, branches, tags, the entire history of a project — is built on top of that one primitive.

## Hashing: The Key Is the Content

Every piece of content Git stores gets run through a hash function (SHA-1 historically, with SHA-256 support added more recently) and identified by the resulting hash — a 40-character hex string like `a3f5c1e...`. This is the object's name. There is no separate ID, no auto-incrementing counter, no filename. The hash *is* the address.

This has a consequence that isn't obvious at first: identical content always produces the identical hash, regardless of when or where it was created. If two files anywhere in the repository's history have exactly the same bytes, Git stores that content exactly once and both files point to the same object. And because the hash is derived from content, changing a single byte anywhere in a snapshot changes the hash of that snapshot completely — which is why Git commit hashes double as an integrity check. A commit's hash depends on its content and its parent's hash, which depends on its content and its parent's hash, all the way back. Tamper with anything in the history and every hash after it changes. You cannot quietly edit the past.

## Four Object Types

Everything Git stores is one of four object types, all addressed the same way, all sitting in the same store.

**Blob** — the contents of a file, and nothing else. No filename, no permissions, no path. Just raw bytes, hashed. Two files with identical content, anywhere in the repository, are the same blob.

**Tree** — a directory listing. A tree is a list of entries, where each entry has a filename, a file mode (permissions, and whether it's a file or a subdirectory), and the hash of the blob or tree it points to. A tree can point to blobs (files in that directory) and to other trees (subdirectories), which is how Git represents nested directory structures.

**Commit** — a snapshot in history. A commit object contains the hash of exactly one tree (the root directory at that point in time), the hash of its parent commit (or commits, for a merge), the author, the committer, a timestamp, and a message. Notice what a commit does *not* contain: it holds no diff. It points to a complete tree, which itself points to the complete state of every file, unchanged content reused by hash.

**Tag** (annotated tags specifically) — a named, signable pointer to a specific object, usually a commit, along with a message and optionally a cryptographic signature. Lightweight tags skip this object entirely and are just refs, covered below.

Four object types, one storage mechanism, no exceptions. A file's content, a directory's structure, a point in history, and a label are all just objects addressed by the hash of what they contain.

## Anatomy of a Commit

Put the four objects together and a commit looks like this: a commit object holds a tree hash and a parent hash. The tree it points to holds a set of entries — some pointing directly to blobs (files), some pointing to other trees (subdirectories), which in turn point to more blobs and trees. Walk that structure and you reconstruct the entire directory exactly as it existed at that commit.

This is why `git commit` after changing one line in one file is fast and cheap, despite conceptually storing a "full snapshot." Every file and directory that *didn't* change gets its existing blob and tree reused by hash — Git only needs to create new blob and tree objects along the path from the changed file up to the root, plus the new commit object itself. A commit touching one file in a thousand-file project creates a handful of new objects, not a thousand.

## The DAG: Why History Is a Graph, Not a Line

Each commit stores the hash of its parent, so following those parent pointers backward traces the project's history, one commit at a time, back to the very first commit, which has no parent at all.

Most of the time this looks like a straight line. It isn't, structurally. A commit can have more than one parent — a **merge commit** has two (or more), one pointing into each branch being combined. This makes Git's history a **directed acyclic graph**, a DAG: directed, because parent pointers only point backward in time; acyclic, because a commit can never be its own ancestor — hashes depending on parent hashes make a cycle physically impossible to construct.

Branching means creating a new commit whose parent is some existing commit, then continuing to add commits along that new path while the original path continues independently. Merging means creating a new commit with two parents, one from each path, joining them back into a single point that both histories lead into. The DAG is not a metaphor for what Git does; it's a literal, accurate description of the object graph sitting in `.git`.

## Branches Are Just Pointers

Here is the part that surprises people coming from other version control systems: a branch is not a container that holds commits. A branch is a single 40-character hash written in a file. That's the entire implementation.

`.git/refs/heads/main` contains one line: the hash of whatever commit is currently the tip of `main`. When you run `git commit`, Git creates the new commit object — which points to the previous tip as its parent — and then does one more thing: it overwrites `refs/heads/main` with the new commit's hash. The branch pointer moves forward by one commit. That's the entire mechanic of "committing to a branch."

This is also why creating a branch in Git is close to instantaneous regardless of repository size. `git branch feature` does not copy any files, any history, or any objects. It creates one new file, a few dozen bytes, containing the current commit's hash. Deleting a branch just deletes that file — the commits it pointed to stay in the object database (until garbage collected) whether or not any ref points to them.

## HEAD: A Pointer to a Pointer

If a branch is a pointer to a commit, **HEAD** is a pointer to a branch — a level of indirection that represents "where you currently are." The `.git/HEAD` file normally contains a line like `ref: refs/heads/main`, not a hash directly. When you commit, Git resolves HEAD to find the current branch, then updates *that* branch's ref to the new commit, and HEAD keeps pointing at the branch name rather than a fixed commit.

`git checkout <branch>` rewrites `.git/HEAD` to point at a different branch ref. `git checkout <commit-hash>` instead writes the raw hash directly into HEAD, skipping the branch indirection entirely — this is a **detached HEAD** state. Commits made in that state still get created normally in the object database, but no branch ref moves to follow them, so nothing keeps pointing at them once you check out something else, and they become eligible for garbage collection. That is the entire, unmysterious explanation for why "detached HEAD" warnings exist and why work done there can quietly disappear if you're not careful.

## Where the Objects Actually Live

All of this — blobs, trees, commits, tags — lives under `.git/objects`. Each object is initially written as a **loose object**: a single compressed file, stored in a subdirectory named after the first two characters of its hash, with the remaining characters as the filename. This keeps any one directory from accumulating tens of thousands of files as a repository grows.

Loose objects are simple but inefficient at scale — lots of small compressed files with redundant data between them. Periodically (via `git gc`, or automatically past certain thresholds), Git repacks loose objects into a single **packfile**: a more heavily compressed format that stores objects as deltas against similar objects, dramatically reducing size for repositories with long histories of small changes. This is a storage optimization layered on top of the model, not a change to it — every object retains the same hash and the same meaning whether it's sitting loose or packed.

## Why the Model Matters

Once objects, refs, and the DAG click, most of Git's stranger-looking behavior stops being strange. A `reset` is just moving a branch pointer to a different commit. A `rebase` is replaying commits to build new ones with different parents, then moving the branch pointer to the new tip. A `cherry-pick` takes the changes introduced by one commit and applies them as a new commit elsewhere in the graph. A merge conflict is Git being unable to automatically combine two trees that changed the same region of the same blob. None of these are special cases bolted onto Git — they're all direct consequences of a content-addressable object store, four object types, and pointers that move.

The commands were never the hard part. The graph underneath them was always the whole thing.
