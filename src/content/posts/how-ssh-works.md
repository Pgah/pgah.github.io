---
title: "How SSH Works"
date: 2026-07-12
description: "Not just a remote terminal. A cryptographic protocol and understanding it changes how you think about trust, identity, and what 'secure' actually means."
tags: ["ssh", "networking", "cryptography", "fundamentals"]
---

Most people treat SSH like a magic door. Type a command, get a shell. They know the syntax. They don't know what's happening underneath.

That matters. Because SSH is one of the most common ways systems are accessed legitimately and otherwise. Understanding what it actually does changes how you configure it, how you harden it, and how you recognize when something is wrong.

## What SSH Actually Is

SSH stands for Secure Shell. The name is accurate but incomplete. It's a protocol a set of rules for establishing an encrypted, authenticated connection between two machines over an untrusted network.

The "shell" part is just the most common use case. SSH can also forward ports, tunnel other protocols, transfer files, and act as a secure transport layer for other applications. The shell is what most people see. The protocol is what actually matters.

SSH replaced older tools like Telnet and rlogin. Those tools did the same job remote terminal access but sent everything in plaintext. Every character you typed, including passwords, was visible to anyone watching the network. SSH made that impossible by design.

## The Problem It Solves

Before you can understand how SSH works, understand what it has to solve.

You have two machines connected by a network you don't control. Packets between them pass through routers, ISPs, cables none of which you own. Someone sitting on any of those paths could read everything you send, or worse, impersonate one of the machines and intercept the conversation entirely.

SSH has to solve three distinct problems:

**Confidentiality** nobody watching the network can read the data.

**Integrity** nobody watching can modify the data without you knowing.

**Authentication** you're actually talking to the machine you think you are, and it's talking to the person it thinks it is.

A lot of protocols solve one or two of these. SSH solves all three.

## The Handshake

When you run `ssh user@host`, before you type a single command, a series of things happen automatically.

First, the two sides agree on which algorithms to use encryption, key exchange, hashing. This negotiation is plaintext but doesn't contain secrets. It's just two machines comparing lists.

Then comes key exchange. This is the cryptographic core. The client and server need to establish a shared secret a symmetric encryption key they'll use for the session without ever sending that key over the network. The algorithm most commonly used for this is called Diffie-Hellman. The mathematics of it are elegant: two parties can each contribute values and arrive at the same secret without either sending the secret itself. An observer watching every packet exchanged cannot reconstruct what they agreed on.

Once that shared secret exists, everything from that point forward is encrypted.

## The Server's Identity

Here's where most people don't pay attention and where most SSH-based attacks happen.

Before authentication, before you type your password or use your key, the server proves its identity. Every SSH server has a host key a public/private key pair unique to that machine. The server signs something with its private key. The client checks the signature using the server's public key.

But where does the client get the server's public key? This is the trust problem. The first time you connect to a new server, SSH shows you the server's fingerprint and asks if you trust it. Most people type `yes` without reading it.

After that first connection, SSH stores the server's public key in `~/.ssh/known_hosts`. Every future connection checks the server's key against that stored value. If it doesn't match if someone is intercepting the connection and presenting a different key SSH refuses to connect and warns you loudly.

This is called a TOFU model: Trust On First Use. It's not perfect. The risk is that first connection. But every connection after that is protected.

## How You Authenticate

Once the server has proven its identity, you prove yours. There are two main ways.

**Password authentication** is the obvious one. You send your password over the now-encrypted connection. The server checks it. This works, but it has a problem: passwords can be guessed. A server exposed to the internet running password authentication will see thousands of automated attempts every day, trying common passwords against common usernames. This is called a brute-force or credential stuffing attack.

**Key-based authentication** is the better way. It works like this: you generate a key pair a private key that never leaves your machine, and a public key that you copy to the server. When you connect, the server sends you a challenge: a random value encrypted with your public key. Only someone with the matching private key can decrypt it and prove they understood the challenge. You do. You're in.

The private key never crosses the network. Not even encrypted. There's nothing to intercept, nothing to brute-force. The mathematics make the private key unguessable from the public key even if an attacker has all the time in the world and every computer on earth.

This is why disabling password authentication and requiring key-based auth is one of the first things you do when hardening a server.

## What a Compromised Key Means

Key-based authentication shifts the security question. The question is no longer "can someone guess your password?" It becomes "does someone have your private key file?"

If someone gets your private key, they have your identity. Every server that trusts your public key will accept them as you. No password to crack. No brute-force. Just access.

This is why private keys should have a passphrase an encryption layer on the key file itself. Even if someone steals the file, they can't use it without the passphrase. It's two-factor in practice: something you have (the key file) and something you know (the passphrase).

It's also why private key files matter as much as passwords in a security assessment. Finding an unprotected `id_rsa` file on a compromised machine is often the pivot point that opens everything else.

## The Session

After authentication, you have an encrypted, authenticated channel. The shell you see is just a process running on the remote machine, with its input and output connected through that channel. Every character you type is encrypted before it leaves your machine. Every response is encrypted before it leaves the server.

This is true for everything SSH carries file transfers, port forwarding, all of it. The protocol doesn't care what's inside. It just ensures that whatever moves through it can only be read by the intended recipient.

## Why This Foundation Matters

SSH is everywhere. Every Linux server you'll ever touch. Every cloud instance. Every network device with a modern management interface. Understanding what's happening beneath `ssh user@host` means you understand where the actual security is and where it isn't.

When you see a server with password authentication enabled, you now know what that means in practice. When you handle a private key file, you know what it represents. When SSH warns you about a changed host key, you know why that's serious.

The command is one line. The security is the entire protocol underneath it.
