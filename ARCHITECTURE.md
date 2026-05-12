# Finding Mainera — Production Architecture

> The static site in this repository is the deployable visual prototype.
> This document is the build spec for the full multi-tenant production stack:
> Next.js 15 (App Router) + Postgres + Prisma + NextAuth + Cloudinary + Vercel.

---

## 1 · Product summary

Finding Mainera is a virtual gallery representing a curated roster of emerging contemporary painters. The platform must support:

- **Public catalogue** — homepage, archive, artist roster, exhibitions, artwork detail pages.
- **Live auctions** with written-rationale bids, reserve prices, curator approval.
- **Artist portal** — every represented artist uploads their own works.
- **Super admin** — curator manages roster, publishes works on behalf of artists, moderates comments, schedules auctions, edits homepage modules.
- **Collector accounts** — bid, save works, follow auctions, view provenance documents.
- **SEO + AI-search** — schema.org-rich, fast, multilingual (EN / ID).

---

## 2 · Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + React Server Components | Fast catalogue pages, ISR for artwork pages, server actions for admin |
| Language | **TypeScript (strict)** | Type-safety across the auction state machine |
| Styling | **Tailwind CSS** + the existing `css/gallery.css` design tokens | Keep design language; layer Tailwind for speed |
| Animation | **Framer Motion** (small surface) + CSS where possible | Reserve JS animation for hero + transitions |
| Optional 3D | **Three.js** + `@react-three/fiber` | Behind a `/gallery/3d` route; lazy-loaded |
| Database | **PostgreSQL 16** (Neon or Supabase) | Strong consistency for bids; JSON columns for flexible work metadata |
| ORM | **Prisma 5** | Migration-driven, type-safe |
| Auth | **NextAuth.js (Auth.js v5)** with Email magic-link + Google + Apple + WebAuthn step-up for bidding | No password storage; passkeys for collector verification |
| Storage / CDN | **Cloudinary** (primary) or **Supabase Storage** + Cloudflare Images | Auto-WebP/AVIF, art-grade colour profile preservation |
| Search | **Postgres `tsvector`** + **Meilisearch** for cross-language fuzzy | EN + ID stems |
| Realtime | **Pusher** or **Supabase Realtime** | Live bid count, countdown sync |
| Payments | **Stripe** (cards), **Xendit** (Indonesian rails: VA, QRIS, OVO, GoPay) | IDR-native |
| Email | **Resend** (transactional), **Buttondown** (newsletter) | Beautiful default templates |
| Observability | **Sentry** + **Vercel Analytics** + **PostHog** (product) | Errors, web vitals, funnel |
| Deployment | **Vercel** (web) + **Neon** (DB) + **Cloudinary** | One-region origin (Singapore), global CDN |
| CMS escape hatch | **Sanity Studio** (optional, mounted at `/studio`) | If non-technical staff need richer editorial workflows later |

---

## 3 · Folder structure

