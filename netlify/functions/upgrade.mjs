import { walletFrom } from "../lib/session.mjs";
import { getSeason, seasonLive, getLevels, rebuildLevels, store } from "../lib/data.mjs";
import { UPGRADES, newPlayer, settle } from "../lib/game.mjs";
import { isTxSig, mintInfo, verifyBurn } from "../lib/solana.mjs";
import { playerView } from "../lib/view.mjs";
import { json, fail } from "../lib/http.mjs";

export default async (req) => {
  if (req.method !== "POST") return fail(405, "POST only");
  const wallet = walletFrom(req);
  if (!wallet) return fail(401, "Sign in again.");
  const mint = process.env.TAPPED_MINT;
  if (!mint) return fail(409, "Upgrades open once $TAPPED is live.");
  const season = await getSeason();
  if (!seasonLive(season)) return fail(409, "The season isn't running.");
  let b;
  try { b = await req.json(); } catch { return fail(400, "Invalid request body."); }
  const { upgrade, level, txSig } = b;
  const u = UPGRADES[upgrade];
  if (!u || !Number.isInteger(level) || level < 1 || level >= u.levels.length) return fail(400, "Unknown upgrade.");
  if (!isTxSig(txSig)) return fail(400, "Missing burn transaction.");

  const burns = store("burns");
  const used = await store("burnsigs").get(txSig, { type: "json" });
  if (used && used.wallet !== wallet) return fail(409, "This burn was already used.");

  const lvl = await getLevels(season.id, wallet);
  if (!used) {
    if (lvl[upgrade] >= level) return fail(409, "You already own this level.");
    if (lvl[upgrade] !== level - 1) return fail(409, "Buy the previous level first.");
    let v;
    try {
      const { decimals } = await mintInfo(mint);
      v = await verifyBurn(txSig, wallet, mint, BigInt(u.cost[level]) * 10n ** BigInt(decimals));
    } catch { return fail(502, "Could not verify the burn yet. Try again."); }
    if (v.pending) return json({ pending: true, error: "Burn not confirmed yet." }, 202, { "cache-control": "no-store" });
    if (v.error) return fail(402, v.error);

    // Settle auto-mining at the old level before the upgrade takes effect.
    const ps = store("players");
    const key = `${season.id}/${wallet}`;
    const p = (await ps.get(key, { type: "json" })) || newPlayer(wallet, season.id, null);
    settle(p, lvl);
    await ps.setJSON(key, p);

    await burns.set(`${season.id}/${wallet}/${upgrade}-${level}-${txSig}`, "1");
    await store("burnsigs").setJSON(txSig, { wallet, upgrade, level, season: season.id, at: Date.now() });
  }
  const newLvl = await rebuildLevels(season.id, wallet);
  const p = (await store("players").get(`${season.id}/${wallet}`, { type: "json" })) || newPlayer(wallet, season.id, null);
  return json({ ok: true, player: await playerView(season, p, newLvl) }, 200, { "cache-control": "no-store" });
};
export const config = { path: "/api/upgrade" };
