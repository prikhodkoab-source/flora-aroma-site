# Flora & Aroma Site

New repository-managed public storefront for Flora & Aroma.

Current role:

- Tilda remains the temporary public storefront.
- This site is the future Codex-managed storefront.
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

- GitHub to Cloudflare Pages or Netlify after preview verification.

Recommended build settings:

- Build command: `npm run build`
- Publish directory: `dist`
