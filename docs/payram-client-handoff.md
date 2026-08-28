# PayRam production handoff

The Clear View storefront integration is complete. The remaining steps belong
to the person or company that will control the receiving wallets.

## Before accepting customer funds

1. Confirm the PayRam dashboard displays **MAINNET**, not **TESTNET**. Do not
   connect production wallets or advertise live checkout while it says TESTNET.
2. Start with one low-fee stablecoin network, then expand only after a complete
   payment and sweep has been tested. Polygon USDC/USDT or Base USDC are sensible
   starting options when supported by the receiving wallets.
3. In **Wallet management → Deposit wallet**, connect a dedicated master wallet.
4. Enter a separate cold-wallet address controlled by the client. A hardware
   wallet is preferred. The master and cold addresses must not be the same.
5. In **Wallet management → Hot wallet**, add a separate hot wallet and fund it
   only with the small amount of native network coin needed for gas. Keep the
   balance minimal.
6. Back up the PayRam database and `/root/.payraminfo/aes` encryption key to
   encrypted offline storage. Both are required for recovery.

## Connect PayRam to the storefront

1. Create a project API key in the PayRam **Developers** area.
2. Add and activate this webhook endpoint in PayRam:

   `https://www.clearviewbiolabs.com/api/payram/webhook`

3. Configure a long, unique webhook API key/shared secret. PayRam must send it
   in the `API-Key` request header.
4. Add these encrypted environment variables to the Clear View Vercel project
   for Production (and Preview when testing):

   - `PAYRAM_BASE_URL=https://pay.clearviewbiolabs.com`
   - `PAYRAM_API_KEY=<PayRam project API key>`
   - `PAYRAM_WEBHOOK_SECRET=<same secret configured on the webhook>`

5. Redeploy the Vercel project after saving the variables.

Never put API keys, wallet private keys, seed phrases, or the AES backup in
GitHub, email, chat, screenshots, or public Vercel variables.

## Go-live test

1. Sign in to Clear View as a normal customer.
2. Place the smallest practical order and confirm the hosted PayRam page opens.
3. Pay it from a wallet that is not any of the three merchant wallets.
4. Confirm PayRam reports `FILLED`, the Clear View order changes to `paid`, and
   the funds sweep to the cold wallet.
5. Confirm a duplicate webhook does not create another order or payment.

Only after all five checks pass should live checkout be announced to customers.
