# Cloudflare Pages: Telegram site requests

The storefront sends `/api/site-order` to a Cloudflare Pages Function. The Function sends a
draft request to the operator's Telegram chat. It does not create an order, reservation,
payment, delivery event, or stock movement.

Required Cloudflare Pages secrets for both Production and Preview:

- `TELEGRAM_TOKEN`: Telegram bot token.
- `TELEGRAM_CHAT_ID`: operator Telegram chat ID. The operator must have started the bot.

Cloudflare dashboard path:

1. Workers & Pages.
2. `flora-aroma-site`.
3. Settings.
4. Variables and Secrets.
5. Add the two encrypted secrets.
6. Redeploy the latest `main` deployment.

Do not commit `.dev.vars`, `.env`, the token, or the real chat ID.
