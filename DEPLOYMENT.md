# Deployment Guide

This is a fully static web app. No backend or server is required.

## GitHub Pages Deployment

### Option 1: GitHub Actions (Recommended)

1. Push your code to GitHub.

2. Go to your repository **Settings > Pages**.

3. Under **Source**, select **GitHub Actions**.

4. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

5. Push the workflow file. The site will deploy automatically.

### Option 2: Manual Deployment

1. Build the project:

```bash
npm run build
```

2. The `dist/` folder contains all static files.

3. In your GitHub repository settings, go to **Settings > Pages**.

4. Select **Deploy from a branch**, choose a branch (e.g., `gh-pages`), and set the folder to `/ (root)`.

5. Copy the contents of `dist/` to that branch and push.

## Other Static Hosts

The `dist/` folder can be deployed to any static hosting service:

- **Netlify:** Drag and drop the `dist/` folder, or connect your repo and set build command to `npm run build` with publish directory `dist`.
- **Vercel:** Connect your repo. Build command: `npm run build`. Output directory: `dist`.
- **Cloudflare Pages:** Connect your repo. Build command: `npm run build`. Output directory: `dist`.

## Environment Variables

None required. The app is entirely client-side with no API keys or secrets.

## Build Command

```bash
npm run build
```

## Common Issues

**Blank page after deployment:** The app uses relative paths (`./`) for assets. If you see a blank page, check that your hosting serves the `dist/` folder contents at the URL root or that the `base` config in `vite.config.ts` matches your deployment path.

**Service worker caching old version:** Clear your browser cache or open DevTools > Application > Service Workers and click "Unregister" to force a fresh load.

**Conversion doesn't work on iOS Safari:** Safari has limited MediaRecorder support. The app works best on Chrome/Edge on Android and desktop.
