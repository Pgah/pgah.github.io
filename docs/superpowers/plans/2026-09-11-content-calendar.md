# Öğretici Makale Takvimi — 2026 Eylül/Kasım (2. Parti)

**Oluşturulma:** 2026-09-11
**Kapsam:** 8 makale, haftada bir yayın temposu
**Durum:** Planlandı (yazılmadı)

## Önceki Takvim (özet)

İlk 10 makalelik takvim (`2026-08-13-content-calendar.md`) 2026-09-10'da How Caching Works ile tamamlandı. Dört seri: Linux, Networking/Crypto, Git, Web/Backend — toplam 23 yayınlanmış makale.

Frontmatter şeması (`src/content.config.ts`): `title`, `date` (bare YYYY-MM-DD), `description`, `tags` (3-5, lowercase), `draft` (kullanılmıyor). Seri ilişkisi ayrı bir alan değil — ortak tag'ler ve makale içi kavram bazlı çapraz linklerle kuruluyor.

## Takvim

| # | Tarih | Başlık | Seri | Bağlandığı makaleler | Önerilen tag'ler |
|---|-------|--------|------|----------------------|-------------------|
| 1 | 2026-10-17 | How Load Balancing Works ✅ yayında | Networking/Backend | how-web-servers-work, how-nat-works | load-balancing, networking, backend, fundamentals |
| 2 | 2026-10-17 | How Containers Work: Namespaces & cgroups ✅ yayında | Linux | linux-processes-and-signals, how-systemd-works, cron-and-systemd-timers | linux, containers, cgroups, fundamentals |
| 3 | 2026-10-01 | Git Internals: Packfiles & Garbage Collection | Git | how-git-works | git, internals, version-control |
| 4 | 2026-10-08 | How Authentication Works: Sessions, Tokens, and OAuth | Web/Backend | how-http-works, how-tls-works | authentication, security, backend, web |
| 5 | 2026-10-15 | How VPNs Work | Networking/Crypto | how-tls-works, how-ssh-works, how-nat-works | vpn, networking, cryptography, security |
| 6 | 2026-10-22 | The Linux Boot Process: BIOS/UEFI to systemd | Linux | the-architecture-of-linux, how-systemd-works | linux, boot, systemd, fundamentals |
| 7 | 2026-10-29 | How Message Queues Work | Web/Backend | how-web-servers-work, how-databases-work | message-queues, backend, architecture, fundamentals |
| 8 | 2026-11-05 | Git Hooks & Workflow Automation | Git | git-branching-merging-and-rebasing, cron-and-systemd-timers | git, automation, workflow, version-control |

## Neden Bu 8 Konu / Bu Sıra

- **Denge**: Dört kategoriye eşit dağılım (Linux 2, Networking/Crypto 2, Git 2, Web/Backend 2), art arda aynı seri gelmiyor.
- **Load Balancing ilk sırada**: `how-web-servers-work` makalesi konuyu zaten açmış ama derinleştirmemişti ("the proxy distributes incoming requests across them — round-robin, least-connections") — en düşük sürtünmeli devam konusu.
- **Containers**, `how-systemd-works` ve `cron-and-systemd-timers` makalelerinde değinilen cgroups kavramını tamamlıyor; `linux-processes-and-signals`'daki process modeline dayanıyor.
- **Git Internals**, `how-git-works`'teki obje modelini (blob/tree/commit) packfile/GC ile derinleştiriyor — Git Branching'den sonra internals'a dönüş.
- **Authentication**, `how-http-works`'teki Cookie/Set-Cookie ve statelessness temasının doğal devamı.
- **VPN**, TLS + SSH + NAT'ı tek bir uygulamada birleştiren sentezleyici bir konu.
- **Boot Process**, Linux serisini temel mimariye (`the-architecture-of-linux`) geri bağlıyor, systemd'nin nereden devraldığını gösteriyor.
- **Message Queues**, Caching'in "trade-off tekrar eden tema"sını (backend serisinin kapanışına yakın) senkron/asenkron ayrımıyla genişletiyor.
- **Git Hooks & Automation**, Git serisini `cron-and-systemd-timers`'daki otomasyon temasıyla kapatıyor.

## Notlar

- Her satırın "Bağlandığı makaleler" kolonu, makale içinde çapraz link verilecek mevcut yazıları gösterir (repo konvansiyonu: dosya adı değil kavram üzerinden link).
- Sıradaki adım her makale için: `superpowers:brainstorming` üzerinden bounded olarak sınıflandırılıp kısa bir in-chat tasarım onayı alınarak doğrudan `src/content/posts/<slug>.md` olarak yazılıyor (plan/spec çifti yok — #3-10 arası bu şekilde yazıldı).
- Yayın günü geldiğinde tarih sütunundaki `date` alanı gerçek yayın gününe göre güncellenebilir (bu takvim bir hedef, kesin taahhüt değil).
- Bu takvim tamamlandığında (madde #8, ~2026-11-05 hedefi), tempoyu sürdürmek isteniyorsa yeni bir parti planlanmalı.
