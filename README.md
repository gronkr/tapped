# Tapped — tap to earn stocks

Players tap to mine points. Each season has a pool of real tokenized stocks (xStocks), split between players by their share of all points. Upgrades are bought by burning $TAPPED.

## Deploy
1. New GitHub repo, upload these files (netlify.toml, package.json, public/, netlify/ at the top level).
2. Netlify → Add new site → Import from GitHub → pick the repo. Build command empty, publish `public`.
3. Environment variables (tick "Contains secret values" for all but TAPPED_MINT):
   - `SESSION_SECRET` (required): random string, e.g. `openssl rand -hex 32`. Signs player logins.
   - `ADMIN_KEY` (required): password for /admin.html.
   - `SOLANA_RPC_URL` (required): Helius RPC URL.
   - `TAPPED_MINT` (add once the coin is live): $TAPPED mint address. Until it's set, tapping works and upgrades show "Soon".
   - `CG_API_KEY` (recommended): CoinGecko Demo key for pool prices.
4. Trigger a deploy.

## Run a season
1. Put the stocks for the pool in a wallet you control.
2. /admin.html → set id (s1), name, start/end, minimum points, and the pool (TICKER, mint, amount).
3. After it ends → "Build payout list" → download the CSV and send with a bulk-send tool.
   Players see their payout in the game at the same moment.
4. New season = new id (s2). Everyone restarts from zero, upgrades included.

## Tuning
All balance numbers (upgrade levels, $TAPPED prices, energy, auto-miner cap, referral %) are at the top of `netlify/lib/game.mjs`.
Set upgrade prices after launch based on $TAPPED's price.

## Anti-cheat built in
- Server enforces energy and a max of 15 taps/sec; extra taps are discarded.
- Upgrades only apply after the burn is verified on-chain; each burn can be used once.
- Minimum points for a payout filters out throwaway wallets.