```
finding-mainera/
├── app/                                    # Next.js App Router
│   ├── (public)/
│   │   ├── page.tsx                        # homepage
│   │   ├── gallery/page.tsx                # archive (RSC + filters)
│   │   ├── artist/
│   │   │   ├── page.tsx                    # roster
│   │   │   └── [slug]/page.tsx             # artist profile
│   │   ├── exhibitions/page.tsx
│   │   ├── artwork/[slug]/page.tsx         # detail + bidding
│   │   └── essay/[slug]/page.tsx
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── (collector)/
│   │   └── dashboard/
│   │       ├── page.tsx
│   │       ├── bids/page.tsx
│   │       ├── saved/page.tsx
│   │       └── acquisitions/page.tsx
│   ├── (artist)/
│   │   └── studio/
│   │       ├── page.tsx
│   │       ├── works/
│   │       │   ├── page.tsx
│   │       │   └── new/page.tsx
│   │       └── analytics/page.tsx
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx                    # super-admin dashboard
│   │       ├── works/page.tsx
│   │       ├── artists/page.tsx
│   │       ├── auctions/page.tsx
│   │       ├── bids/page.tsx
│   │       ├── comments/page.tsx
│   │       ├── collectors/page.tsx
│   │       ├── homepage/page.tsx           # module ordering
│   │       └── seo/page.tsx
│   ├── api/
│   │   ├── bid/route.ts                    # POST place-bid
│   │   ├── bid/[id]/decision/route.ts      # POST accept|decline
│   │   ├── comment/route.ts
│   │   ├── upload/sign/route.ts            # Cloudinary signed upload
│   │   ├── webhook/stripe/route.ts
│   │   └── webhook/xendit/route.ts
│   ├── sitemap.ts                          # next-sitemap
│   ├── robots.ts
│   ├── manifest.ts
│   ├── opengraph-image.tsx                 # dynamic OG
│   └── layout.tsx
├── components/
│   ├── ui/                                 # Button, Field, Tabs, Dialog
│   ├── gallery/                            # Hero, Spotlight, Archive, Work
│   ├── bidding/                            # BidModule, Countdown, History
│   └── admin/                              # KPI, Table, UploadDropzone
├── lib/
│   ├── db.ts                               # prisma client
│   ├── auth.ts                             # NextAuth config
│   ├── rbac.ts                             # role-based guards
│   ├── auctions/
│   │   ├── machine.ts                      # state machine
│   │   └── pricing.ts                      # IDR formatting, minimums
│   ├── seo.ts                              # generateMetadata helpers
│   └── i18n.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── messages/                               # next-intl
│   ├── en.json
│   └── id.json
├── public/                                 # static (this repo's current site)
├── tests/
│   ├── e2e/                                # Playwright
│   └── unit/                               # Vitest
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4 · Database schema (Prisma)

```prisma
// prisma/schema.prisma

datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

enum Role           { SUPER_ADMIN  CURATOR  ARTIST  COLLECTOR  GUEST }
enum WorkStatus     { DRAFT  AVAILABLE  ON_AUCTION  SOLD  WITHDRAWN  HIDDEN }
enum AuctionStatus  { SCHEDULED  LIVE  CLOSED  CANCELLED }
enum BidStatus      { PENDING  APPROVED  DECLINED  OUTBID  WINNING  CANCELLED }
enum CommentStatus  { PENDING  APPROVED  HIDDEN  FLAGGED }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  image         String?
  role          Role     @default(COLLECTOR)
  verifiedAt    DateTime?
  country       String?
  city          String?
  locale        String   @default("en")
  createdAt     DateTime @default(now())
  artist        Artist?
  bids          Bid[]
  comments      Comment[]
  saved         Save[]
  inquiries     Inquiry[]
  sessions      Session[]
  passkeys      Passkey[]
}

model Artist {
  id            String   @id @default(cuid())
  slug          String   @unique           // "asti-rahardjo"
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])
  name          String
  birthYear     Int?
  birthCity     String?
  basedIn       String?
  bio           String   @db.Text
  bioId         String?  @db.Text          // Indonesian translation
  statement     String?  @db.Text
  pullQuote     String?
  portraitImage String?
  signatureImg  String?
  joinedAt      DateTime @default(now())
  visible       Boolean  @default(true)
  works         Work[]
  exhibitions   ArtistOnExhibition[]
}

model Work {
  id            String     @id @default(cuid())
  slug          String     @unique         // "finding-mainera-i"
  inventoryNo   String     @unique         // "FM-AR-2022-001"
  artistId      String
  artist        Artist     @relation(fields: [artistId], references: [id])
  title         String
  titleId       String?                    // Indonesian title
  year          Int
  medium        String                     // "Oil on canvas"
  surface       String?                    // "Canvas" | "Linen"
  widthCm       Float
  heightCm      Float
  depthCm       Float?
  edition       String     @default("Unique, signed verso")
  curatorial    String     @db.Text
  artistNote    String?    @db.Text        // private
  provenance    String?    @db.Text
  literature    String?    @db.Text
  conditionNote String?
  status        WorkStatus @default(DRAFT)
  priceIdr      Decimal?   @db.Decimal(14, 2)
  insuranceIdr  Decimal?   @db.Decimal(14, 2)
  seoTitle      String?
  seoDesc       String?
  ogImage       String?
  images        Image[]
  auction       Auction?
  comments      Comment[]
  saves         Save[]
  inquiries     Inquiry[]
  views         Int        @default(0)
  publishedAt   DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  @@index([artistId, status])
  @@index([status, publishedAt])
}

