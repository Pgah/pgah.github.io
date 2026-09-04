# Öğretici Makale Takvimi — 2026 Ağustos/Eylül

**Oluşturulma:** 2026-08-13
**Kapsam:** 10 makale, ~3 günde bir yayın temposu
**Durum:** Planlandı (yazılmadı)

## Mevcut Seriler (özet)

- **Linux serisi**: The Architecture of Linux (2026-06-30) → Linux File Permissions (2026-07-26) → Linux Processes and Signals (2026-08-05) → Linux Users and Groups (2026-08-05) → How systemd Works (2026-08-11)
- **Networking/Crypto**: Introduction to Networking (2026-06-28) → How TCP/IP Works (2026-07-31) → How HTTP Works (2026-08-01) → How DNS Works (2026-07-25) → How SSH Works (2026-07-12) → How TLS Works (2026-07-20) → How NAT Works (2026-08-05)
- **Intro**: Introduction to Cybersecurity (2026-06-26), Introduction to Networking (2026-06-28)

Frontmatter şeması (`src/content.config.ts`): `title`, `date` (bare YYYY-MM-DD), `description`, `tags` (3-5, lowercase), `draft` (kullanılmıyor). Seri ilişkisi ayrı bir alan değil — ortak tag'ler ve makale içi kavram bazlı çapraz linklerle kuruluyor.

## Takvim

| # | Tarih | Başlık | Seri | Bağlandığı makaleler | Önerilen tag'ler |
|---|-------|--------|------|----------------------|-------------------|
| 1 | 2026-08-14 | How IPv6 Works ✅ yayında | Networking | how-nat-works, how-tcp-ip-works | ipv6, networking, ip, fundamentals |
| 2 | 2026-08-17 | Linux Networking: iptables & netfilter ✅ yayında | Linux | how-nat-works, the-architecture-of-linux | linux, networking, iptables, security |
| 3 | 2026-08-20 | How Git Works: Objects, Refs, and the DAG ✅ yayında | Git (yeni seri) | — (yeni seri açılışı) | git, fundamentals, version-control |
| 4 | 2026-08-23 | How Databases Work ✅ yayında | Web/Backend (yeni seri) | — (yeni seri açılışı) | databases, backend, fundamentals |
| 5 | 2026-08-26 | Linux Filesystems: ext4 and the Inode Model ✅ yayında | Linux | the-architecture-of-linux, linux-file-permissions | linux, filesystems, fundamentals |
| 6 | 2026-08-29 | How Certificates & PKI Work ✅ yayında | Networking/Crypto | how-tls-works, how-ssh-works | pki, certificates, cryptography, tls |
| 7 | 2026-09-02 | Git Branching, Merging, and Rebasing ✅ yayında | Git | how-git-works (#3) | git, workflow, version-control |
| 8 | 2026-09-04 | How Web Servers Work ✅ yayında | Web/Backend | how-http-works, how-databases-work (#4) | web-servers, http, backend |
| 9 | 2026-09-07 | Cron & systemd Timers | Linux | how-systemd-works | linux, systemd, automation |
| 10 | 2026-09-10 | How Caching Works | Web/Backend | how-web-servers-work (#8), how-http-works | caching, performance, backend, cdn |

## Neden Bu 10 Konu / Bu Sıra

- **Denge**: Dört kategori de takvime dağıtıldı — Linux (3), Networking/Crypto (2), Git (2), Web/Backend (3). Art arda aynı seri gelmiyor, okuyucu çeşitliliği korunuyor.
- **IPv6 ilk sırada**: `how-nat-works` makalesinin kapanışı zaten IPv6'yı sıradaki doğal konu olarak işaret ediyor — en düşük sürtünmeli, en hazır başlangıç.
- **Git ve Web/Backend serileri "How X Works" formatıyla açılıyor**: Mevcut makalelerin başlık kalıbıyla (How SSH/TLS/DNS/TCP-IP/NAT/systemd Works) tutarlı, okuyucu için tanıdık.
- **Bağımlılık sırası korunuyor**: PKI/Certificates, TLS'ten sonra geliyor (TLS'i derinleştiriyor); Web Servers, HTTP ve Databases'ten sonra geliyor; Caching, Web Servers'tan sonra geliyor; Git Branching, Git internals'tan sonra geliyor; Cron/Timers, systemd'nin doğal devamı.

## Notlar

- Her satırın "Bağlandığı makaleler" kolonu, makale içinde çapraz link verilecek mevcut/planlanan yazıları gösterir (repo konvansiyonu: dosya adı değil kavram üzerinden link).
- Sıradaki adım her makale için: repo konvansiyonuna uyan bir plan+spec çifti (`docs/superpowers/plans/YYYY-MM-DD-<slug>.md` + `specs/...-design.md`) ya da doğrudan `superpowers:brainstorming` → `writing-plans` akışıyla detaylandırılıp `src/content/posts/<slug>.md` olarak yazılabilir.
- Yayın günü geldiğinde tarih sütunundaki `date` alanı gerçek yayın gününe göre güncellenebilir (bu takvim bir hedef, kesin taahhüt değil).
