---
title: "Günlük Hayatta Git İpuçları"
date: 2026-06-20
description: "Sık kullandığım ama çoğu kişinin bilmediği git komutları."
tags: ["git", "cli", "araçlar"]
---

Git'i her gün kullanıyorum ama çoğu kişi temel komutların ötesine geçmiyor.
İşte gerçekten işe yarayan birkaç ipucu.

## `git stash` ile Yarım İş Bırakma

Acil bir şey çıktığında branch'i kirletmeden geçiş yapmak için:

```bash
git stash push -m "WIP: login formu"
git checkout baska-branch
# iş bitti
git stash pop
```

## `git log` Daha Güzel

```bash
git log --oneline --graph --decorate --all
```

Bunu alias olarak ekle:

```bash
git config --global alias.lg "log --oneline --graph --decorate --all"
git lg
```

## Yanlış Commit'i Düzeltmek

Son commit'e bir dosya eklemeyi unuttuysanız:

```bash
git add unutulan-dosya.txt
git commit --amend --no-edit
```

> **Not:** Push etmemişseniz bu güvenli. Push ettiyseniz `--force-with-lease` ile push edin.

## `git bisect` ile Bug Avı

Hangi commit'te bug girdi bilmiyorsanız:

```bash
git bisect start
git bisect bad          # şu an bozuk
git bisect good v1.2.0  # bu tag'de iyiydi
# git ikiye böler, test et, good/bad de, bulur
git bisect reset
```

Bunlar günlük akışımın bir parçası. Daha fazlası gelecek.
