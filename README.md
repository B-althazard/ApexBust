# WebAPP ApexBust (PWA, Android-focused)

Local-first workout tracker PWA built for GitHub Pages (static hosting).

## Requirements
- Node.js (LTS recommended)
- npm

## Install
```bash
npm install
```

## Run locally
```bash
npm run dev
```

## Build
```bash
npm run build
```

Output is in `dist/`.

## Deploy to GitHub Pages (static)
### Option 1: Pages from `docs/` folder
1. Build:
   ```bash
   npm run build
   ```
2. Copy build output to `docs/`:
   ```bash
   rm -rf docs
   cp -r dist docs
   ```
3. Commit + push.
4. In GitHub repo Settings → Pages:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/docs`

### Option 2: Pages from GitHub Actions (recommended)
Create `.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then GitHub repo Settings → Pages:
- Source: GitHub Actions

## PWA / Offline
- `public/manifest.webmanifest` defines install metadata.
- `public/sw.js` provides cache-first shell + SWR asset caching.
- The app displays an update banner when a new Service Worker is installed.

## Notes
- All persistence is browser-side via IndexedDB (Dexie).
- Single-tab enforcement uses BroadcastChannel + a localStorage heartbeat.
