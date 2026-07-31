# Site branch migration handoff

## Branch decision

The active storefront development base is `feature/tilda-style-redesign`, not `main`.

- Working base: `feature/tilda-style-redesign` at `19d25e2394d2e9e4d86a50a7e119df27356ab1ba`.
- Production deployment branch: `main` at `c347c255033d4999ff46d2b50f5f1f36572fda90`.
- Common ancestor: `15852876b6b15d791ac6d4d1797108654c1220d1`.
- Prepared integration branch: `codex/feature-tilda-style-redesign-sync-c347c25`.
- Clean merge commit: `2bda5326ac373e626eff956104610acbaa08a5f8`.

`main` remains the Cloudflare Pages production deployment branch. It is not the working base for the next storefront changes. The integration branch contains both the branded plant-card work from the feature branch and the approved publication pipeline from production.

## Migration artifacts

The Git integration branch is the canonical migration artifact. It carries the complete files and history; no binary patch or copied source tree is required.

Machine-readable metadata is stored in:

```text
docs/site-branch-migration-handoff-2026-07-31.json
```

Key artifact roots:

```text
src/content/publications/
src/pages/publications/
src/lib/publication-policy.mjs
src/content.config.ts
public/images/publications/aromatic-border/
public/images/plant-cards/aromatic-border/
data/products.csv
data/plant-image-sources.csv
public/images/plants/local/
scripts/test-publications.mjs
scripts/verify-site.mjs
docs/publications-content-contract.md
```

## Safe adoption procedure

The site dialogue should:

1. Fetch origin and confirm there are no tracked local changes.
2. Check out `codex/feature-tilda-style-redesign-sync-c347c25` from origin.
3. Verify that both required commits are ancestors of `HEAD`.
4. Run all site tests, `npm run build`, and `npm run verify`.
5. Confirm that the article is approved, has four inline body visualizations, no duplicate bottom gallery, and 13 plant cards after the text.
6. Fast-forward `feature/tilda-style-redesign` to the integration branch and push that branch only.
7. Verify the Cloudflare branch-preview URL after deployment.

Do not force-push. Do not update `main`, production, DNS, Tilda, stock, prices, orders, Meta, or Telegram without a separate operator approval.

## Shell sequence after validation

```powershell
git fetch origin
git checkout feature/tilda-style-redesign
git merge --ff-only origin/codex/feature-tilda-style-redesign-sync-c347c25
git push origin feature/tilda-style-redesign
```

The fast-forward is valid because both `19d25e2` and `c347c25` are ancestors of the prepared integration branch.

## Validation result

Validated on 2026-07-31 in an isolated worktree:

```text
npm run test:publications     passed
npm run test:catalog-filters  passed
npm run test:site-order       passed
npm run test:analytics        passed
npm run build                 passed (68 pages)
npm run verify                passed
```

Both source commits are confirmed ancestors of the integration branch. `npm install` reported 8 dependency audit findings (1 low, 7 high); no automatic dependency update was mixed into this migration.
