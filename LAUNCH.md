# Edgebook phase 1: launch checklist

What's built, and the steps only you can do, because they need your accounts, money or signatures.

## What's in this folder

| Path | What it is |
| --- | --- |
| `desktop/` | The Edgebook desktop app (Electron). Loads the unchanged `app/Edgebook.html`. |
| `desktop/app/migrate.html` | First-launch screen that moves a journal from the old Edge-based Edgebook in one click. |
| `desktop/app/license.html` | License key window (Lemon Squeezy). Honour system: the app works without a key and reminds at most once a week. |
| `desktop/config.json` | Your checkout link, Lemon Squeezy product ID and website. **Placeholders until you fill them in.** |
| `desktop/dist/Edgebook-Setup-1.0.0.exe` | Windows installer, built locally, unsigned. |
| `.github/workflows/release.yml` | Builds Windows and Mac installers on GitHub when you push a tag like `v1.0.1`. |
| `site/` | The landing page (static HTML + screenshots of the sample journal). |

Commands, run in `desktop/`: `npm start` runs the app, `npm test` runs the tests, `npm run dist:win` builds the installer.

## 1. Payments: Lemon Squeezy

Lemon Squeezy is used instead of Paddle because it issues license keys itself.

- [ ] Create a store at lemonsqueezy.com and finish payout and tax setup.
- [ ] Create a product "Edgebook", $5, one-time. Turn on **license keys** (activation limit around 3).
- [ ] Attach the installer file to the product so buyers can download it after paying.
- [ ] Copy the product's checkout link into `desktop/config.json` → `checkoutUrl`, and into `site/index.html` (search for `YOUR-STORE`, 4 places).
- [ ] Copy the product ID (a number) into `config.json` → `lemonSqueezyProductId`. This stops keys from other products activating Edgebook.
- [ ] Make a test purchase in test mode, then activate the key from **Edgebook → License key…**.

## 2. GitHub: updates and Mac builds

- [x] GitHub repository created: `reragha-ux/edgebook-tj`, and set in `desktop/package.json` → `build.publish`. Installed apps can only download updates if the repo is **public**.
- [x] This folder pushed to `main`.
- [ ] Tag a release: `git tag v1.0.0` and `git push --tags`. The workflow builds both installers into a **draft** release. Publish the draft to ship it.
- [ ] Every later release: bump `version` in `desktop/package.json`, tag, push, publish the draft. Installed apps update themselves.
- [ ] The Mac build has not been tested yet. Try the `.dmg` from the first release on a Mac before saying "Mac" on the website.

Note: with a public repo, anyone can download the installer from the release page without paying. That fits the plan (no DRM; Vault is where the money is), but know it going in.

## 3. Code signing (recommended before a public launch)

Without signing, Windows shows a "Windows protected your PC" warning and Macs refuse to open the app.

- [ ] Windows: an Azure Trusted Signing account or an OV code-signing certificate. Add it as repo secrets `WIN_CERT_PFX_BASE64` and `WIN_CERT_PASSWORD`.
- [ ] Mac: Apple Developer Program ($99 a year). Add secrets `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Mac auto-updates only work once the app is signed.

## 4. Website

- [ ] Buy a domain and host `site/` on any static host (Cloudflare Pages, Netlify, GitHub Pages).
- [ ] Replace `YOUR-WAITLIST-FORM` with a Vault waitlist form (any email tool), `YOUR-SUPPORT-EMAIL` with your address, and `websiteUrl` in `config.json`.
- [ ] Decide a refund policy and add it to the FAQ.

## 5. Before launch day

- [ ] Install from the signed installer on a second Windows PC that has the old Edgebook, and run the one-click move.
- [ ] Check the phase-1 gate from the plan: 300 paid buyers and 2% or more of visitors buying, before starting Vault.

## Tested so far

- Unit tests for the file-path guard, license response checks and the export page (`npm test`, 3 passing).
- One-click move against a real old-Edgebook profile, both with the old app closed and open: 70 trades and 2 accounts arrived, and the old window was closed gracefully first.
- Packaged app: opens, shows the license window on first run, and a failed update check stays silent.
- Not tested: a live license activation (needs your store), the auto-update install, the Mac build.