model Image {
  id          String   @id @default(cuid())
  workId      String
  work        Work     @relation(fields: [workId], references: [id])
  url         String                                       // Cloudinary public id or signed URL
  altText     String
  caption     String?
  width       Int
  height      Int
  bytes       Int
  variant     String   @default("front")                   // "front" | "verso" | "detail" | "installation"
  order       Int      @default(0)
  blurHash    String?                                      // for placeholder
  dominantHex String?                                      // for cinematic background tint
  @@index([workId, order])
}

model Auction {
  id            String        @id @default(cuid())
  workId        String        @unique
  work          Work          @relation(fields: [workId], references: [id])
  status        AuctionStatus @default(SCHEDULED)
  startAt       DateTime
  endAt         DateTime
  reserveIdr    Decimal       @db.Decimal(14, 2)
  startBidIdr   Decimal       @db.Decimal(14, 2)
  increment     Decimal       @db.Decimal(14, 2)            // minimum step
  topBidId      String?
  topBid        Bid?          @relation("AuctionTop", fields: [topBidId], references: [id])
  bids          Bid[]         @relation("AuctionBids")
  extendsBy     Int           @default(180)                 // anti-snipe: seconds added when bid in last 3 min
  createdAt     DateTime      @default(now())
}

model Bid {
  id              String     @id @default(cuid())
  auctionId       String
  auction         Auction    @relation("AuctionBids", fields: [auctionId], references: [id])
  topForAuction   Auction[]  @relation("AuctionTop")
  bidderId        String
  bidder          User       @relation(fields: [bidderId], references: [id])
  amountIdr       Decimal    @db.Decimal(14, 2)
  justification   String     @db.Text                       // required, ≥12 chars
  status          BidStatus  @default(PENDING)
  ipHash          String                                   // audit trail (salted)
  userAgent       String?
  curatorNote     String?    @db.Text
  decidedAt       DateTime?
  decidedById     String?
  createdAt       DateTime   @default(now())
  @@index([auctionId, status])
  @@index([bidderId])
}

model Comment {
  id        String        @id @default(cuid())
  workId    String
  work      Work          @relation(fields: [workId], references: [id])
  authorId  String?
  author    User?         @relation(fields: [authorId], references: [id])
  displayAs String                                          // "Tanya K.", "Anonymous"
  body      String        @db.Text
  status    CommentStatus @default(PENDING)
  createdAt DateTime      @default(now())
  @@index([workId, status])
}

model Save {
  userId String
  workId String
  user   User @relation(fields: [userId], references: [id])
  work   Work @relation(fields: [workId], references: [id])
  createdAt DateTime @default(now())
  @@id([userId, workId])
}

model Inquiry {
  id        String   @id @default(cuid())
  workId    String?
  work      Work?    @relation(fields: [workId], references: [id])
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  email     String
  name      String
  message   String   @db.Text
  status    String   @default("OPEN")                       // OPEN | ANSWERED | CLOSED
  createdAt DateTime @default(now())
}

model Exhibition {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  titleId     String?
  venue       String
  city        String?
  type        String                                        // "Solo" | "Group" | "Fair" | "Biennale"
  startDate   DateTime
  endDate     DateTime?
  description String?  @db.Text
  artists     ArtistOnExhibition[]
  coverImage  String?
}

model ArtistOnExhibition {
  artistId     String
  exhibitionId String
  artist       Artist     @relation(fields: [artistId], references: [id])
  exhibition   Exhibition @relation(fields: [exhibitionId], references: [id])
  role         String     @default("included")             // "solo" | "two-person" | "included"
  @@id([artistId, exhibitionId])
}

model HomepageModule {
  id        String   @id @default(cuid())
  type      String                                          // "hero"|"spotlight"|"archive"|"roster"|"editorial"|"timeline"|"cta"
  title     String
  payload   Json                                            // module-specific config
  order     Int
  visible   Boolean  @default(true)
  updatedAt DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actorRole  Role?
  action     String                                          // "WORK_CREATE", "BID_APPROVE", etc.
  target     String?                                         // "Work:cuid…"
  diff       Json?
  ip         String?
  createdAt  DateTime @default(now())
  @@index([action, createdAt])
}

