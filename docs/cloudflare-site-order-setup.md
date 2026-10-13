# Cloudflare Pages: Telegram site requests

The storefront sends `/api/site-order` to a Cloudflare Pages Function. The Function first
stores the structured draft request in D1, then sends a Telegram notification in its default
`direct` mode. It does not
create a Flora order, reservation, payment, delivery event, or stock movement.

Required Cloudflare Pages secrets for both Production and Preview:

- `TELEGRAM_TOKEN`: Telegram bot token.
- `TELEGRAM_CHAT_ID`: operator Telegram chat ID. The operator must have started the bot.
- `W2_SYNC_TOKEN`: random secret used only by Flora to export and acknowledge D1 requests.

Required binding:

- `SITE_REQUESTS_DB`: D1 database `flora-aroma-site-requests`.

Cloudflare dashboard path:

1. Workers & Pages.
2. `flora-aroma-site`.
3. Settings.
4. Variables and Secrets.
5. Add the two encrypted secrets.
6. Redeploy the latest `main` deployment.

Apply D1 migrations before the first live request:

```powershell
npm run db:migrate:remote
```

For the `0002_site_order_variant_id.sql` rollout, apply the additive remote migration
**before merging the Pages Function change to `main`**. `main` deploys automatically and
the new Function requires the column. Verify the migration and then deploy the reviewed
Function; keep the old Function available for rollback. Historical rows retain an empty
`variant_id` and must not be guessed into a variant. The configured Preview binding
points to the same D1 database, so do not submit synthetic orders through a preview URL.

Flora reads new rows from the protected `/api/site-orders` endpoint and acknowledges them
only after `SiteRequests.csv` and the workbook are safely synchronized.

## Operator notification handoff

`SITE_ORDER_NOTIFICATION_MODE` defaults to `direct`, preserving the existing
Pages Function Telegram alert. After Flora's pinned website status monitor has
seeded its baseline, passed destination checks and run successfully on its
ordinary schedule, set the Production Pages variable to `flora_monitor` and
redeploy the reviewed Function. The Function then stores
`telegram_status=deferred_to_flora_monitor` in D1 and does not call Telegram;
Flora's 15-minute importer carries that marker into `SiteRequests`, and its
separate status monitor sends the operator alert through the shared Prom/site
transport. An invalid mode fails before storing a request. The customer still
receives only a draft-request acknowledgement, never a stock or payment promise.
The export holds a fresh `telegram_status=pending` request for one minute so
the direct send can finish; an older pending request is exported for recovery
after a Function crash. Operator alerts are at least once and may be duplicated
across that crash boundary; reconcile them by request ID.

Keep `direct` during preparation. If the monitor fails after handoff, restore
`direct` and inspect pending D1 requests and the Flora alert outbox. No mode
changes accounting rows or customer messaging.

Do not commit `.dev.vars`, `.env`, the token, or the real chat ID.
