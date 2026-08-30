---
title: "Linux Filesystems: ext4 and the Inode Model"
date: 2026-08-31
description: "A filename is not a file. It is a label pointing at an inode, and the inode is where the real bookkeeping happens. Understanding that split explains hard links, journaling, and why deleting a file doesn't always free the disk space."
tags: ["linux", "filesystems", "fundamentals", "ext4"]
---

The [architecture article](/posts/the-architecture-of-linux) said almost everything in Linux is a file. That claim only holds together because of a specific piece of machinery underneath it: the filesystem that turns a stream of bytes on a disk into the directories, filenames, and permissions you actually interact with. On most Linux systems today, that machinery is **ext4**. Understanding how it works means understanding one core split: a filename and the data it points to are not the same thing, and the object in between is called an **inode**.

## The Filename Is Not the File

When you create a file, ext4 does two separate things. It allocates an **inode** — a fixed-size record holding everything about the file except its name: owner, permissions, size, timestamps, and pointers to the actual data blocks on disk. Separately, it adds an entry to the containing directory that maps a filename to that inode's number.

This means a directory is not a container of files. It is a table of `(name, inode number)` pairs. The [file permissions article](/posts/linux-file-permissions) covered the permission bits themselves — those bits live on the inode, not on the directory entry. Renaming a file doesn't touch the inode at all; it just changes which name in a directory points to it.

You can see the inode number directly:

```
$ ls -i /etc/hostname
131074 /etc/hostname

$ stat /etc/hostname
  File: /etc/hostname
  Size: 10        	Blocks: 8          IO Block: 4096   regular file
Device: 259,2	Inode: 131074      Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
```

`stat` shows what `ls -la` doesn't: the inode number, the link count, and three separate timestamps (access, modify, change) that a plain directory listing collapses into one.

## What's Actually in an Inode

An inode stores fixed metadata fields — file type, permission bits, owner UID/GID, size, timestamps, and a link count — plus a mechanism for locating the file's data blocks. What it does *not* store is the filename. This is why an inode can have multiple names pointing to it, and why finding "the name" of a file given only its inode is not always possible in the general case — the kernel doesn't track that reverse mapping.

Older ext filesystems located data through direct and indirect block pointers: an inode held a small number of direct pointers to data blocks, then pointers to blocks-of-pointers for larger files, then pointers to blocks-of-pointers-of-pointers for the largest ones. ext4 replaced most of this with **extents**: instead of listing every block individually, an extent describes a contiguous run as `(starting block, length)`. A 100MB file that happens to be stored contiguously needs one extent record instead of thousands of block pointers. This is a direct efficiency win for large files and one of the more mechanical differences between ext3 and ext4.

## Hard Links: Two Names, One Inode

Once you see files as `directory entry → inode`, hard links stop being a special case and become the obvious consequence of the model.

```
$ echo "data" > original.txt
$ ln original.txt hardlink.txt
$ ls -i original.txt hardlink.txt
131074 original.txt
131074 hardlink.txt
```

Both names point at the same inode. There is no "original" and "copy" — they are equally valid names for the same underlying data, which is why the inode keeps a **link count**. Creating a hard link increments it; deleting a name decrements it. The data blocks are only actually freed when the link count reaches zero *and* no process still has the file open. This is why `rm`ing a file that a running process has open doesn't immediately free the disk space — the kernel keeps the inode alive until the last reference, whether that reference is a directory entry or an open file descriptor, goes away. It's also why you can delete a log file to reclaim space and find the space isn't reclaimed until you restart the process still writing to it.

A **symlink** is a completely different mechanism: it's a small file whose data is a path string, with its own separate inode. Following it means reading that path and looking it up again from scratch, which is why symlinks can point across filesystems and hard links cannot — a hard link is an inode reference, and inode numbers are only meaningful within the filesystem that assigned them.

Hard links cannot point to directories (this is disallowed to keep the directory tree from becoming a graph with cycles), and cannot cross filesystem boundaries for the same reason inode numbers don't transfer. Symlinks have neither restriction, at the cost of an extra lookup and the possibility of dangling if the target disappears.

## Journaling

SysV-era filesystems had no defense against a crash mid-write: pull the power while a directory update is half-applied, and `fsck` on the next boot had to walk the entire filesystem checking every structure for consistency. On a large disk, that scan could take a long time, and it could still lose data.

ext4 (like ext3 before it) maintains a **journal**: before a metadata change is applied to its real location, ext4 writes a description of that change to a dedicated journal area. Only after the journal entry is safely on disk does ext4 apply the change itself. If the system crashes mid-write, the next mount replays the journal, finishes whatever was in progress, and moves on — no full-filesystem scan required.

`data=ordered` is ext4's default journaling mode: metadata is journaled, and file data itself is guaranteed to hit disk before the metadata that references it, but data blocks aren't journaled directly. `data=journal` journals both metadata and data, which is safer but roughly halves write throughput since everything is written twice. `data=writeback` journals only metadata with no ordering guarantee on data, which is fastest but means a crash can leave a file's metadata correct while its content is stale or garbage. The tradeoff is consistency versus throughput, and `ordered` is the practical default for a reason: full data journaling is rarely worth the write penalty outside of specific durability requirements.

## Running Out of Inodes

Disk usage has two independent limits: space and inode count. `mkfs.ext4` decides how many inodes a filesystem will ever have at format time, based on a bytes-per-inode ratio — and that number cannot be increased later without reformatting. Every file, no matter how small, consumes exactly one inode. A filesystem storing millions of tiny files (a mail spool, a cache directory, a poorly-configured session store) can exhaust its inode table while `df` still reports plenty of free space.

```
$ df -i /var
Filesystem      Inodes  IUsed    IFree IUse% Mounted on
/dev/sda2      1310720 1310720        0  100% /var
```

`IUse% 100%` with free disk space remaining is the signature of this failure mode: `touch` and `mkdir` fail with "No space left on device" even though `df -h` shows gigabytes free, because the error is about running out of a fixed structural resource, not bytes. This is worth knowing before you're debugging it live at 3am: the fix isn't clearing files by size, it's clearing files by count, and the underlying limit can only be raised by reformatting with a smaller bytes-per-inode ratio.

## Why the Split Matters

The inode model isn't an implementation detail — it's the reason a large set of Unix filesystem behavior is the way it is. Permissions live with the data, not the name, so renaming never touches access control. Multiple names can share one file safely, because "the file" was never the name to begin with. Deletion is really just decrementing a reference count, which is why space reclamation can lag behind `rm`. And the two resources a filesystem tracks — space and inodes — are independent enough that you can exhaust either one without touching the other.

Tools like `debugfs` and `dumpe2fs -h /dev/sdXN` let you inspect this structure directly on an unmounted or read-only filesystem, which is standard practice in forensics: an inode's timestamps and link count often say more about what happened to a file than its name ever will.
