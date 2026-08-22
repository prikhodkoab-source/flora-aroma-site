# Cloudflare Pages Deployment

Current target: GitHub -> Cloudflare Pages.

## Repository

Use `flora-aroma-site/` as the repository root.

Recommended repository name:

```text
flora-aroma-site
```

## Cloudflare Pages Settings

- Framework preset: Astro
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Node version: use current Cloudflare default compatible with Astro 6, or set `NODE_VERSION=24`

Cloudflare Pages Git integration will build production deployments from `main` and preview deployments from non-production branches and pull requests.

## Pre-Deploy Local Check

Run:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run sync:products
& 'C:\Program Files\nodejs\npm.cmd' run build
& 'C:\Program Files\nodejs\npm.cmd' run verify
```

If `npm run build` is blocked by Windows script execution, use:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules\astro\bin\astro.mjs build
& 'C:\Program Files\nodejs\node.exe' scripts\verify-site.mjs
```

## Safety Rules

- `data/products.csv` is a public storefront export, not accounting truth.
- Exact internal stock is not published.
- Website requests continue through W2 and create draft orders only.
- Production is served by Cloudflare Pages at `https://flora-aroma.com.ua/` from the `main` branch.
- Tilda is retired/not in use and is not a production dependency or pending migration task.
- `flora-aroma-site.pages.dev` remains the deployment and preview verification host.
