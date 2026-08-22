# Flora & Aroma Site

New repository-managed public storefront for Flora & Aroma.

Current role:

- Cloudflare Pages serves the production storefront at `https://flora-aroma.com.ua/`.
- Tilda is retired and not in use; it is not a production dependency or migration task.
- `flora-aroma-site.pages.dev` remains the deployment and preview verification host.
- `data/products.csv` is a public catalog export, not an accounting source of truth.
- Stock, reserve, order, payment, and delivery writes remain disabled here.

Codex-managed scope:

- plant cards;
- prices;
- public availability wording;
- SEO;
- photos;
- category pages;
- public Ukrainian texts.

Build:

```powershell
npm install
npm run build
```

Deployment target:

- Production: GitHub `main` to Cloudflare Pages at `https://flora-aroma.com.ua/`.
- Branch previews: Cloudflare Pages preview deployments from non-production branches.
- Netlify is not used for the production storefront.

Recommended build settings:

- Build command: `npm run build`
- Publish directory: `dist`