model Session  { id String @id; userId String; expires DateTime; sessionToken String @unique; user User @relation(fields:[userId], references:[id]) }
model Passkey  { id String @id @default(cuid()); userId String; credentialId String @unique; publicKey Bytes; counter Int; user User @relation(fields:[userId], references:[id]) }
```

---

## 5 · Authentication & authorization

**Providers** (NextAuth v5):
1. Email magic-link (default).
2. Google + Apple OAuth.
3. **WebAuthn / passkeys** as a step-up for placing bids. Bidding requires a passkey or a fresh magic-link within 24 h.

**Roles** are stored on `User.role` and resolved on the server via `lib/rbac.ts`:

```ts
export async function requireRole(req, ...allowed: Role[]) {
  const session = await auth();
  if (!session?.user || !allowed.includes(session.user.role)) {
    throw new ForbiddenError();
  }
  return session;
}
```

Route guards (App Router middleware):

| Path prefix | Required role |
|---|---|
| `/admin/*` | `SUPER_ADMIN` or `CURATOR` |
| `/studio/*` | `ARTIST` (own works only) or higher |
| `/dashboard/*` | `COLLECTOR` or higher |
| Everything else | public |

Server actions and API routes never trust the client role — they re-check via `requireRole()` on every mutation.

---

## 6 · Bidding state machine

```
                    ┌────────────┐
                    │ SCHEDULED  │  Auction.startAt > now
                    └─────┬──────┘
                          │ cron flips at startAt
                          ▼
   place-bid          ┌────────────┐    end of window
   (any user with ──▶ │   LIVE     │  ─────────────────┐
   passkey/email)     └─────┬──────┘                    │
                            │ extendsBy logic           │
                            │ pushes endAt if bid in    │
                            │ last 3 min                │
                            ▼                           ▼
                     ┌────────────┐               ┌──────────┐
                     │  CLOSED    │ ────────────▶ │ AWARDED  │
                     └────────────┘    curator    └──────────┘
                                       confirms      │
                                       winner        ▼
                                                ┌──────────┐
                                                │ INVOICED │
                                                └──────────┘
```

**Bid lifecycle** (`BidStatus`):
- `PENDING` — submitted, curator notified, bid is **publicly anonymised** until approved.
- `APPROVED` — curator clicked Accept; updates `Auction.topBidId` if amount exceeds current top.
- `WINNING` — the approved bid is currently top.
- `OUTBID` — a later approved bid surpassed it; notify bidder.
- `DECLINED` — curator rejected (rare; e.g., proxy collector mismatch).
- `CANCELLED` — bidder withdrew before approval (allowed within 60 s).

**Rationale field** (`Bid.justification`) is enforced ≥ 12 characters and is **private to artist + curator**.

**Anti-snipe**: a bid in the final 3 minutes extends `endAt` by `Auction.extendsBy` seconds. Implemented in a single transaction.

**Concurrency**: bid writes use `SERIALIZABLE` isolation. The increment check is server-side; the client minimum is advisory only.

---

## 7 · Image pipeline

1. **Artist uploads** via signed Cloudinary upload widget (`/api/upload/sign`). Original is preserved.
2. Server post-processes:
   - Generates `front`, `detail-1..n`, `verso`, `installation` derivatives.
   - Stores width/height/bytes/blurHash/dominantHex (Sharp + thumbhash) on `Image`.
   - Strips EXIF GPS but keeps ICC profile (colour-fidelity matters for paintings).
3. Render via `next/image` with `loader = cloudinary`. Responsive `sizes` per breakpoint; AVIF first.
4. Detail page uses `<Image priority>` + a `<picture>` element with the blurHash as a `background-image` placeholder for instant paint.
5. **Zoom**: OpenSeadragon with a derived deep-zoom tileset (`f_auto,q_auto:best` from Cloudinary) — lazy loaded only when the user clicks zoom.

---

## 8 · SEO + AI search strategy

| Surface | Implementation |
|---|---|
| Per-route metadata | `generateMetadata()` in each `page.tsx`; title pattern `Title — Artist (Year) ｜ Finding Mainera` |
| Schema.org JSON-LD | `lib/seo.ts` builders for `WebSite`, `ArtGallery`, `Person`, `VisualArtwork`, `Offer`, `BreadcrumbList`, `ItemList` (already drafted in the static prototype) |
| OpenGraph + Twitter | Dynamic `opengraph-image.tsx` per work — server-rendered card with title, artist, year, medium, gallery wordmark |
| Sitemap | `next-sitemap` with `alternateRefs` for `hreflang` (en, id) |
| Robots | Generative-AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot`) explicitly allowed; admin/collector areas disallowed |
| **`/llms.txt`** | Curated index for LLM crawlers — already present in this repo |
| i18n | `next-intl`; URL pattern `/[locale]/...`. EN default, ID alternate |
| Canonical | Explicit on every page; trailing-slash-normalised |
| Web Vitals | Target LCP < 1.8s, INP < 200ms, CLS < 0.05 on a Singapore 4G profile |
| Semantic HTML | `<article itemscope itemtype="https://schema.org/VisualArtwork">`, `<figure>`, `<figcaption>`, `<time>`, `<address>` |
| Image SEO | Alt text required (validation in `Work.images` form); `image:caption` in sitemap |
| Multilingual content | `title`, `bio`, `titleId`, `bioId` columns; auto-translate is **opt-in** per artist |

**AI-search optimization specifics**:
- Stable, descriptive URLs (`/artwork/finding-mainera-i`, not `/artwork/abc123`).
- Each work's primary `description` answers in one paragraph: *what it is, who made it, when, in what medium, for how much, on what status*.
- `llms.txt` exposes a flat, machine-readable index of canonical URLs.
- `OAI-SearchBot` and `ChatGPT-User` granted in `robots.txt`; `Google-Extended`, `Applebot-Extended`, `ClaudeBot`, `PerplexityBot` granted.
- Schema.org `Offer` block on every saleable work means Google Shopping / AI-shopping can quote prices.

---

## 9 · API surface (selected)

```
POST   /api/auth/[...nextauth]            NextAuth
POST   /api/bid                           place bid       (auth: COLLECTOR + verified)
POST   /api/bid/:id/decision              accept/decline  (auth: CURATOR)
POST   /api/comment                       post comment    (auth: optional → moderation queue)
POST   /api/comment/:id/decision          approve/hide    (auth: CURATOR)
POST   /api/upload/sign                   signed upload   (auth: ARTIST | CURATOR)
POST   /api/inquiry                       inquiry form    (public, rate-limited)
POST   /api/save/:workId                  toggle save     (auth: COLLECTOR)
POST   /api/webhook/stripe                payment webhook
POST   /api/webhook/xendit                IDR rails webhook
GET    /api/og?work=:slug                 dynamic OG image
```

All mutating routes use Next.js **Server Actions** by default; the `/api/*` routes above exist only where they're called by webhooks or external clients.

Rate limits (Upstash Redis):

| Route | Limit |
|---|---|
| `POST /api/bid` | 5 per minute per user |
| `POST /api/comment` | 3 per minute per user |
| `POST /api/inquiry` | 5 per hour per IP |
| `POST /api/upload/sign` | 30 per minute per artist |

---

## 10 · Deployment & ops

- **Vercel** — Edge for marketing routes, Node runtime for `/api/bid`. Origin region: `sin1` (Singapore) for Indonesian collectors.
- **Neon** Postgres — primary in `sin1`, branch-per-PR for previews.
- **Cloudinary** — image origin; signed uploads.
- **Cloudflare** in front for WAF + bot management on `/api/*`.
- **Cron** (Vercel Cron): every minute flip auction states (`SCHEDULED → LIVE`, `LIVE → CLOSED`); every hour reconcile top-bid; nightly archive of stale drafts.
- **Backups**: Neon PITR (7 days); nightly logical dump to S3 (Glacier IR after 30 days).
- **Environments**: `preview` (every PR), `staging` (main), `production` (release branch). `production` requires manual promotion + 1 reviewer.

---

## 11 · Security

- **CSP** (strict): `default-src 'self'`; `img-src 'self' res.cloudinary.com data:`; `script-src 'self' 'nonce-…'`. No third-party JS except font CSS.
- **HSTS** preload, `Permissions-Policy: interest-cohort=()`.
- **SQL** — only Prisma; raw SQL forbidden in app code (lint rule).
- **Auth** — magic-link tokens single-use, 10-minute TTL; passkeys for bidding step-up.
- **Bids** — server-side amount and increment validation; serializable txn; bidder verified before publish.
- **Comments** — moderation queue by default; profanity + spam pre-screen via Cloudflare Workers AI.
- **Audit log** — every mutation in `AuditLog`; super-admin can replay diffs.
- **PII** — collector phone / address stored in a separate `ContactProfile` table, encrypted at rest with KMS-wrapped DEK.
- **DDoS** — Cloudflare; API routes Upstash-rate-limited.
- **Dependency scanning** — Renovate + Snyk; weekly automated PR.

---

## 12 · Performance budget

| Page | LCP | INP | CLS | JS (gzipped) |
|---|---|---|---|---|
| Homepage | < 1.5 s | < 150 ms | < 0.02 | < 60 kB |
| Artwork detail | < 1.8 s | < 200 ms | < 0.05 | < 90 kB (incl. bidding) |
| Archive (filtered) | < 1.5 s | < 200 ms | < 0.05 | < 70 kB |
| Admin | not budgeted (private) | — | — | — |

Techniques: RSC by default, route-level `loading.tsx` skeletons, `next/font` self-hosted, `next/image` with Cloudinary loader, partial prerendering for archive pages, edge cache for `GET /api/og`.

---

## 13 · Accessibility

- WCAG **AA** minimum; AAA-target on key flows (sign-in, bidding).
- Every interactive element is reachable by keyboard.
- Focus rings are visible on every state (already implemented in `gallery.css`).
- `prefers-reduced-motion` collapses scroll-reveal and zoom (already implemented).
- Image alt text is **required** in the upload form; falls back to artist + title + year if missing.
- ARIA landmarks: `header[role=banner]`, `nav`, `main`, `footer[role=contentinfo]`.
- Live regions (`aria-live="polite"`) on the countdown and bid-history list.

---

## 14 · Roadmap

| Phase | Scope |
|---|---|
| **0 — Static prototype** | This repository — homepage, archive, artist roster, exhibitions, artwork detail with bidding UI, admin mockup, auth/collector pages |
| **1 — Catalogue MVP** | Prisma schema, public read paths, artist roster + works from DB, admin upload, NextAuth (collector), no live bidding yet |
| **2 — Auctions** | Auction state machine, bidding with rationale, curator review queue, anti-snipe, realtime countdown |
| **3 — Payments** | Stripe + Xendit, provenance PDF generation (signed by artist + curator) |
| **4 — Editorial + multilingual** | Essays, ID translations, `/[locale]/` routes, Sanity Studio for non-technical staff |
| **5 — Immersive** | Optional `/gallery/3d` Three.js mode; OpenSeadragon deep-zoom on every work |
| **6 — Programmatic** | Public API (read-only) for partners; Artsy/Artnet feeds |

---

## 15 · Environment

```bash
# .env.example
DATABASE_URL="postgres://user:pass@host/db"
NEXTAUTH_URL="https://findingmainera.art"
NEXTAUTH_SECRET="…"

GOOGLE_CLIENT_ID="…"
GOOGLE_CLIENT_SECRET="…"
APPLE_ID="…"
APPLE_SECRET="…"

CLOUDINARY_CLOUD_NAME="finding-mainera"
CLOUDINARY_API_KEY="…"
CLOUDINARY_API_SECRET="…"

RESEND_API_KEY="…"
STRIPE_SECRET_KEY="sk_live_…"
STRIPE_WEBHOOK_SECRET="whsec_…"
XENDIT_SECRET_KEY="…"

UPSTASH_REDIS_REST_URL="…"
UPSTASH_REDIS_REST_TOKEN="…"

SENTRY_DSN="…"
```

---

*This document is the contract between the visual prototype in this repository
and the production Next.js application. When in doubt, treat the prototype as
the design source of truth and this document as the engineering source of
truth.*
