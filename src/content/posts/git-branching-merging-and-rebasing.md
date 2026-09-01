---
title: "Git Branching, Merging, and Rebasing"
date: 2026-09-02
description: "Branching is cheap because a branch is just a pointer. But that raises the real question: what actually happens when two of those pointers get joined back together? Merge and rebase are two different, precise answers."
tags: ["git", "workflow", "version-control"]
---

The [Git internals article](/posts/how-git-works) established the core fact that makes everything here make sense: a branch is not a container of commits, it's a single hash written in a file. That explains why creating a branch is instant. It does not, on its own, explain what happens when you bring two branches back together — and that's where most of the confusion about Git actually lives. Merging and rebasing are not two flavors of the same operation. They produce different graphs, for different reasons, and the "just use whichever" advice is how people end up rewriting history they shouldn't.

## Branching, Revisited

`git branch feature` creates one new file: `.git/refs/heads/feature`, containing the hash of whatever commit `HEAD` currently points to. Nothing is copied. From that moment, `main` and `feature` point at the same commit, and every new commit on either branch moves that branch's own pointer forward by one, leaving the other untouched. Two lines of development, diverging from a shared point, are just two files holding different hashes.

The question this section exists to answer: once those two pointers have moved apart, how do you get their work back into one line of history?

## Fast-Forward: The Case Where There's Nothing to Merge

Suppose `main` hasn't moved since `feature` branched off. `feature` has three new commits; `main` still points at the commit they all descend from. Running `git merge feature` while on `main` in this situation triggers a **fast-forward**: Git doesn't create a merge commit at all. It simply moves the `main` ref forward to point at the same commit `feature` points to.

This is the trivial case, and it's worth naming precisely because it's the one that has nothing to do with "merging" in the sense most people picture — no combining, no conflict, no new object beyond the ones `feature`'s commits already created. It's a pointer update, exactly like a normal commit is, just triggered by `merge` instead of `commit`.

## Three-Way Merge: When Both Sides Moved

Fast-forward only works if one branch is a strict ancestor of the other. The moment `main` gets its own commits after `feature` branches off, the two histories have genuinely diverged, and joining them requires something more than moving a pointer.

Git's answer is a **three-way merge**, and the "three" refers to three commits it looks at: the tip of the current branch, the tip of the branch being merged in, and their **merge base** — the most recent commit both branches share, found by walking the DAG backward from each tip until the paths converge. Git computes what changed between the merge base and each tip, and if those two sets of changes touch different parts of the files, it combines them automatically into a new tree.

That new tree becomes a new commit — a **merge commit** — with two parents: the previous tip of the current branch, and the tip of the branch merged in. This is the direct payoff of Git's history being a DAG rather than a line, described in the internals article: a commit object isn't limited to one parent. Merging is literally what a second parent pointer is for. After the merge, `main`'s ref points at this new two-parent commit, and both lines of development are reachable by walking backward from it.

## What a Conflict Actually Is

A **merge conflict** happens when the three-way merge can't combine the two change sets automatically — specifically, when both tips modified the same region of the same blob relative to the merge base. Git has no way to know which version, or what combination of both, you actually want, so it stops and asks.

This is worth stating plainly because it demystifies conflicts entirely: a conflict is not Git being confused about your intent, and it's not a sign anything went wrong. It's the correct, mechanical outcome of two histories editing overlapping lines with no third option that's obviously right. Resolving a conflict means editing the file to the content you want and staging it — at the object level, you're just supplying the blob that the merge commit's tree should point to for that file, since Git couldn't derive it automatically.

## Rebase: Rewriting Commits Instead of Joining Them

Merging leaves the diverged history exactly as it happened, joined by a new commit. **Rebasing** takes a different approach entirely: instead of joining two histories, it rewrites one of them to look like it happened after the other.

`git rebase main` while on `feature` does this: Git finds the merge base of `feature` and `main`, takes every commit on `feature` since that point, and **replays** them one at a time on top of `main`'s current tip — reapplying each commit's changes as a new commit with a new parent. This is the detail that matters and that trips people up: these are not the same commits moved to a new location. They are brand-new commit objects. Same author, same message, same resulting file changes in most cases — but a different parent, which means a different hash, per the commit-hashing chain described in the internals article. The original commits still exist in the object database until garbage collected, but nothing points at them anymore; `feature`'s ref now points at the new, replayed chain.

The result is a straight line: `feature`'s commits appear to come directly after `main`'s latest work, with no merge commit and no visible fork in the history. That's the entire appeal of rebasing — a clean, linear log that reads like the work happened sequentially, even though it didn't.

## Why You Don't Rebase Shared History

Because rebasing manufactures new commit objects with new hashes, it is a rewrite, not an edit. Anyone else who already has copies of the original commits — because they pulled `feature` before you rebased it — now has commits that no longer exist on your rewritten branch. Their history and yours share no commits past the point you rebased from, even though the content looks familiar. Pushing the rebased branch forces them to either discard their local commits (`git pull --rebase` or a forced reset) or produce a confusing second merge reconciling two versions of what was supposed to be the same work.

This is the entire basis for the standard rule: rebase freely on a branch only you are working on, and never rebase a branch other people have already pulled from. It isn't a style preference — it's a direct consequence of hashes being derived from content and parentage. Change the parent, change the hash, and every collaborator's copy silently stops matching yours.

## Interactive Rebase: Same Mechanism, Editable Replay

`git rebase -i` doesn't introduce a new mechanism — it exposes the replay step and lets you edit the list of commits before Git applies it. You can reorder lines to replay commits in a different sequence, drop a line to skip a commit entirely, or mark commits to `squash` into the one before them, combining several commits' changes into a single new commit during the replay.

All of it still comes down to the same operation described above: take a sequence of changes, and reapply them one by one to build a new chain of commit objects with new parents. Squashing five commits into one is just a replay that produces one new commit instead of five. Reordering is a replay in a different sequence. Nothing here requires a separate model — it's the ordinary rebase mechanism with a pause before the replay so you can edit the plan.

## It's All Pointers and Replays

Every operation in this article reduces to two primitives from the internals article: moving a ref to point at a different commit, and creating new commit objects. A fast-forward moves a pointer and creates nothing. A three-way merge creates one new commit with two parents and moves a pointer to it. A rebase creates a whole new chain of commits, one per replayed change, and moves a pointer to the end of that chain. A conflict is just the moment Git can't compute a tree automatically and needs the blob supplied by hand.

None of this is special-cased inside Git. It's the same object model — blobs, trees, commits, refs — doing the only two things it can do: point somewhere, or add something new to point at.
