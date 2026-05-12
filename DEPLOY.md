# Deploy Finding Mainera

This site needs to live in its own repository (`kapanthron/findingmainera`)
and its own Cloudflare Worker (`findingmainera`). Below is the exact path
from this branch to a green deploy.

> **⚠ Security first.** The password you sent in chat must be considered
> compromised — it has been transmitted through the model, may appear in
> logs and replays, and was visible to anyone watching the session. Rotate
> it before storing it anywhere. The password is **never** committed to
> this repo; it is stored only in Cloudflare's encrypted secret vault.

---

## 0 · Prerequisites

```bash
# Local tools
gh --version          # GitHub CLI, https://cli.github.com
node --version        # ≥ 20
npm --version
npx wrangler --version  # ≥ 4

gh auth login         # one-time
npx wrangler login    # one-time
```

---

## 1 · Create the empty GitHub repo

I cannot create this repository from inside this session — my GitHub access
is scoped to `kalkukprpro` only. Run this once from your laptop:

```bash
gh repo create kapanthron/findingmainera \
  --private \
  --description "Finding Mainera — a virtual gallery for emerging contemporary painters." \
  --homepage "https://findingmainera.art"
```

(Use `--public` if you want it open.)

---

## 2 · Migrate the code

From the current `kalkukprpro` checkout, run the included script:

```bash
git checkout claude/virtual-art-gallery-Eemwv
bash scripts/migrate-to-findingmainera.sh
```

The script:

1. Creates a clean `../findingmainera/` directory beside this repo.
2. Copies only the gallery files — **excludes `kpr.html` and the old
   KPR git history**.
3. Initialises a fresh git history with a single initial commit.
4. Sets `git@github.com:kapanthron/findingmainera.git` as `origin`.
5. Pushes `main`.

If you'd rather migrate by hand:

```bash
mkdir -p ../findingmainera && cd ../findingmainera
cp -R ../kalkukprpro/{index.html,gallery.html,artist.html,exhibitions.html,\
auth.html,collector.html,admin.html,404.html,sitemap.xml,robots.txt,\
manifest.json,llms.txt,wrangler.jsonc,.assetsignore,ARCHITECTURE.md,\
README.md,DEPLOY.md,artwork,css,js,scripts} .
git init -b main
git add -A
git commit -m "Initial commit — Finding Mainera virtual gallery"
git remote add origin git@github.com:kapanthron/findingmainera.git
git push -u origin main
```

---

## 3 · Connect Cloudflare

### 3a · Via the dashboard (easiest)

1. Cloudflare → **Workers & Pages → Create application → Pages → Connect to Git**.
2. Pick the new `kapanthron/findingmainera` repo, branch `main`.
3. Build settings:
   - **Framework preset**: *None* (static site).
   - **Build command**: leave blank.
   - **Build output directory**: `/` (project root).
4. Save & deploy.

### 3b · Via Wrangler CLI

The repo already contains `wrangler.jsonc` configured for static assets.

```bash
cd ../findingmainera
npx wrangler deploy
# or for staged release:
npx wrangler versions upload
```

The Worker will be named `findingmainera` (matching `wrangler.jsonc`).

---

## 4 · Set super-admin credentials (the right way)

The **username** is public and lives in `wrangler.jsonc` as a `vars` entry:

```jsonc
"vars": { "SUPER_ADMIN_USERNAME": "kapanthron" }
```

The **password** never enters the repository. Set it once per environment
into Cloudflare's encrypted secret store. The Worker hashes it before
storage (Argon2id, 19 MB / 2 iters / 1 lane — the OWASP 2024 baseline):

```bash
# 1) Generate the hash locally so the plaintext never touches Cloudflare
#    or anyone else's logs. Requires Node ≥ 20.
node -e "
  const argon2 = require('argon2');                       // npm i argon2
  const pw = process.argv[1];
  argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
        .then(h => { console.log(h); });
" '<paste-rotated-password-here>'

# 2) Pipe the resulting hash into Cloudflare. The plaintext is now discarded.
echo '<argon2id$v=19$m=19456,t=2,p=1$...>' | npx wrangler secret put SUPER_ADMIN_PASSWORD_HASH
```

Also set the supporting secrets:

```bash
npx wrangler secret put SESSION_SECRET            # random 32+ bytes
npx wrangler secret put DATABASE_URL              # when Postgres is added
npx wrangler secret put RESEND_API_KEY            # transactional email
```

Verify:

```bash
npx wrangler secret list
```

Cloudflare returns names, never values. The values exist only inside the
encrypted vault and are injected into the Worker at runtime.

> **For the static prototype on this branch, none of these secrets are
> exercised** — the admin page is a UI mockup. They become live in Phase 1
> of the roadmap in `ARCHITECTURE.md` when the auth layer ships.

---

## 5 · Point your domain

Once the Worker is green:

1. Cloudflare DNS → add `findingmainera.art` (root) and `www`.
2. Workers & Pages → your project → **Custom Domains → Set up a custom
   domain → findingmainera.art**.
3. Cloudflare provisions the certificate automatically.

Repeat for `www.findingmainera.art` if you want both.

---

## 6 · Post-deploy sanity check

```bash
curl -sI https://findingmainera.art/                | head -5
curl -sI https://findingmainera.art/artwork/finding-mainera-i.html | head -5
curl -s  https://findingmainera.art/robots.txt      | head -10
curl -s  https://findingmainera.art/sitemap.xml     | head -10
curl -sI https://findingmainera.art/nonexistent     | head -5   # expect 404 with the styled 404.html
```

Then submit `https://findingmainera.art/sitemap.xml` to:

- Google Search Console
- Bing Webmaster Tools
- IndexNow (Cloudflare can auto-pipe this)

---

## 7 · Decommission `kalkukprpro` (optional)

The KPR calculator still lives on `kalkukprpro/main` as `kpr.html`. Keep
it, archive the repo, or delete it — none of those affect the new
Finding Mainera deploy.

```bash
# Archive without deleting:
gh repo archive kapanthron/kalkukprpro

# Or delete entirely (destructive — requires confirmation):
gh repo delete kapanthron/kalkukprpro
```

Do this **after** confirming Finding Mainera is serving correctly.
